/** Public types of the editor UI. */
import type { ComponentType } from 'react'
import type {
  DocRef,
  EditorSession,
  MediaLibrary,
  Renderer,
  SchemaField,
  SchemaFieldType,
  SessionSnapshot,
  Target,
  TargetKind,
  RefKey,
} from '@payload-onpage/core'
import type { MessageKey, Translate } from './messages.ts'

export interface EditingState {
  /** refKey of the document */
  key: RefKey
  path: string
  /** Editor id from the registry ("text", "richText", …). */
  editor: string
  point?: { x: number; y: number } | undefined
  /** The element that was clicked (several elements may show one field). */
  el?: Element | undefined
}

export type Panel =
  | { kind: 'settings'; key: RefKey; path: string; title: string }
  | { kind: 'blocks'; key: RefKey; listPath: string; index: number }
  | null

export interface Selection {
  key: RefKey
  path: string
}

/**
 * Props a field editor receives. `F` is the field kind it edits (e.g.
 * `NumberField`, with `min`/`max`) and `V` its value after `normalize`.
 */
export interface FieldEditorProps<F extends SchemaField = SchemaField, V = unknown> {
  docKey: RefKey
  path: string
  field: F
  /** The element showing the field (re-resolved after each refresh). */
  element: () => Element | null
  value: V
  /** Commit a value (one undo step, autosaved). */
  commit: (value: unknown) => void
  /** Live preview while editing (no history entry, not saved). */
  preview: (value: unknown) => void
  /** Close the editor (after commit, or to cancel: transient previews are reverted). */
  close: () => void
  /** Leave a stand-in showing the new content until the page re-renders (refresh mode). */
  ghost: (g: GhostInput) => void
  /** True when the page renders this document from editor state (instant); false = server refresh. */
  live: boolean
  point?: { x: number; y: number } | undefined
  /** UI strings. */
  t: Translate
}

/** What an editor leaves on the page until it re-renders. */
export interface GhostInput {
  html: string
  className?: string | undefined
  style?: Partial<CSSStyleDeclaration> | undefined
}

/**
 * A field editor (the FieldEditor port). `inline` editors replace the element
 * in place (text, rich text); `popover` editors open beside it or as a dialog
 * (select, date, relationship, image…). Register your own by id and refer to it
 * from a field with `admin: { custom: { onpage: { editor: 'my-id' } } }`, or by
 * field type ("json", "code"…) to replace or add a default. Build one with
 * `defineEditor()` so its props are typed by the field kinds it accepts.
 */
export interface FieldEditorDef {
  mode: 'inline' | 'popover'
  /** Field types it can edit. The registry never hands it any other kind. Default: any. */
  accepts?: readonly SchemaFieldType[]
  /** The raw stored value → the editor's value. Default: passed through. */
  normalize?: (raw: unknown, field: SchemaField) => unknown
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
  find: (key: RefKey, path: string, kinds?: TargetKind[]) => Target | undefined
}

/** What extensions and field editors can use from the editor (`useOnPage()`). */
/** A short message shown in the dock. */
export interface Flash {
  text: string
  bad?: boolean | undefined
}

export interface OnPageContextValue {
  session: EditorSession
  snap: SessionSnapshot
  renderer: Renderer
  media?: MediaLibrary | undefined
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
  docKeys: RefKey[]
  /** Is this document rendered from session state (client mode)? */
  isLive: (key: RefKey) => boolean
  /** Client-mode documents register here (they don't need a server refresh). */
  registerClientDoc: (key: RefKey) => () => void
  /** The page is re-rendering after a save (refresh mode). */
  rendering: boolean
  /** Open the right editor for a field (registry resolution); false if none applies. */
  edit: (
    key: RefKey,
    path: string,
    opts?: {
      point?: { x: number; y: number } | undefined
      kind?: TargetKind | undefined
      anchor?: Element | undefined
    },
  ) => boolean
  /** Re-render documents after an operation outside autosave (publish, reload). */
  rerender: (refs: DocRef[]) => Promise<void>
  /** Show a short message in the dock. */
  notify: (
    key: MessageKey | (string & {}),
    vars?: Record<string, string | number>,
    bad?: boolean,
  ) => void
  addGhost: (g: GhostInput & { key: RefKey; path: string }) => void
}
