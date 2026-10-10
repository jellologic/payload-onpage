/**
 * EditorSession — the editing state for every document on the page.
 *
 * Framework-agnostic and observable (subscribe/getSnapshot, so React can use
 * useSyncExternalStore). One DocumentState per DocRef: its schema, its draft
 * (populated, for rendering), its autosave queue and its last `updatedAt`.
 * Undo/redo is session-wide, so ⌘Z undoes the last edit whichever document it
 * touched.
 */
import { AutosaveQueue, type SaveState } from "./autosave.ts";
import { refKey, type DocRef } from "./docref.ts";
import { buildPatch, changedKeys } from "./fields.ts";
import { setAt } from "./path.ts";
import { stegaCleanDeep } from "./stega.ts";
import type { DataSource, Doc } from "./ports.ts";
import type { DocumentSchema } from "./schema.ts";

export interface DocumentState {
  key: string;
  ref: DocRef;
  status: "loading" | "ready" | "error";
  error?: string;
  schema: DocumentSchema | null;
  doc: Doc | null;
  save: SaveState;
  /** Edited in this session since load or the last publish/discard. */
  edited: boolean;
}

export interface SessionSnapshot {
  docs: Record<string, DocumentState>;
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryEntry {
  key: string;
  before: Doc;
  after: Doc;
}

export interface EditorSessionOptions {
  dataSource: DataSource;
  locale?: string;
  autosaveDelay?: number;
  /** Called after a document's pending edits were saved (renderers refresh here). */
  onSaved?: (ref: DocRef) => void;
}

const HISTORY_LIMIT = 200;

export class EditorSession {
  readonly dataSource: DataSource;
  readonly locale?: string;
  private docs = new Map<string, DocumentState>();
  private queues = new Map<string, AutosaveQueue>();
  private updatedAt = new Map<string, string | undefined>();
  /** Last value queued for saving, per document (diff base for the next save). */
  private saved = new Map<string, Doc>();
  /** Value before the current run of transient edits, per document. */
  private anchors = new Map<string, Doc>();
  private loading = new Map<string, Promise<void>>();
  private schemaCache = new Map<string, Promise<DocumentSchema>>();
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot = { docs: {}, canUndo: false, canRedo: false };
  private readonly autosaveDelay: number;
  private readonly onSaved?: (ref: DocRef) => void;

  constructor(opts: EditorSessionOptions) {
    this.dataSource = opts.dataSource;
    this.locale = opts.locale;
    this.autosaveDelay = opts.autosaveDelay ?? 800;
    this.onSaved = opts.onSaved;
  }

