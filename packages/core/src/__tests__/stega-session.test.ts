import { describe, expect, it } from "bun:test";
import { encodeMarker, hasCodecChars, hasMarker, stegaClean, stegaCleanDeep, stegaDecode, stegaEncode } from "../stega.ts";
import { parseRefKey, refKey } from "../docref.ts";
import { EditorSession } from "../session.ts";
import type { DataSource, Doc, SaveResult } from "../ports.ts";
import type { DocumentSchema } from "../schema.ts";

describe("docref", () => {
  it("round-trips collection and global keys", () => {
    expect(parseRefKey(refKey({ kind: "collection", slug: "pages", id: 23 }))).toEqual({ kind: "collection", slug: "pages", id: 23 });
    expect(parseRefKey(refKey({ kind: "collection", slug: "posts", id: "abc123" }))).toEqual({ kind: "collection", slug: "posts", id: "abc123" });
    expect(parseRefKey("g:header")).toEqual({ kind: "global", slug: "header" });
    expect(parseRefKey("x:nope")).toBeNull();
    expect(parseRefKey("c:posts:")).toBeNull();
  });
});

describe("stega", () => {
  const marker = { ref: "c:pages:23", path: "sections.3.items.2.title", kind: "text" as const };

  it("round-trips a marker and stays invisible", () => {
    const s = stegaEncode("Trade pricing", marker);
    expect(s.startsWith("Trade pricing")).toBe(true);
    expect(stegaDecode(s)).toEqual([marker]);
    expect(stegaClean(s)).toBe("Trade pricing");
    expect(s.trim()).toBe(s); // codec chars are not whitespace
    expect(hasMarker(s)).toBe(true);
  });

  it("handles unicode values and paths", () => {
    const m = { ref: "g:en-tête", path: "titre", kind: "textarea" as const };
    expect(stegaDecode(stegaEncode("Café ☕ — déjà", m))).toEqual([m]);
    expect(stegaClean(stegaEncode("Café ☕ — déjà", m))).toBe("Café ☕ — déjà");
  });

  it("re-marks instead of doubling, and finds several markers in concatenated text", () => {
    const once = stegaEncode("A", marker);
    expect(stegaDecode(stegaEncode(once, marker))).toHaveLength(1);
    const other = { ...marker, path: "sections.0.heading" };
    expect(stegaDecode(stegaEncode("A", marker) + " " + stegaEncode("B", other))).toEqual([marker, other]);
  });

  it("ignores truncated or corrupted markers, and cleans their fragments", () => {
    const s = stegaEncode("Hello", marker);
    const truncated = s.slice(0, s.length - 9);
    expect(stegaDecode(truncated)).toEqual([]);
    expect(stegaClean(truncated)).toBe("Hello");
    expect(hasCodecChars(truncated)).toBe(true);
    const enc = encodeMarker(marker);
    expect(stegaDecode(enc.slice(0, 5) + enc.slice(6))).toEqual([]); // body length broken
  });

  it("cleans deeply without touching non-strings", () => {
    const d = { a: stegaEncode("x", marker), n: 3, list: [stegaEncode("y", marker), { b: stegaEncode("z", marker) }], when: new Date(0) };
    const out = stegaCleanDeep(d);
    expect(out).toEqual({ a: "x", n: 3, list: ["y", { b: "z" }], when: d.when });
    expect(out.when).toBe(d.when);
  });
});

// ── session ───────────────────────────────────────────────────────────────
const pageSchema: DocumentSchema = {
  kind: "collection",
  slug: "pages",
  labels: { singular: "Page", plural: "Pages" },
  editable: ["title", "layout"],
  drafts: true,
  fields: [
    { name: "title", type: "text", label: "Title" },
    { name: "layout", type: "blocks", label: "Layout", blocks: [{ slug: "hero", labels: { singular: "Hero", plural: "Heroes" }, fields: [{ name: "heading", type: "text", label: "Heading" }, { name: "image", type: "upload", label: "Image", relationTo: "media" }] }] },
  ],
};
const headerSchema: DocumentSchema = { kind: "global", slug: "header", labels: { singular: "Header", plural: "Header" }, editable: ["tagline"], drafts: true, fields: [{ name: "tagline", type: "text", label: "Tagline" }] };

