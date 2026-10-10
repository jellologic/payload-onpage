'use client'

/**
 * Client mode: render a document from editor state, so edits show instantly
 * (no save → server render round trip). Outside an editor it just renders the
 * document it was given.
 *
 *   <OnPageClient doc={page} collection="pages" render={(page, e) => <Page page={page} e={e} />} />
 *
 * `e` is the document's annotation helper (`e.field('title')`, `e.row('layout.0')`).
 * Text is auto-mapped as in refresh mode: the rendered state carries the same
 * invisible markers (turn off with `autoMap={false}`).
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { encodeDocument, refKey } from '@payload-onpage/core'
import { editable, toRef, type Editable, type EditableTarget } from './annotations.ts'
import { useOnPageOptional } from './context.tsx'

export type OnPageClientProps<T> = {
  doc: T
  render: (doc: T, e: Editable) => ReactNode
  /** Mark rendered text so it maps to its fields without annotations. Default true. */
  autoMap?: boolean
} & ({ collection: string; global?: never } | { global: string; collection?: never })

export function OnPageClient<T extends { id?: string | number } | null | undefined>(
  props: OnPageClientProps<T>,
) {
  const { doc, render } = props
  const ctx = useOnPageOptional()
  const target: EditableTarget | null = props.global
    ? { global: props.global }
    : props.collection
      ? { collection: props.collection, doc }
      : null
  const ref = target ? toRef(target) : null
  const key = ref ? refKey(ref) : null
  const enabled = !!ctx && !!key

  useEffect(() => {
    if (!ctx || !ref || !key) return
    const off = ctx.registerClientDoc(key)
    void ctx.session.open(ref, (doc ?? undefined) as Record<string, unknown> | undefined)
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  const state = key ? ctx?.snap.docs[key] : undefined
  const autoMap = props.autoMap !== false
  const current = useMemo(() => {
    if (!state?.doc) return doc
    return autoMap && state.schema && key
      ? encodeDocument(state.doc, state.schema.fields, key)
      : state.doc
  }, [state?.doc, state?.schema, key, autoMap, doc])
  const e = useMemo(
    () => (ref ? editable(ref, { enabled }) : editable({ global: '' }, { enabled: false })),
    [key, enabled],
  ) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{render(current as T, e)}</>
}
