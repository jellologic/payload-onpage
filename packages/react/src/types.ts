/** Public types of the editor UI. */
import type { ComponentType } from 'react'
import type {
  DocRef,
  EditorSession,
  MediaLibrary,
  Renderer,
  SchemaField,
  SessionSnapshot,
  Target,
  TargetKind,
} from '@payload-onpage/core'
import type { MessageKey, Translate } from './messages.ts'

export interface EditingState {
  /** refKey of the document */
  key: string
  path: string
  /** Editor id from the registry ("text", "richText", …). */
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
  /** UI strings. */
  t: Translate
}

/**
 * A field editor (the FieldEditor port). `inline` editors replace the element
 * in place (text, rich text); `popover` editors open beside it or as a dialog
 * (select, date, relationship, image…). Register your own by id and refer to it
 * from a field with `admin: { custom: { onpage: { editor: 'my-id' } } }`, or by
 * field type ("json", "code"…) to replace or add a default.
 */
export interface FieldEditorDef {
  mode: 'inline' | 'popover'
  component: ComponentType<FieldEditorProps>
}

export type EditorRegistry = Record<string, FieldEditorDef>

/** Navigation targets. `exit` and `mode` are endpoints the editor POSTs to. */
export interface Links {
  exit: string
  admin?: (ref: DocRef) => string
  mode?: (mode: 'edit' | 'view') => string
}

export interface TargetIndex {
  all: Target[]
  /** Targets whose element is exactly `el`. */
  at: (el: Element) => Target[]
  find: (key: string, path: string, kinds?: TargetKind[]) => Target | undefined
}

/** What extensions and field editors can use from the editor (`useOnPage()`). */
export interface OnPageContextValue {
  session: EditorSession
  snap: SessionSnapshot
  renderer: Renderer
  media?: MediaLibrary
  editors: EditorRegistry
  targets: TargetIndex
  links: Links
  t: Translate
  panel: Panel
  setPanel: (p: Panel) => void
  editing: EditingState | null
  setEditing: (e: EditingState | null) => void
  selected: Selection | null
  setSelected: (s: Selection | null) => void
  /** Documents shown on the current page (the session may hold others from earlier pages). */
  docKeys: string[]
  /** Is this document rendered from session state (client mode)? */
  isLive: (key: string) => boolean
  /** Client-mode documents register here (they don't need a server refresh). */
  registerClientDoc: (key: string) => () => void
  /** The page is re-rendering after a save (refresh mode). */
  rendering: boolean
  /** Open the right editor for a field (registry resolution); false if none applies. */
  edit: (
    key: string,
    path: string,
    opts?: { point?: { x: number; y: number }; kind?: TargetKind; anchor?: Element },
  ) => boolean
  /** Re-render documents after an operation outside autosave (publish, reload). */
  rerender: (refs: DocRef[]) => Promise<void>
  /** Show a short message in the dock. */
  notify: (
    key: MessageKey | (string & {}),
    vars?: Record<string, string | number>,
    bad?: boolean,
  ) => void
  addGhost: (g: {
    key: string
    path: string
    html: string
    className?: string
    style?: Partial<CSSStyleDeclaration>
  }) => void
}
