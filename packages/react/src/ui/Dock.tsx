'use client'

/**
 * The bottom bar: save status across the page's documents (with per-document
 * recovery: reload after a conflict, retry after an error), undo/redo, locale,
 * share link, preview, discard, admin, exit and publish.
 */
import { errorText } from '@payload-onpage/core'
import type { DocumentState } from '@payload-onpage/core'
import { useEffect, useState } from 'react'
import { useOnPage } from '../context.tsx'
import { relativeTime, type Translate } from '../messages.ts'
import { PostButton } from './PostButton.tsx'
import { ToolbarButton } from './ToolbarButton.tsx'
import type { Flash } from '../types.ts'

const title = (d: DocumentState) => d.schema?.labels.singular ?? d.ref.slug

interface DockState {
  docs: DocumentState[]
  ready: DocumentState[]
  failed: DocumentState | undefined
  conflict: DocumentState | undefined
  error: DocumentState | undefined
  saving: boolean
  rendering: boolean
  lastSaved: number
}

/** What the dock says, most urgent first. */
function dockStatus(s: DockState, t: Translate): Flash {
  if (s.failed)
    return {
      text: t('dock.unavailable', { doc: title(s.failed), error: s.failed.error ?? '' }),
      bad: true,
    }
  if (!s.docs.length) return { text: t('dock.nothing') }
  if (!s.ready.length) return { text: t('dock.loading') }
  if (s.conflict) return { text: t('dock.conflict', { doc: title(s.conflict) }), bad: true }
  if (s.error)
    return {
      text: t('dock.saveFailed', { doc: title(s.error), message: s.error.save.message ?? '' }),
      bad: true,
    }
  if (s.saving) return { text: t('dock.saving') }
  if (s.rendering) return { text: t('dock.updating') }
  if (s.lastSaved) return { text: t('dock.saved', { ago: relativeTime(s.lastSaved) }) }
  return { text: t('dock.editing') }
}

function useTicker(ms: number) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

