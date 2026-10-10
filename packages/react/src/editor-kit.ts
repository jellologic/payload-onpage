/**
 * @payload-onpage/react/editor-kit — building blocks for custom field editors
 * (the default editors and @payload-onpage/lexical use exactly these).
 *
 *   function JsonEditor({ field, value, element, commit, close, t }: FieldEditorProps) {
 *     return <Dialog variant="popover" anchor={element} title={field.label} onClose={close} t={t}>…</Dialog>
 *   }
 */
export { Dialog, type DialogProps } from './ui/Dialog.tsx'
export { useOnPage } from './context.tsx'
export { useDebouncedSearch } from './editors/useDebouncedSearch.ts'
export { escapeHtml } from './editors/InlineText.tsx'
export {
  HIDDEN,
  UI,
  caretAt,
  copyTypography,
  placeCaret,
  placeOver,
  typographyOf,
  popoverPosition,
} from './dom.ts'
export { useTrackElement, useLayoutTick, notifyLayout } from './layout.ts'
export { sanitizeHtml } from './sanitize.ts'
export type { EditorRegistry, FieldEditorDef, FieldEditorProps } from './types.ts'
export type { Translate } from './messages.ts'
