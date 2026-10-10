'use client'

/**
 * The on-page editor. Mount it once (the Next adapter's <OnPage /> does) and
 * it finds editable content through the Locator, opens each document it finds
 * in an EditorSession, and edits through the field-editor registry. Saves go
 * through the DataSource; the Renderer shows them (server refresh by default,
 * instant for documents rendered with <OnPageClient>).
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import {
  EditorSession,
  fieldAtPath,
  getAt,
  payloadUploads,
  refKey,
  type DataSource,
  type DocRef,
  type Locator,
  type MediaLibrary,
  type Renderer,
  type Target,
} from '@payload-onpage/core'
import {
  OnPageContext,
  type EditingState,
  type EditorRegistry,
  type FieldEditorDef,
  type FieldEditorProps,
  type Ghost,
  type Links,
  type OnPageContextValue,
  type Panel,
  type Selection,
} from './context.tsx'
import { BlockPicker } from './BlockPicker.tsx'
import { Dock } from './Dock.tsx'
import { HIDDEN, isOurs, placeOver, UI, useEachFrame } from './dom.ts'
import { defaultEditors } from './editors/index.ts'
import { hub } from './hub.ts'
import { annotations, composite, stega } from './locators.ts'
import { Overlay } from './Overlay.tsx'
import { mergeEditors, resolveEditor } from './registry.ts'
import { clientState } from './renderers.ts'
import { SettingsPanel } from './SettingsPanel.tsx'
import { injectStyles } from './styles.ts'
import { useTargets } from './targets.ts'

export interface OnPageEditorProps {
  dataSource: DataSource
  /** Image search/upload. Default: payloadUploads(). */
  media?: MediaLibrary
  /** How elements map to fields. Default: composite(annotations(), stega()). */
  locator?: Locator
  /** How saved changes reach the page. Default: clientState() (no server refresh). */
  renderer?: Renderer
  /** Extra or replacement field editors by id; `null` removes a default. */
  editors?: Record<string, FieldEditorDef | null>
  links: Links
  locale?: string
  /** Debounce before an edit is saved, ms. Default 800 for client rendering, 250 for refresh. */
  autosaveDelay?: number
  /** Where to look for editable content. Default: document.body. */
  root?: () => ParentNode | null
}

const FIELD_KINDS = new Set<Target['kind']>(['text', 'textarea', 'richtext', 'media', 'field'])
const GHOST_TTL = 15000

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable ||
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT')