export function Dock() {
  const { session, snap, links, rendering, notify, rerender, docKeys, flash, t } = useOnPage()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useTicker(5000)
  useEffect(() => {
    if (!confirmDiscard) return
    const id = setTimeout(() => setConfirmDiscard(false), 4000)
    return () => clearTimeout(id)
  }, [confirmDiscard])

  const docs = docKeys.map((k) => snap.docs[k]).filter((d): d is DocumentState => !!d)
  const ready = docs.filter((d) => d.status === 'ready')
  const failed = docs.find((d) => d.status === 'error')
  const conflict = docs.find((d) => d.save.status === 'conflict')
  const error = docs.find((d) => d.save.status === 'error')
  const saving = docs.some((d) => d.save.status === 'saving' || d.save.status === 'pending')
  const lastSaved = Math.max(0, ...docs.map((d) => d.save.lastSavedAt ?? 0))
  const primary = docs[0]
  const busy = snap.busy

  const retryable = failed ?? error
  const status = dockStatus(
    { docs, ready, failed, conflict, error, saving, rendering, lastSaved },
    t,
  )

  const schema = ready[0]?.schema
  const nonDefaultLocale =
    schema?.defaultLocale && session.locale && session.locale !== schema.defaultLocale

  const publish = async () => {
    try {
      const res = await session.publish({ keys: docKeys })
      if (res.published.length) await rerender(res.published)
      if (res.ok) notify(t(res.published.length ? 'notify.published' : 'notify.nothingToPublish'))
      else notify(t('notify.publishFailed', { message: res.message ?? '' }), true)
    } catch (e) {
      notify(t('notify.publishFailed', { message: errorText(e) }), true)
    }
  }
  const discard = async () => {
    // Two-step: the first click arms, the second (within 4s) discards.
    if (!confirmDiscard) return setConfirmDiscard(true)
    setConfirmDiscard(false)
    try {
      await session.discard({ keys: docKeys })
      notify(t('notify.discarded'))
    } catch (e) {
      notify(errorText(e), true)
    }
  }
  const reload = async (d: DocumentState) => {
    try {
      await session.reload(d.key)
      await rerender([d.ref])
    } catch (e) {
      notify(errorText(e), true)
    }
  }
  const createLink = session.dataSource.createPreviewLink?.bind(session.dataSource)
  const share = async () => {
    if (!createLink || !primary) return
    try {
      const { url, expiresAt } = await createLink(primary.ref, { locale: session.locale })
      await navigator.clipboard.writeText(url)
      notify(t('notify.linkCopied', { date: new Date(expiresAt).toLocaleString() }))
    } catch (e) {
      notify(t('notify.linkFailed', { message: errorText(e) }), true)
    }
  }

  return (
    <>
      {nonDefaultLocale && (
        <div className="po-notice" role="note" data-testid="onpage-locale-notice">
          {t('dock.localeNotice', { locale: session.locale ?? '' })}
        </div>
      )}
      <div
        className="po-dock"
        role="toolbar"
        aria-label={t('dock.label')}
        data-testid="onpage-dock"
      >
        <span
          className={`po-status${(flash?.bad ?? status.bad) ? ' is-bad' : ''}`}
          role="status"
          aria-live="polite"
          data-testid="onpage-status"
        >
          {flash?.text ?? status.text}
        </span>
        {conflict && (
          <button
            type="button"
            className="po-btn"
            disabled={busy}
            onClick={() => void reload(conflict)}
            data-testid="onpage-reload"
          >
            {t('dock.reload')}
          </button>
        )}
        {retryable && (
          <button
            type="button"
            className="po-btn"
            onClick={() => void session.retry(retryable.key)}
            data-testid="onpage-retry"
          >
            {t('dock.retry')}
          </button>
        )}
        {docs.length > 1 && (
          <span
            className="po-docs"
            title={docs.map(title).join(', ')}
            data-testid="onpage-doc-count"
          >
            {t('dock.documents', { count: docs.length })}
          </span>
        )}
        {session.locale && <span className="po-chip-locale">{session.locale}</span>}
        <span className="po-sep" />
        <ToolbarButton
          label={t('dock.undo')}
          hint={`${t('dock.undo')} (⌘Z)`}
          icon="↶"
          disabled={!snap.canUndo}
          onClick={() => session.undo()}
          testId="onpage-undo"
        />
        <ToolbarButton
          label={t('dock.redo')}
          hint={`${t('dock.redo')} (⇧⌘Z)`}
          icon="↷"
          disabled={!snap.canRedo}
          onClick={() => session.redo()}
          testId="onpage-redo"
        />
        <span className="po-sep" />
        {links.mode && (
          <PostButton
            action={links.mode('view')}
            title={t('dock.previewHint')}
            testId="onpage-preview"
          >
            {t('dock.preview')}
          </PostButton>
        )}
        {createLink && primary && (
          <button
            type="button"
            className="po-btn"
            onClick={() => void share()}
            title={t('dock.shareHint')}
            data-testid="onpage-share"
          >
            {t('dock.share')}
          </button>
        )}
        <button
          type="button"
          className={`po-btn${confirmDiscard ? ' is-danger' : ''}`}
          disabled={!ready.length || busy}
          onClick={() => void discard()}
          onBlur={() => setConfirmDiscard(false)}
          title={t('dock.discardHint')}
          data-testid="onpage-discard"
        >
          {t(confirmDiscard ? 'dock.discardConfirm' : 'dock.discard')}
        </button>
        {links.admin && primary && (
          <a
            className="po-btn"
            href={links.admin(primary.ref)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="onpage-open-admin"
          >
            {t('dock.admin')}
          </a>
        )}
        <PostButton action={links.exit} testId="onpage-exit">
          {t('dock.exit')}
        </PostButton>
        <button
          type="button"
          className="po-btn po-primary"
          disabled={!ready.length || busy || !!conflict}
          onClick={() => void publish()}
          data-testid="onpage-publish"
        >
          {t(busy ? 'dock.publishing' : 'dock.publish')}
        </button>
      </div>
    </>
  )
}