function fakeSource(docs: Record<string, Doc>, opts: { conflictOn?: string } = {}) {
  const saves: Array<{ key: string; data: Doc; updatedAt?: string }> = [];
  const published: string[] = [];
  let version = 0;
  const key = (r: any) => (r.kind === "global" ? `g:${r.slug}` : `c:${r.slug}:${r.id}`);
  const ds: DataSource = {
    loadSchema: async (ref) => (ref.kind === "global" ? headerSchema : pageSchema),
    loadDocument: async (ref, o) => structuredClone(docs[key(ref) + (o.draft ? "" : ":published")] ?? docs[key(ref)]),
    saveDraft: async (ref, data, o): Promise<SaveResult> => {
      saves.push({ key: key(ref), data, updatedAt: o.updatedAt });
      if (opts.conflictOn === key(ref)) return { ok: false, status: 409, message: "stale" };
      return { ok: true, updatedAt: `v${++version}` };
    },
    publish: async (ref) => {
      published.push(key(ref));
      return { ok: true, updatedAt: `p${++version}` };
    },
  };
  return { ds, saves, published };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("EditorSession", () => {
  const base = () => ({
    "c:pages:1": { id: 1, updatedAt: "v0", title: "Home", layout: [{ id: "r1", blockType: "hero", heading: "Hi", image: { id: 9, url: "/x.jpg" } }] },
    "c:pages:1:published": { id: 1, title: "Home (live)", layout: [] },
    "g:header": { updatedAt: "h0", tagline: "Lighting since 1909" },
  });

  it("opens several documents and edits each independently", async () => {
    const { ds, saves } = fakeSource(base());
    const s = new EditorSession({ dataSource: ds, autosaveDelay: 0 });
    await Promise.all([s.open({ kind: "collection", slug: "pages", id: 1 }), s.open({ kind: "global", slug: "header" })]);
    expect(s.getSnapshot().docs["c:pages:1"].status).toBe("ready");
    s.setValue("c:pages:1", "layout.0.heading", "Hello");
    s.setValue("g:header", "tagline", "Made in Ohio");
    await s.flush();
    expect(saves.find((x) => x.key === "c:pages:1")!.data).toEqual({ layout: [{ id: "r1", blockType: "hero", heading: "Hello", image: 9 }] });
    expect(saves.find((x) => x.key === "c:pages:1")!.updatedAt).toBe("v0");
    expect(saves.find((x) => x.key === "g:header")!.data).toEqual({ tagline: "Made in Ohio" });
  });

  it("undo is session-wide and ordered across documents", async () => {
    const { ds } = fakeSource(base());
    const s = new EditorSession({ dataSource: ds, autosaveDelay: 0 });
    await Promise.all([s.open({ kind: "collection", slug: "pages", id: 1 }), s.open({ kind: "global", slug: "header" })]);
    s.setValue("c:pages:1", "title", "A");
    s.setValue("g:header", "tagline", "B");
    s.undo();
    expect(s.get("g:header")!.doc!.tagline).toBe("Lighting since 1909");
    expect(s.get("c:pages:1")!.doc!.title).toBe("A");
    s.undo();
    expect(s.get("c:pages:1")!.doc!.title).toBe("Home");
    s.redo();
    expect(s.get("c:pages:1")!.doc!.title).toBe("A");
    expect(s.getSnapshot().canRedo).toBe(true);
  });

  it("transient typing becomes one undo step; cancel restores", async () => {
    const { ds, saves } = fakeSource(base());
    const s = new EditorSession({ dataSource: ds, autosaveDelay: 0 });
    await s.open({ kind: "collection", slug: "pages", id: 1 });
    s.setValue("c:pages:1", "title", "H", { transient: true });
    s.setValue("c:pages:1", "title", "Ho", { transient: true });
    expect(saves).toHaveLength(0);
    s.cancelTransient("c:pages:1");
    expect(s.get("c:pages:1")!.doc!.title).toBe("Home");
    s.setValue("c:pages:1", "title", "Ho", { transient: true });
    s.setValue("c:pages:1", "title", "Hola");
    s.undo();
    expect(s.get("c:pages:1")!.doc!.title).toBe("Home");
  });

  it("a conflict on one document freezes only that document", async () => {
    const { ds, saves } = fakeSource(base(), { conflictOn: "g:header" });
    const s = new EditorSession({ dataSource: ds, autosaveDelay: 0 });
    await Promise.all([s.open({ kind: "collection", slug: "pages", id: 1 }), s.open({ kind: "global", slug: "header" })]);
    s.setValue("g:header", "tagline", "X");
    await s.flush();
    expect(s.get("g:header")!.save.status).toBe("conflict");
    s.setValue("c:pages:1", "title", "Still saving");
    await s.flush();
    expect(s.get("c:pages:1")!.save.status).toBe("saved");
    expect(saves.filter((x) => x.key === "c:pages:1")).toHaveLength(1);
  });

  it("publishes edited documents only, and discard restores published values", async () => {
    const { ds, published, saves } = fakeSource(base());
    const seen: string[] = [];
    const s = new EditorSession({ dataSource: ds, autosaveDelay: 0, onSaved: (r) => seen.push(refKey(r)) });
    await Promise.all([s.open({ kind: "collection", slug: "pages", id: 1 }), s.open({ kind: "global", slug: "header" })]);
    s.setValue("c:pages:1", "title", "New");
    const res = await s.publish();
    expect(res.ok).toBe(true);
    expect(published).toEqual(["c:pages:1"]);
    expect(seen).toContain("c:pages:1");
    s.setValue("c:pages:1", "title", "Throwaway");
    await s.discard();
    expect(s.get("c:pages:1")!.doc!.title).toBe("Home (live)");
    expect(saves.at(-1)!.data).toMatchObject({ title: "Home (live)", layout: [] });
  });

  it("client mode adopts the page's draft without fetching it", async () => {
    const { ds } = fakeSource({});
    let loads = 0;
    const counting: DataSource = { ...ds, loadDocument: async (...a) => (loads++, ds.loadDocument(...a)) };
    const s = new EditorSession({ dataSource: counting });
    await s.open({ kind: "collection", slug: "pages", id: 7 }, { id: 7, title: "Client" });
    expect(loads).toBe(0);
    expect(s.get("c:pages:7")!.doc!.title).toBe("Client");
  });
});
