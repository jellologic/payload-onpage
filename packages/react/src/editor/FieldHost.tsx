'use client'

import { fieldAtPath, getAt } from '@payload-onpage/core'
import { useCallback } from 'react'
import { useOnPage } from '../context.tsx'
import type { FieldEditorProps } from '../types.ts'

/** Renders the open field editor, if it belongs to this layer. */
export function FieldHost({ mode }: { mode: 'inline' | 'popover' }) {
  const { editing, editors, session, snap, targets, setEditing, addGhost, isLive, t } = useOnPage()
  const def = editing ? editors[editing.editor] : undefined
  const state = editing ? snap.docs[editing.key] : undefined
  const key = editing?.key ?? ''
  const path = editing?.path ?? ''
  const live = isLive(key)
  const clicked = editing?.el

  const element = useCallback(
    () => (clicked?.isConnected ? clicked : (targets.find(key, path)?.el ?? null)),
    [clicked, targets, key, path],
  )
  const close = useCallback(() => {
    session.cancelTransient(key)
    setEditing(null)
  }, [session, key, setEditing])
  const commit = useCallback(
    (value: unknown) => {
      session.setValue(key, path, value)
      if (!live) void session.flush() // refresh mode: show it as soon as possible
    },
    [session, key, path, live],
  )
  const preview = useCallback(
    (value: unknown) => session.setValue(key, path, value, { transient: true }),
    [session, key, path],
  )
  const ghost = useCallback<FieldEditorProps['ghost']>(
    (g) => addGhost({ key, path, ...g }),
    [addGhost, key, path],
  )

  if (!editing || !def || def.mode !== mode || !state?.schema || !state.doc) return null
  const field = fieldAtPath(state.schema.fields, state.doc, path)?.field
  if (!field) return null
  const Editor = def.component
  return (
    <Editor
      key={`${key}|${path}`}
      docKey={key}
      path={path}
      field={field}
      element={element}
      value={getAt(state.doc, path)}
      commit={commit}
      preview={preview}
      close={close}
      ghost={ghost}
      live={live}
      point={editing.point}
      t={t}
    />
  )
}
