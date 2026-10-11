'use client'

/**
 * The on-page editor. Mount it once (the Next adapter's <OnPage /> does) and
 * it finds editable content through the Locator, opens each document it finds
 * in an EditorSession, and edits through the field-editor registry. Saves go
 * through the DataSource; the Renderer shows them (server refresh by default,
 * instant for documents rendered with <OnPageClient>).
 */
import { useEvent } from '../useEvent.ts'
import {
  EditorSession,
  fieldAtPath,
  isEditablePath,
  refKey,
  type DataSource,
  type DocRef,
  type Locator,
  type MediaLibrary,
  type Renderer,
  type SessionSnapshot,
} from '@payload-onpage/core'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { OnPageContext } from '../context.tsx'
import { UI } from '../dom.ts'
import { defaultEditors } from '../editors/index.ts'
import { hub } from '../hub.ts'
import { notifyLayout } from '../layout.ts'
import { annotations, composite, stega } from '../locators.ts'
import { createTranslate, type Messages } from '../messages.ts'
import { mergeEditors, resolveEditor } from '../registry.ts'
import { clientState } from '../renderers.ts'
import { useEditorStyles, useIsClient } from '../useIsClient.ts'
import { useTargets } from '../targets.ts'
import type {
  EditingState,
  EditorRegistry,
  FieldEditorDef,
  Links,
  OnPageContextValue,
  Panel,
  Selection,
} from '../types.ts'
import { BlockPicker } from '../ui/BlockPicker.tsx'
import { Dock } from '../ui/Dock.tsx'
import { Overlay } from '../ui/Overlay.tsx'
import { SettingsPanel } from '../ui/SettingsPanel.tsx'
import { FieldHost } from './FieldHost.tsx'
import { Ghosts } from './Ghosts.tsx'
import { usePageEvents } from './usePageEvents.ts'
import { useGhosts } from './useGhosts.ts'

export interface OnPageEditorProps {
  dataSource: DataSource
  /** Image search/upload (e.g. `payloadUploads()`). Without it, upload fields can't be changed. */
  media?: MediaLibrary
  /** How elements map to fields. Default: composite(annotations(), stega()). */
  locator?: Locator
  /** How saved changes reach the page. Default: clientState() (no server refresh). */
  renderer?: Renderer
  /** Extra or replacement field editors by id; `null` removes a default. */
  editors?: Record<string, FieldEditorDef | null>
  links: Links
  /** Content locale to edit. */
  locale?: string
  /** Autosave debounce, ms. Default: 250 with a refreshing renderer; else the collection's autosave interval, else 800. */
  autosaveDelay?: number
  /** Where to look for editable content. Default: document.body. */
  root?: () => ParentNode | null
  /** Override any UI string (see `defaultMessages`). */
  messages?: Messages
}

const EMPTY_SNAP: SessionSnapshot = { docs: {}, canUndo: false, canRedo: false, busy: false }
const noopSubscribe = () => () => {}

