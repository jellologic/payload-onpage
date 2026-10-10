'use client'

import { fieldAtPath, insertItem, newBlockRow, updateArray } from '@payload-onpage/core'
import { useOnPage } from '../context.tsx'
import { Dialog } from './Dialog.tsx'

/** Choose a block type to insert at a position in a blocks field. */
export function BlockPicker() {
  const { panel, setPanel, snap, session, setSelected, t } = useOnPage()
  if (panel?.kind !== 'blocks') return null
  const state = snap.docs[panel.key]
  if (!state?.schema || !state.doc) return null
  const { key, listPath, index } = panel
  const field = fieldAtPath(state.schema.fields, state.doc, listPath)?.field
  const blocks = field?.type === 'blocks' ? (field.blocks ?? []) : []

  const choose = (slug: string) => {
    const block = blocks.find((b) => b.slug === slug)
    if (!block) return
    session.apply(key, (d) =>
      updateArray(d, listPath, (a) => insertItem(a, index, newBlockRow(block))),
    )
    setPanel(null)
    setSelected({ key, path: `${listPath}.${index}` })
  }

  return (
    <Dialog
      title={t('blocks.title')}
      onClose={() => setPanel(null)}
      t={t}
      width={640}
      testId="onpage-block-picker"
    >
      <div className="po-blocks">
        {blocks.map((b) => (
          <button
            key={b.slug}
            type="button"
            onClick={() => choose(b.slug)}
            data-testid={`onpage-block-${b.slug}`}
          >
            {b.labels.singular}
          </button>
        ))}
      </div>
    </Dialog>
  )
}
