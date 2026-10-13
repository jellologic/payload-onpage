'use client'

/**
 * Preview mode: the draft without editing tools. Device widths open the same
 * page in a framed viewport. Signed-in editors can switch back to editing;
 * people on a shared link can leave to the published page.
 */
import { useEffect, useMemo, useState } from 'react'
import { useEditorStyles, useIsClient } from '../useIsClient.ts'
import { createPortal } from 'react-dom'
import { UI } from '../dom.ts'
import { createTranslate, type Messages } from '../messages.ts'
import { PostButton } from './PostButton.tsx'

export interface PreviewToolbarProps {
  /** Endpoint that leaves preview (POST), back to the published page. */
  exitHref: string
  /** Endpoint that switches to editing (POST); omit for people who can't edit (shared links). */
  editHref?: string | undefined
  /** Opened from a shared preview link. */
  shared?: boolean | undefined
  messages?: Messages | undefined
  /** The language of the UI strings. Default "en". */
  uiLocale?: string | undefined
}

const DEVICES = [
  { id: 'phone', width: 390 },
  { id: 'tablet', width: 820 },
] as const

export const FRAME_PARAM = 'onpage-frame'

/** True inside the device-preview frame (the toolbar and editor stay out of it). */
export const inPreviewFrame = (): boolean =>
  typeof window !== 'undefined' &&
  (window.self !== window.top || new URLSearchParams(window.location.search).has(FRAME_PARAM))

export function PreviewToolbar({
  exitHref,
  editHref,
  shared,
  messages,
  uiLocale,
}: PreviewToolbarProps) {
  const [device, setDevice] = useState<(typeof DEVICES)[number] | null>(null)
  const mounted = useIsClient()
  const t = useMemo(() => createTranslate(messages, uiLocale), [messages, uiLocale])
  useEditorStyles()
  useEffect(() => {
    if (!device) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDevice(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [device])
  if (!mounted || inPreviewFrame()) return null

  const frameSrc = () => {
    const u = new URL(window.location.href)
    u.searchParams.set(FRAME_PARAM, '1')
    return u.toString()
  }

  return createPortal(
    <div className="po-layer" {...{ [UI]: '' }}>
      {device && (
        <div className="po-frame-bg" data-testid="onpage-device-frame">
          <button
            type="button"
            className="po-frame-close"
            onClick={() => setDevice(null)}
            aria-label={t('common.close')}
          />
          <iframe
            src={frameSrc()}
            title={t(`preview.${device.id}`)}
            style={{ width: device.width }}
          />
        </div>
      )}
      <div
        className="po-preview"
        role="toolbar"
        aria-label={t('preview.label')}
        data-testid="onpage-preview-toolbar"
      >
        <span className="po-badge">{t('preview.badge')}</span>
        <span className="po-status">{t(shared ? 'preview.shared' : 'preview.own')}</span>
        {DEVICES.map((d) => (
          <button
            key={d.id}
            type="button"
            className="po-btn"
            aria-pressed={device?.id === d.id}
            onClick={() => setDevice(device?.id === d.id ? null : d)}
            data-testid={`onpage-device-${d.id}`}
          >
            {t(`preview.${d.id}`)}
          </button>
        ))}
        {device && (
          <button
            type="button"
            className="po-btn"
            onClick={() => setDevice(null)}
            data-testid="onpage-device-desktop"
          >
            {t('preview.desktop')}
          </button>
        )}
        {editHref && (
          <PostButton action={editHref} className="po-btn po-primary" testId="onpage-edit">
            {t('preview.edit')}
          </PostButton>
        )}
        <PostButton action={exitHref} testId="onpage-exit-preview">
          {t(shared ? 'preview.viewPublished' : 'preview.exit')}
        </PostButton>
      </div>
    </div>,
    document.body,
  )
}