  // ── store plumbing ──────────────────────────────────────────────────────
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private emit() {
    this.snapshot = {
      docs: Object.fromEntries(this.docs),
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    for (const fn of this.listeners) fn();
  }

  private patchState(key: string, patch: Partial<DocumentState>) {
    const cur = this.docs.get(key);
    if (!cur) return;
    this.docs.set(key, { ...cur, ...patch });
    this.emit();
  }

  get(key: string): DocumentState | undefined {
    return this.docs.get(key);
  }

  // ── loading ─────────────────────────────────────────────────────────────
  private schemaFor(ref: DocRef): Promise<DocumentSchema> {
    const k = `${ref.kind}:${ref.slug}`;
    let p = this.schemaCache.get(k);
    if (!p) {
      p = this.dataSource.loadSchema(ref, { locale: this.locale });
      this.schemaCache.set(k, p);
      p.catch(() => this.schemaCache.delete(k));
    }
    return p;
  }

  /**
   * Start editing a document. With `initialDoc` (client mode: the page already
   * holds the draft) nothing is fetched but the schema; otherwise the draft is
   * loaded. Opening an open document is a no-op.
   */
  open(ref: DocRef, initialDoc?: Doc): Promise<void> {
    const key = refKey(ref);
    if (this.docs.has(key)) {
      if (initialDoc && !this.docs.get(key)!.doc) this.adopt(key, initialDoc);
      return this.loading.get(key) ?? Promise.resolve();
    }
    this.docs.set(key, { key, ref, status: "loading", schema: null, doc: initialDoc ?? null, save: { status: "idle" }, edited: false });
    if (initialDoc) this.adopt(key, initialDoc);
    this.emit();
    const task = (async () => {
      try {
        const [schema, doc] = await Promise.all([
          this.schemaFor(ref),
          initialDoc ? Promise.resolve(initialDoc) : this.dataSource.loadDocument(ref, { draft: true, locale: this.locale, depth: 2 }),
        ]);
        if (!initialDoc) this.adopt(key, doc);
        this.patchState(key, { schema, status: "ready" });
      } catch (e) {
        this.patchState(key, { status: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, task);
    return task;
  }

  private adopt(key: string, raw: Doc) {
    // A page rendered with auto-mapping markers may hand us its marked copy; edit clean values.
    const doc = stegaCleanDeep(raw) as Doc;
    this.saved.set(key, doc);
    this.updatedAt.set(key, typeof doc.updatedAt === "string" ? doc.updatedAt : undefined);
    const cur = this.docs.get(key);
    if (cur) this.docs.set(key, { ...cur, doc });
  }

  private queueFor(key: string): AutosaveQueue {
    let q = this.queues.get(key);
    if (q) return q;
    const state = this.docs.get(key)!;
    q = new AutosaveQueue({
      delay: this.autosaveDelay,
      onState: (save) => {
        this.patchState(key, { save });
        if (save.status === "saved") this.onSaved?.(state.ref);
      },
      send: async (patch) => {
        const res = await this.dataSource.saveDraft(state.ref, patch, { locale: this.locale, updatedAt: this.updatedAt.get(key) });
        if (res.ok && res.updatedAt) this.updatedAt.set(key, res.updatedAt);
        return res;
      },
    });
    this.queues.set(key, q);
    return q;
  }

  /** Schedule the editable top-level fields that changed since the last save. */
  private queueChanges(key: string, next: Doc) {
    const state = this.docs.get(key);
    const schema = state?.schema;
    if (!state || !schema) return;
    const keys = changedKeys(this.saved.get(key) ?? {}, next, schema.editable);
    if (!keys.length) return;
    this.saved.set(key, next);
    this.queueFor(key).schedule(buildPatch(next, keys, schema.fields));
  }

  // ── editing ─────────────────────────────────────────────────────────────
  /** Change a document. `transient` updates the view only (live typing): no history, no save. */
  apply(key: string, fn: (doc: Doc) => Doc, opts: { transient?: boolean } = {}) {
    const state = this.docs.get(key);
    if (!state?.doc) return;
    const before = state.doc;
    const next = fn(before);
    if (next === before) return;
    if (opts.transient) {
      if (!this.anchors.has(key)) this.anchors.set(key, before);
      this.docs.set(key, { ...state, doc: next });
      this.emit();
      return;
    }
    const anchor = this.anchors.get(key) ?? before;
    this.anchors.delete(key);
    this.past.push({ key, before: anchor, after: next });
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.docs.set(key, { ...state, doc: next, edited: true });
    this.queueChanges(key, next);
    this.emit();
  }

  setValue(key: string, path: string, value: unknown, opts: { transient?: boolean } = {}) {
    this.apply(key, (d) => setAt(d, path, value), opts);
  }

  /** Drop transient changes (Escape while typing). */
  cancelTransient(key: string) {
    const anchor = this.anchors.get(key);
    const state = this.docs.get(key);
    if (!anchor || !state) return;
    this.anchors.delete(key);
    this.docs.set(key, { ...state, doc: anchor });
    this.emit();
  }

  private restore(key: string, doc: Doc) {
    const state = this.docs.get(key);
    if (!state) return;
    this.anchors.delete(key);
    this.docs.set(key, { ...state, doc, edited: true });
    this.queueChanges(key, doc);
  }

  undo() {
    const entry = this.past.pop();
    if (!entry) return;
    this.future.unshift(entry);
    this.restore(entry.key, entry.before);
    this.emit();
  }

  redo() {
    const entry = this.future.shift();
    if (!entry) return;
    this.past.push(entry);
    this.restore(entry.key, entry.after);
    this.emit();
  }

  // ── saving ──────────────────────────────────────────────────────────────
  async flush(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.flush()));
  }

  get hasPendingSaves(): boolean {
    return [...this.queues.values()].some((q) => q.hasPending);
  }

  /** Has unpublished changes: edited here, or its latest version is a draft. */
  private unpublished(state: DocumentState): boolean {
    return state.edited || state.doc?._status === "draft";
  }

  /** Publish every document with unpublished changes (edited here, or saved as a draft before). */
  async publish(opts: { keys?: string[] } = {}): Promise<{ ok: boolean; message?: string; published: DocRef[] }> {
    await this.flush();
    const published: DocRef[] = [];
    for (const state of this.docs.values()) {
      if (opts.keys && !opts.keys.includes(state.key)) continue;
      if (!this.unpublished(state) || !state.doc || !state.schema) continue;
      if (state.save.status === "conflict") return { ok: false, message: `${state.schema.labels.singular}: resolve the conflict first`, published };
      const data = buildPatch(state.doc, state.schema.editable, state.schema.fields);
      const res = await this.dataSource.publish(state.ref, data, { locale: this.locale, updatedAt: this.updatedAt.get(state.key) });
      if (!res.ok) return { ok: false, message: res.message ?? `Publish failed (${res.status})`, published };
      if (res.updatedAt) this.updatedAt.set(state.key, res.updatedAt);
      this.patchState(state.key, { edited: false, doc: { ...state.doc, _status: "published" } });
      published.push(state.ref);
    }
    return { ok: true, published };
  }

  /** Reset drafts with unpublished changes to their published versions. */
  async discard(opts: { keys?: string[] } = {}): Promise<void> {
    await this.flush();
    for (const state of [...this.docs.values()]) {
      if (opts.keys && !opts.keys.includes(state.key)) continue;
      if (!this.unpublished(state) || !state.schema || !state.doc) continue;
      const published = await this.dataSource.loadDocument(state.ref, { draft: false, locale: this.locale, depth: 2 });
      const next = { ...state.doc };
      for (const k of state.schema.editable) next[k] = published[k];
      this.apply(state.key, () => next);
      await this.queues.get(state.key)?.flush();
      const cur = this.docs.get(state.key);
      this.patchState(state.key, { edited: false, doc: cur?.doc ? { ...cur.doc, _status: "published" } : cur?.doc ?? null });
    }
  }

  /** After a conflict: load the latest draft of a document and continue from it. */
  async reload(key: string): Promise<void> {
    const state = this.docs.get(key);
    if (!state) return;
    const doc = await this.dataSource.loadDocument(state.ref, { draft: true, locale: this.locale, depth: 2 });
    this.adopt(key, doc);
    this.anchors.delete(key);
    this.past = this.past.filter((e) => e.key !== key);
    this.future = this.future.filter((e) => e.key !== key);
    this.queues.get(key)?.reset();
    this.patchState(key, { edited: false });
  }
}
