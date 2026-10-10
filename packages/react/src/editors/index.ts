/** The default field editors. Spread, override or remove (`null`) entries via the `editors` option. */
import type { EditorRegistry } from '../context.tsx'
import { CheckboxEditor, ColorEditor, DateEditor, NumberEditor, SelectEditor } from './basic.tsx'
import { InlineText } from './InlineText.tsx'
import { RelationshipEditor } from './Relationship.tsx'
import { UploadEditor } from './Upload.tsx'

export const defaultEditors: EditorRegistry = {
  text: { mode: 'inline', component: InlineText },
  textarea: { mode: 'inline', component: InlineText },
  email: { mode: 'inline', component: InlineText },
  select: { mode: 'popover', component: SelectEditor },
  radio: { mode: 'popover', component: SelectEditor },
  checkbox: { mode: 'popover', component: CheckboxEditor },
  number: { mode: 'popover', component: NumberEditor },
  date: { mode: 'popover', component: DateEditor },
  relationship: { mode: 'popover', component: RelationshipEditor },
  upload: { mode: 'popover', component: UploadEditor },
  color: { mode: 'popover', component: ColorEditor },
}

export {
  InlineText,
  SelectEditor,
  CheckboxEditor,
  NumberEditor,
  DateEditor,
  ColorEditor,
  RelationshipEditor,
  UploadEditor,
}
export { Popover } from './Popover.tsx'
