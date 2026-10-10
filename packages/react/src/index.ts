/**
 * @payload-onpage/react — the on-page editor UI.
 *
 *   <OnPageEditor dataSource={payloadRest()} links={{ exit: '/api/onpage/exit' }} />
 *
 * Framework adapters (e.g. @payload-onpage/next) mount this for you.
 */
export { OnPageEditor, type OnPageEditorProps } from './OnPageEditor.tsx'
export { OnPageClient, type OnPageClientProps } from './OnPageClient.tsx'
export {
  PreviewToolbar,
  inPreviewFrame,
  FRAME_PARAM,
  type PreviewToolbarProps,
} from './PreviewToolbar.tsx'
export { useOnPage, useOnPageOptional, OnPageContext } from './context.tsx'
export type {
  EditorRegistry,
  FieldEditorDef,
  FieldEditorProps,
  Links,
  OnPageContextValue,
  TargetIndex,
  Panel,
  EditingState,
  Selection,
  Ghost,
} from './context.tsx'
export {
  defaultEditors,
  Popover,
  InlineText,
  SelectEditor,
  CheckboxEditor,
  NumberEditor,
  DateEditor,
  ColorEditor,
  RelationshipEditor,
  UploadEditor,
} from './editors/index.ts'
export { resolveEditor, mergeEditors } from './registry.ts'
export { annotations, stega, composite, rowPrefixes } from './locators.ts'
export {
  editable,
  editableOff,
  p,
  ATTR,
  type Editable,
  type EditableTarget,
  type FieldKind,
} from './annotations.ts'
export { clientState, fullReload } from './renderers.ts'
export { buildIndex } from './targets.ts'
export {
  HIDDEN,
  UI,
  copyTypography,
  placeOver,
  placeCaret,
  caretAt,
  useEachFrame,
  useFrame,
} from './dom.ts'
export { injectStyles, PO_CSS, PO_Z } from './styles.ts'
