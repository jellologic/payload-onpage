/** The default field editors. Spread, override or remove (`null`) entries via the `editors` option. */
import type { EditorRegistry } from '../types.ts'
import { CheckboxEditor } from './CheckboxEditor.tsx'
import { ColorEditor } from './ColorEditor.tsx'
import { DateEditor } from './DateEditor.tsx'
import { InlineText } from './InlineText.tsx'
import { NumberEditor } from './NumberEditor.tsx'
import { RelationshipEditor } from './RelationshipEditor.tsx'
import { SelectEditor } from './SelectEditor.tsx'
import { UploadEditor } from './UploadEditor.tsx'

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
  CheckboxEditor,
  ColorEditor,
  DateEditor,
  InlineText,
  NumberEditor,
  RelationshipEditor,
  SelectEditor,
  UploadEditor,
}
