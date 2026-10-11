/**
 * Ports: the seams where payload-onpage meets the outside world. Each has a
 * default adapter (in this or a sibling package); anything implementing the
 * interface can replace it.
 *
 *   DataSource    how documents and schemas are read and written   payloadRest()
 *   MediaLibrary  how images are found and uploaded                 payloadUploads()
 *   Locator       how page elements map to fields (DOM)             annotations(), stega()
 *   Renderer      how the page shows a committed change             nextRefresh(), clientState()
 *   SessionAdapter how a request enters/leaves edit or preview mode nextSession() (server)
 * Field editors are registered in @payload-onpage/react.
 */
import type { DocRef } from './docref.ts'
import { MARKER_KINDS } from './stega.ts'
import type { DocumentSchema } from './schema.ts'

export type Doc = Record<string, unknown>

/** The outcome of a save: success carries the new version, failure its status. */
export type SaveResult =
  | {
      ok: true
      /** The document's new `updatedAt`. */
      updatedAt?: string | undefined
    }
  | {
      ok: false
      /** HTTP-like status: 409 means someone else saved first, 0 a network failure. */
      status: number
      message?: string | undefined
    }

/** Options callers often fill from other optional values, so `undefined` is accepted. */
type Opt<T> = T | undefined

export interface DataSource {
  loadSchema(ref: DocRef, opts: { locale?: Opt<string> }): Promise<DocumentSchema>
  loadDocument(
    ref: DocRef,
    opts: { draft: boolean; locale?: Opt<string>; depth?: Opt<number> },
  ): Promise<Doc>
  /** Save fields to the rolling draft. `updatedAt` enables stale-write detection. */
  saveDraft(
    ref: DocRef,
    data: Doc,
    opts: { locale?: Opt<string>; updatedAt?: Opt<string> },
  ): Promise<SaveResult>
  /** Make the given values live. */
  publish(
    ref: DocRef,
    data: Doc,
    opts: { locale?: Opt<string>; updatedAt?: Opt<string> },
  ): Promise<SaveResult>
  /** Find documents to link to (relationship fields), by their title field. Optional. */
  search?(
    collection: string,
    opts: {
      query?: Opt<string>
      titleField?: Opt<string>
      locale?: Opt<string>
      limit?: Opt<number>
    },
  ): Promise<SearchHit[]>
  /** Create a read-only preview link for a document. Optional. */
  createPreviewLink?(ref: DocRef, opts: { locale?: Opt<string> }): Promise<PreviewLink>
}

export interface PreviewLink {
  url: string
  expiresAt: string
  id?: string
}

export interface SearchHit {
  id: string | number
  title: string
  /** The document, so a client-rendered page can show it before saving. */
  doc: Doc
}

export interface MediaItem {
  id: string | number
  url?: string | null
  thumbnailUrl?: string | null
  alt?: string | null
  filename?: string | null
  /** The full document, stored in draft state so the page can render it. */
  doc: Doc
}

export interface MediaLibrary {
  search(opts: {
    query?: Opt<string>
    page?: Opt<number>
    relationTo: string
  }): Promise<{ items: MediaItem[]; hasMore: boolean }>
  upload?(file: File, opts: { relationTo: string; alt?: Opt<string> }): Promise<MediaItem>
}

/**
 * What a page element shows: a field (`text`/`textarea`/`richtext`/`media` are
 * the kinds auto-mapping markers carry; `field` = resolve from the schema), a
 * row of an array/blocks field (`item`), or the element holding a list (`list`).
 */
/** What a page element shows: a marker's kind, or an annotation's field / row item / list. */
export const TARGET_KINDS = [...MARKER_KINDS, 'field', 'item', 'list'] as const
export type TargetKind = (typeof TARGET_KINDS)[number]
export const isTargetKind = (value: unknown): value is TargetKind =>
  (TARGET_KINDS as readonly unknown[]).includes(value)

export interface Target {
  el: Element
  ref: DocRef
  path: string
  kind: TargetKind
  label?: Opt<string>
  /** Which locator produced it ("annotation" wins over inferred ones). */
  /** Which locator found it. */
  source: 'annotation' | 'stega' | (string & {})
}

export interface Locator {
  name: string
  /** Find every target under `root`. Called on mount and after DOM changes. */
  scan(root: ParentNode): Target[]
}

export interface Renderer {
  name: string
  /**
   * Called after edits have been saved. `refresh` mode re-renders the page
   * from the server; `client` mode renders from session state and needs no work.
   */
  afterSave(info: { refs: DocRef[] }): void | Promise<void>
  /** Whether the page re-renders from session state immediately (no save round-trip needed to see edits). */
  live: boolean
}

export const ONPAGE_MODES = ['edit', 'view'] as const
export type OnPageMode = (typeof ONPAGE_MODES)[number]
export const isOnPageMode = (value: unknown): value is OnPageMode =>
  (ONPAGE_MODES as readonly unknown[]).includes(value)

/**
 * Server side: turns a browser's edit/preview access on and off. Framework
 * specific (`nextSession()` for Next.js).
 */
export interface SessionAdapter {
  /**
   * Signed-in editors: site-wide draft mode in edit or view mode. `bindTo` names
   * the auth cookie the mode is bound to, so signing out (or in as someone else)
   * ends it.
   */
  enable(mode: OnPageMode, opts: { secure: boolean; bindTo?: string }): Promise<void>
  /**
   * Preview links: read-only draft access to one page until `expiresAt`. The
   * adapter passes the framework's draft secret to `seal`, and stores only the
   * sealed result, so the browser never holds a usable draft credential.
   */
  enableLink(opts: {
    secure: boolean
    path: string
    expiresAt: Date
    seal: (draftSecret: string) => Promise<string>
  }): Promise<void>
  disable(): Promise<void>
  getMode(): Promise<OnPageMode | null>
}
