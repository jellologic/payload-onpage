# Custom field editor

A field editor is a React component receiving `FieldEditorProps`, registered by id.

```tsx
'use client'
import { Dialog, type FieldEditorProps } from '@payload-onpage/react/editor-kit'
import { useState } from 'react'

export function JsonEditor({ field, value, element, commit, close, t }: FieldEditorProps) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    try {
      commit(JSON.parse(text))
      close()
    } catch {
      setError('Invalid JSON')
    }
  }
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      width={360}
    >
      <textarea
        className="po-input"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-autofocus
      />
      {error && <p className="po-error">{error}</p>}
      <button type="button" className="po-btn po-primary" onClick={apply}>
        {t('common.apply')}
      </button>
    </Dialog>
  )
}
```

Register it from a client mount, and pass that mount to `<OnPage>`:

```tsx
'use client'
import { OnPageMount, type OnPageMountProps } from '@payload-onpage/next/client'
import { JsonEditor } from './JsonEditor'

export const Mount = (p: OnPageMountProps) => (
  <OnPageMount {...p} editors={{ json: { mode: 'popover', component: JsonEditor } }} />
)
```

```tsx
<OnPage mount={Mount} />
```

## Which editor a field gets

1. `admin: { custom: { onpage: { editor: 'json' } } }` on the field
2. The kind the element declares (`text`/`textarea`/`richtext`/`media`)
3. The editor registered for the field's type (`json`, `select`…)

`null` removes a default (`editors={{ color: null }}`).

## Props

| Prop              |                                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| `field`           | Serialized field (label, options, relationTo, min/max…)                |
| `value`           | Current value                                                          |
| `commit(v)`       | Save a value: one undo step, autosaved                                 |
| `preview(v)`      | Live preview (client mode); not saved                                  |
| `close()`         | Close; reverts uncommitted previews                                    |
| `element()`       | The page element showing the field (anchor, measurements)              |
| `ghost({ html })` | Refresh mode: keep new content on screen until the server render lands |
| `live`            | true when the page renders from editor state                           |
| `t(key, vars)`    | UI strings                                                             |

`editor-kit` also exports `useOnPage`, `useDebouncedSearch`, `useTrackElement`, `placeOver`, `copyTypography`, `sanitizeHtml` and friends.