export function OnPageEditor(props: OnPageEditorProps) {
  const renderer = useMemo(() => props.renderer ?? clientState(), [props.renderer])
  const onSaved = useRef<(ref: DocRef) => void>(() => {})
  const [session] = useState(
    () =>
      new EditorSession({
        dataSource: props.dataSource,
        locale: props.locale,
        autosaveDelay: props.autosaveDelay ?? (renderer.live ? 800 : 250),
        onSaved: (ref) => onSaved.current(ref),
      }),
  )
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const locator = useMemo(() => props.locator ?? composite(annotations(), stega()), [props.locator])
  const rootProp = props.root
  const root = useCallback(
    () => (rootProp ? rootProp() : typeof document === 'undefined' ? null : document.body),
    [rootProp],
  )
  const targets = useTargets(locator, root)
  const editors: EditorRegistry = useMemo(
    () => mergeEditors(defaultEditors, props.editors),
    [props.editors],
  )
  const media = useMemo(() => props.media ?? payloadUploads(), [props.media])

  const [panel, setPanel] = useState<Panel>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [renders, setRenders] = useState(0)
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null)
  const [clientDocs, setClientDocs] = useState<ReadonlySet<string>>(new Set())
  const clientDocsRef = useRef(clientDocs)
  clientDocsRef.current = clientDocs

  const notify = useCallback((text: string, bad?: boolean) => setFlash({ text, bad }), [])
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])

  // Documents on this page: everything the locator found, plus client-mode documents.
  const docKeys = useMemo(() => {
    const keys = new Set<string>(clientDocs)
    for (const t of targets.all) keys.add(refKey(t.ref))
    return [...keys]
  }, [targets, clientDocs])

  useEffect(() => {
    const seen = new Set<string>()
    for (const t of targets.all) {
      const k = refKey(t.ref)
      if (seen.has(k)) continue
      seen.add(k)
      void session.open(t.ref)
    }
  }, [targets, session])

  const isLive = useCallback(
    (key: string) => renderer.live || clientDocsRef.current.has(key),
    [renderer],
  )

  // After a save: re-render the page (refresh mode), then retire that document's ghosts.
  onSaved.current = (ref) => {
    const key = refKey(ref)
    if (isLive(key)) return
    const started = Date.now()
    setRenders((n) => n + 1)
    void Promise.resolve(renderer.afterSave({ refs: [ref] }))
      .catch((e) => console.error('[payload-onpage] render after save failed', e))
      .finally(() => {
        setRenders((n) => n - 1)
        // Give the new DOM a moment to land (and the locator to rescan) before uncovering it.
        setTimeout(
          () => setGhosts((gs) => gs.filter((g) => !(g.key === key && g.created <= started))),
          250,
        )
      })
  }

  // Ghosts never outlive a failed save or their TTL.
  useEffect(() => {
    if (!ghosts.length) return
    const failed = (g: Ghost) => {
      const st = snap.docs[g.key]?.save.status
      return st === 'error' || st === 'conflict'
    }
    if (ghosts.some(failed)) setGhosts((gs) => gs.filter((g) => !failed(g)))
    const next = Math.min(...ghosts.map((g) => g.until)) - Date.now()
    const t = setTimeout(
      () => setGhosts((gs) => gs.filter((g) => g.until > Date.now())),
      Math.max(next, 0) + 10,
    )
    return () => clearTimeout(t)
  }, [ghosts, snap])

  const addGhost = useCallback((g: Omit<Ghost, 'id' | 'until' | 'created'>) => {
    const now = Date.now()
    setGhosts((gs) => [
      ...gs.filter((x) => !(x.key === g.key && x.path === g.path)),
      { ...g, id: `${now}-${Math.random()}`, created: now, until: now + GHOST_TTL },
    ])
  }, [])

  const registerClientDoc = useCallback((key: string) => {
    setClientDocs((s) => new Set(s).add(key))
    return () =>
      setClientDocs((s) => {
        const n = new Set(s)
        n.delete(key)
        return n
      })
  }, [])

  const edit = useCallback<OnPageContextValue['edit']>(
    (key, path, opts = {}) => {
      const state = session.get(key)
      if (!state?.schema || !state.doc) {
        notify(
          state?.status === 'error' ? `Can't edit: ${state.error}` : 'Loading the editor…',
          state?.status === 'error',
        )
        return true
      }
      if (!state.schema.editable.includes(path.split('.')[0])) return false
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

  const ctx: OnPageContextValue = {
    session,
    snap,
    mode: 'edit',
    renderer,
    media,
    editors,
    targets,
    links: props.links,
    panel,
    setPanel,
    editing,
    setEditing,
    selected,
    setSelected,
    isLive,
    registerClientDoc,
    addGhost,
    ghosts,
    docKeys,
    rendering: renders > 0,
    edit,
    notify,
  }
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  useEffect(() => {
    hub.set(ctx)
  })
  useEffect(() => () => hub.set(null), [])

  // Page-level listeners: click to edit or select, keyboard shortcuts, unsaved-changes guard.
  useEffect(() => {
    injectStyles()
    document.documentElement.setAttribute('data-onpage-editing', '')
    const onClick = (e: MouseEvent) => {
      if (e.altKey || e.button !== 0) return // ⌥-click: use the page normally (follow a link)
      const t = e.target
      if (!(t instanceof Element) || isOurs(t)) return
      const c = ctxRef.current
      const r = root()
      if (r && !r.contains(t)) return
      let field: Target | undefined
      let row: Target | undefined
      for (let el: Element | null = t; el; el = el.parentElement) {
        for (const x of c.targets.at(el)) {
          if (!field && FIELD_KINDS.has(x.kind)) field = x
          if (!row && (x.kind === 'item' || x.kind === 'block')) row = x
        }
      }
      const inControl = !!t.closest('a,button,label,summary,[role="button"]')
      if (row) c.setSelected({ key: refKey(row.ref), path: row.path })
      else if (!field) c.setSelected(null)
      if (
        field &&
        c.edit(refKey(field.ref), field.path, {
          point: { x: e.clientX, y: e.clientY },
          kind: field.kind,
          anchor: field.el,
        })
      ) {
        e.preventDefault()
        e.stopPropagation()
      } else if ((field || row) && inControl) {
        e.preventDefault() // don't navigate away from the editor by accident
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const c = ctxRef.current
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) c.session.redo()
        else c.session.undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        c.session.redo()
      } else if (e.key === 'Escape') {
        c.setPanel(null)
        c.setSelected(null)
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!ctxRef.current.session.hasPendingSaves) return
      void ctxRef.current.session.flush()
      e.preventDefault()
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.documentElement.removeAttribute('data-onpage-editing')
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [root])

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <OnPageContext.Provider value={ctx}>
      {createPortal(
        <div className="po-doc-layer" {...{ [UI]: '' }}>
          <Ghosts />
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

/** Renders the open field editor, if it belongs to this layer. */
function FieldHost({ mode }: { mode: 'inline' | 'popover' }) {
  const ctx = React.useContext(OnPageContext)!
  const { editing, editors, session, snap, targets, setEditing, addGhost, isLive } = ctx
  const def = editing ? editors[editing.editor] : undefined
  const state = editing ? snap.docs[editing.key] : undefined
  const key = editing?.key ?? ''
  const path = editing?.path ?? ''
  const live = isLive(key)
  const elRef = useRef<Element | undefined>(editing?.el)
  elRef.current = editing?.el

  const element = useCallback(() => {
    const el = elRef.current
    return el?.isConnected ? el : (targets.find(key, path)?.el ?? null)
  }, [targets, key, path])
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
    />
  )
}

/** Refresh mode: committed content stays on screen until the server render shows it. */
function Ghosts() {
  const { ghosts } = React.useContext(OnPageContext)!
  return (
    <>
      {ghosts.map((g) => (
        <GhostView key={g.id} ghost={g} />
      ))}
    </>
  )
}

function GhostView({ ghost }: { ghost: Ghost }) {
  const { targets, editing } = React.useContext(OnPageContext)!
  const box = useRef<HTMLDivElement>(null)
  const last = useRef<Element | null>(null)
  const reopened = editing?.key === ghost.key && editing.path === ghost.path
  useEachFrame(() => {
    const el = targets.find(ghost.key, ghost.path)?.el ?? null
    if (last.current && last.current !== el) last.current.removeAttribute(HIDDEN)
    last.current = el
    const b = box.current
    if (!b) return
    if (!el || reopened) {
      b.style.visibility = 'hidden'
      return
    }
    el.setAttribute(HIDDEN, 'true')
    placeOver(b, el, { minHeight: true })
    b.style.visibility = 'visible'
  })
  useEffect(() => () => last.current?.removeAttribute(HIDDEN), [])
  return (
    <div
      ref={box}
      className={`po-ghost${ghost.className ? ` ${ghost.className}` : ''}`}
      style={ghost.style as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: ghost.html }}
      aria-hidden
      data-testid="onpage-ghost"
    />
  )
}
