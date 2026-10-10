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
import type { DocumentSchema } from './schema.ts'

export type Doc = Record<string, unknown>

export interface SaveResult {
  ok: boolean
  /** HTTP-like status on failure; 409 means someone else saved first. */
  status?: number
  message?: string
  /** The document's new `updatedAt` after a successful save. */
  updatedAt?: string
}

export interface DataSource {
  loadSchema(ref: DocRef, opts: { locale?: string }): Promise<DocumentSchema>
  loadDocument(ref: DocRef, opts: { draft: boolean; locale?: string; depth?: number }): Promise<Doc>
  /** Save fields to the rolling draft. `updatedAt` enables stale-write detection. */
  saveDraft(
    ref: DocRef,
    data: Doc,
    opts: { locale?: string; updatedAt?: string },
  ): Promise<SaveResult>
  /** Make the given values live. */
  publish(
    ref: DocRef,
    data: Doc,
    opts: { locale?: string; updatedAt?: string },
  ): Promise<SaveResult>
  /** Find documents to link to (relationship fields), by title. Optional. */
  search?(
    collection: string,
    opts: { query?: string; locale?: string; limit?: number },
  ): Promise<SearchHit[]>
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
    query?: string
    page?: number
    relationTo: string
  }): Promise<{ items: MediaItem[]; hasMore: boolean }>
  upload?(file: File, opts: { relationTo: string; alt?: string }): Promise<MediaItem>
}

/** Field-level editing kinds a target can declare. */
export type TargetKind =
  'text' | 'textarea' | 'richtext' | 'media' | 'field' | 'block' | 'item' | 'list'

export interface Target {
  el: Element
  ref: DocRef
  path: string
  kind: TargetKind
  label?: string
  /** Which locator produced it ("annotation" wins over inferred ones). */
  source: string
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

export type OnPageMode = 'edit' | 'view'

/** Server side: turns a request's edit/preview mode on and off (framework-specific). */
export interface SessionAdapter {
  /**
   * `path` (preview links): scope the mode to that page only, so a shared link
   * doesn't open every draft on the site.
   */
  enable(mode: OnPageMode, opts: { secure: boolean; path?: string }): Promise<void>
  /** `path`: the page being left (preview-link cookies are scoped to it). */
  disable(opts?: { path?: string }): Promise<void>
  getMode(): Promise<OnPageMode | null>
}
