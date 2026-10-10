'use client'

/**
 * Preview mode: the draft without editing tools. Device widths open the same
 * page in a framed viewport. Signed-in editors can switch back to editing;
 * people on a shared link can leave to the published page.
 */
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { UI } from './dom.ts'
import { injectStyles } from './styles.ts'

export interface PreviewToolbarProps {
  /** Leave preview (back to the published page). */
  exitHref: string
  /** Switch to editing; omit for people who can't edit (shared links). */
  editHref?: string
  /** Opened from a shared preview link. */
  shared?: boolean
}

const DEVICES = [
  { id: 'phone', label: 'Phone', width: 390 },
  { id: 'tablet', label: 'Tablet', width: 820 },
] as const

export const FRAME_PARAM = 'onpage-frame'

/** True inside the device-preview frame (the toolbar and editor stay out of it). */
export const inPreviewFrame = () =>
  typeof window !== 'undefined' &&
  (window.self !== window.top || new URLSearchParams(window.location.search).has(FRAME_PARAM))

export function PreviewToolbar({ exitHref, editHref, shared }: PreviewToolbarProps) {
  const [device, setDevice] = useState<(typeof DEVICES)[number] | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    injectStyles()
    setMounted(true)
  }, [])
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
        <div
          className="po-frame-bg"
          onClick={() => setDevice(null)}
          data-testid="onpage-device-frame"
        >
          <iframe
            src={frameSrc()}
            title={`${device.label} preview`}
            style={{ width: device.width }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div
        className="po-preview"
        role="toolbar"
        aria-label="Draft preview"
        data-testid="onpage-preview-toolbar"
      >
        <span className="po-badge">Draft</span>
        <span className="po-status">
          {shared ? 'Shared preview — not published yet' : 'Previewing the draft'}
        </span>
        {DEVICES.map((d) => (
          <button
            key={d.id}
            className="po-btn"
            aria-pressed={device?.id === d.id}
            onClick={() => setDevice(device?.id === d.id ? null : d)}
            data-testid={`onpage-device-${d.id}`}
          >
            {d.label}
          </button>
        ))}
        {device && (
          <button
            className="po-btn"
            onClick={() => setDevice(null)}
            data-testid="onpage-device-desktop"
          >
            Desktop
          </button>
        )}
        {editHref && (
          <a
            className="po-btn po-primary"
            style={{ background: '#4f7cff' }}
            href={editHref}
            data-testid="onpage-edit"
          >
            Edit
          </a>
        )}
        <a className="po-btn" href={exitHref} data-testid="onpage-exit-preview">
          {shared ? 'View published' : 'Exit'}
        </a>
      </div>
    </div>,
    document.body,
  )
}