export function OnPageEditor(props: OnPageEditorProps) {
  const { dataSource, locale, autosaveDelay, links, media } = props
  const renderer = useMemo(() => props.renderer ?? clientState(), [props.renderer])
  const locator = useMemo(() => props.locator ?? composite(annotations(), stega()), [props.locator])
  const editors: EditorRegistry = useMemo(
    () => mergeEditors(defaultEditors, props.editors),
    [props.editors],
  )
  const t = useMemo(() => createTranslate(props.messages), [props.messages])
  const rootProp = props.root
  const root = useCallback(
    () => (rootProp ? rootProp() : typeof document === 'undefined' ? null : document.body),
    [rootProp],
  )

  const [panel, setPanel] = useState<Panel>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [renders, setRenders] = useState(0)
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null)
  const [clientDocs, setClientDocs] = useState<ReadonlySet<string>>(() => new Set())
  const [session, setSession] = useState<EditorSession | null>(null)
  const snap = useSyncExternalStore(
    session?.subscribe ?? noopSubscribe,
    session?.getSnapshot ?? (() => EMPTY_SNAP),
    () => EMPTY_SNAP,
  )
  const targets = useTargets(locator, root)
  const { ghosts, add: addGhostEntry, rendered: ghostsRendered } = useGhosts(session ? snap : null)

  const isLive = useCallback(
    (key: string) => renderer.live || clientDocs.has(key),
    [renderer, clientDocs],
  )

  // Pending "retire ghosts" timers, cleared on unmount.
  const ghostTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = ghostTimers.current
    return () => {
      for (const id of timers) clearTimeout(id)
      timers.clear()
    }
  }, [])

  /** Re-render documents that aren't client-rendered, then retire their ghosts. */
  const rerender = useCallback(
    async (refs: DocRef[], seq?: number) => {
      const stale = refs.filter((r) => !isLive(refKey(r)))
      if (!stale.length) return
      setRenders((n) => n + 1)
      try {
        await renderer.afterSave({ refs: stale })
      } catch (e) {
        console.error('[payload-onpage] render after save failed', e)
      } finally {
        setRenders((n) => n - 1)
        // Give the new DOM a moment to land (and the locator to rescan) before uncovering it.
        const id = setTimeout(() => {
          ghostTimers.current.delete(id)
          for (const r of stale) ghostsRendered(refKey(r), seq ?? Number.MAX_SAFE_INTEGER)
        }, 250)
        ghostTimers.current.add(id)
      }
    },
    [isLive, renderer, ghostsRendered],
  )

  const handleSaved = useEvent((ref: DocRef, seq: number) => void rerender([ref], seq))

  // One session per data source and locale; disposed (after flushing) when they change or on unmount.
  useEffect(() => {
    // Refresh mode saves quickly (the page only updates after a save); client mode uses the collection's interval.
    const delay = autosaveDelay ?? (renderer.live ? undefined : 250)
    const s = new EditorSession({
      dataSource,
      locale,
      autosaveDelay: delay,
      onSaved: (ref, seq) => handleSaved(ref, seq),
    })
    // The session is an external resource with a lifecycle; it lives in state so StrictMode's
    // mount/unmount/mount gets a fresh one each time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(s)
    return () => {
      void s.flush().finally(() => s.dispose())
    }
  }, [dataSource, locale, autosaveDelay, renderer.live, handleSaved])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(id)
  }, [flash])

  // Documents on this page: everything the locator found, plus client-mode documents.
  const docKeys = useMemo(() => {
    const keys = new Set<string>(clientDocs)
    for (const target of targets.all) keys.add(refKey(target.ref))
    return [...keys]
  }, [targets, clientDocs])

  useEffect(() => {
    if (!session) return
    const seen = new Set<string>()
    for (const target of targets.all) {
      const k = refKey(target.ref)
      if (seen.has(k)) continue
      seen.add(k)
      void session.open(target.ref)
    }
  }, [targets, session])

  useEffect(() => notifyLayout(), [snap, targets])

  const notify = useCallback<OnPageContextValue['notify']>(
    (key, vars, bad) => setFlash({ text: t(key, vars), bad }),
    [t],
  )

  const registerClientDoc = useCallback((key: string) => {
    setClientDocs((s) => new Set(s).add(key))
    return () =>
      setClientDocs((s) => {
        const next = new Set(s)
        next.delete(key)
        return next
      })
  }, [])

  const addGhost = useCallback<OnPageContextValue['addGhost']>(
    (g) => addGhostEntry(g, session?.get(g.key)?.save.seq ?? 0),
    [addGhostEntry, session],
  )

  const edit = useCallback<OnPageContextValue['edit']>(
    (key, path, opts = {}) => {
      const state = session?.get(key)
      if (!state?.schema || !state.doc) {
        if (state?.status === 'error')
          notify('notify.cantEdit', { message: state.error ?? '' }, true)
        else notify('notify.loading')
        return true
      }
      if (!isEditablePath(state.schema, path)) return false
      const hit = fieldAtPath(state.schema.fields, state.doc, path)
      if (!hit) return false
      const editor = resolveEditor(
        editors,
        hit.field,
        opts.kind === 'field' ? undefined : opts.kind,
      )
      if (!editor) return false
      setEditing({
        key,
        path,
        editor,
        point: opts.point,
        el: opts.anchor ?? targets.find(key, path)?.el,
      })
      return true
    },
    [session, editors, targets, notify],
  )

  const ctx = useMemo<OnPageContextValue | null>(
    () =>
      session && {
        session,
        snap,
        renderer,
        media,
        editors,
        targets,
        links,
        t,
        panel,
        setPanel,
        editing,
        setEditing,
        selected,
        setSelected,
        docKeys,
        isLive,
        registerClientDoc,
        rendering: renders > 0,
        edit,
        rerender: (refs) => rerender(refs),
        notify,
        addGhost,
      },
    [
      session,
      snap,
      renderer,
      media,
      editors,
      targets,
      links,
      t,
      panel,
      editing,
      selected,
      docKeys,
      isLive,
      registerClientDoc,
      renders,
      edit,
      rerender,
      notify,
      addGhost,
    ],
  )

  useEffect(() => {
    hub.set(ctx)
  }, [ctx])
  useEffect(() => () => hub.set(null), [])
  useEditorStyles()
  usePageEvents(ctx, root)

  const mounted = useIsClient()
  if (!mounted || !ctx) return null

  return (
    <OnPageContext.Provider value={ctx}>
      {createPortal(
        <div className="po-doc-layer" {...{ [UI]: '' }}>
          <Ghosts ghosts={ghosts} />
          <FieldHost mode="inline" />
        </div>,
        document.body,
      )}
      {createPortal(
        <div className="po-layer" {...{ [UI]: '' }}>
          <Overlay />
          <SettingsPanel />
          <BlockPicker />
          <FieldHost mode="popover" />
          <Dock flash={flash} />
        </div>,
        document.body,
      )}
    </OnPageContext.Provider>
  )
}
