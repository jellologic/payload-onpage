'use client'

import { createContext, useContext, useSyncExternalStore, type ComponentType } from 'react'
import type {
  DocRef,
  EditorSession,
  MediaLibrary,
  Renderer,
  SchemaField,
  SessionSnapshot,
  Target,
} from '@payload-onpage/core'
import { hub } from './hub.ts'

export interface EditingState {
  key: string // refKey
  path: string
  /** Editor id from the registry (e.g. "text", "richText"). */
  editor: string
  point?: { x: number; y: number }
  /** The element that was clicked (several elements may show one field). */
  el?: Element
}

export type Panel =
  | { kind: 'settings'; key: string; path: string; title: string }
  | { kind: 'blocks'; key: string; listPath: string; index: number }
  | null

export interface Selection {
  key: string
  path: string
}

/** Props every field editor receives. */
export interface FieldEditorProps {
  docKey: string
  path: string
  field: SchemaField
  /** The element showing the field (re-resolved after each refresh). */
  element: () => Element | null
  value: unknown
  /** Commit a value (one undo step, autosaved). */
  commit: (value: unknown) => void
  /** Live preview while editing (no history entry, not saved). */
  preview: (value: unknown) => void
  /** Close the editor (after commit, or to cancel: transient previews are reverted). */
  close: () => void
  /** Leave a stand-in showing the new content until the page re-renders (refresh mode). */
  ghost: (g: { html: string; className?: string; style?: Partial<CSSStyleDeclaration> }) => void
  /** True when the page renders this document from editor state (instant); false = server refresh. */
  live: boolean
  point?: { x: number; y: number }
}

/**
 * A field editor (the FieldEditor port). `inline` editors replace the element
 * in place (text, rich text); `popover` editors open next to it (select, date,
 * relationship, image…). Register your own by id and refer to it from a field
 * with `admin: { custom: { onpage: { editor: 'my-id' } } }`, or by field type
 * ("json", "code"…) to replace or add a default.
 */
export interface FieldEditorDef {
  /** inline: replaces the element in place; popover: opens beside it. */
  mode: 'inline' | 'popover'
  component: ComponentType<FieldEditorProps>
}

export type EditorRegistry = Record<string, FieldEditorDef>

export interface Links {
  /** Leave edit/preview mode. */
  exit: string
  /** Open a document in the admin. */
  admin?: (ref: DocRef) => string
  /** Switch this page between editing and previewing (signed-in editors). */
  mode?: (mode: 'edit' | 'view') => string
  /** Create a shareable read-only link for a document. */
  previewLink?: (ref: DocRef) => Promise<{ url: string; expiresAt?: string }>
}

export interface TargetIndex {
  all: Target[]
  /** Targets whose element is exactly `el`. */
  at: (el: Element) => Target[]
  find: (key: string, path: string, kinds?: Target['kind'][]) => Target | undefined
}

export interface Ghost {
  id: string
  created: number
  key: string
  path: string
  html: string
  style?: Partial<CSSStyleDeclaration>
  className?: string
  /** Removed when the renderer reports the page re-rendered, or at this time. */
  until: number
}

export interface OnPageContextValue {
  session: EditorSession
  snap: SessionSnapshot
  mode: 'edit' | 'view'
  renderer: Renderer
  media: MediaLibrary
  editors: EditorRegistry
  targets: TargetIndex
  links: Links
  panel: Panel
  setPanel: (p: Panel) => void
  editing: EditingState | null
  setEditing: (e: EditingState | null) => void
  selected: Selection | null
  setSelected: (s: Selection | null) => void
  /** Is this document rendered from session state (client mode)? */
  isLive: (key: string) => boolean
  /** Client-mode documents register here (they don't need a server refresh). */
  registerClientDoc: (key: string) => () => void
  addGhost: (g: Omit<Ghost, 'id' | 'until' | 'created'>) => void
  ghosts: Ghost[]
  /** Documents shown on the current page (the session may hold others from earlier pages). */
  docKeys: string[]
  /** The page is re-rendering after a save (refresh mode). */
  rendering: boolean
  /** Open the right editor for a field (registry resolution); returns false if none applies. */
  edit: (
    key: string,
    path: string,
    opts?: { point?: { x: number; y: number }; kind?: Target['kind']; anchor?: Element },
  ) => boolean
  /** Show a short message in the dock. */
  notify: (text: string, bad?: boolean) => void
}

export const OnPageContext = createContext<OnPageContextValue | null>(null)

export function useOnPage(): OnPageContextValue {
  const ctx = useContext(OnPageContext)
  if (!ctx) throw new Error('useOnPage must be used inside <OnPageEditor>')
  return ctx
}

const getNull = () => null

/** The editor, from inside it or anywhere on the page; null when no editor is mounted (public pages). */
export function useOnPageOptional(): OnPageContextValue | null {
  const inside = useContext(OnPageContext)
  const outside = useSyncExternalStore(hub.subscribe, hub.get, getNull)
  return inside ?? outside
}
