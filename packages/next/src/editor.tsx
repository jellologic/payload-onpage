'use client'

/** The lazily loaded part of the Next adapter: the editor and the preview toolbar, wired to Next and Payload. */
import React, { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation.js'
import { payloadRest, payloadUploads, type DocRef } from '@payload-onpage/core'
import { OnPageEditor, PreviewToolbar, inPreviewFrame, type Links } from '@payload-onpage/react'
import { lexicalEditors } from '@payload-onpage/lexical'
import type { OnPageMountProps } from './client.tsx'
import { useNextRefresh } from './refresh.ts'

function useHere(): string {
  const pathname = usePathname()
  const search = useSearchParams()
  const qs = search?.toString()
  return `${pathname}${qs ? `?${qs}` : ''}`
}

function useLinks(props: OnPageMountProps, locale?: string): Links {
  const here = useHere()
  const api = props.apiRoute ?? '/api'
  const base = `${api}${props.prefix ?? '/onpage'}`
  const admin = props.adminRoute ?? '/admin'
  return useMemo<Links>(
    () => ({
      exit: `${base}/exit?path=${encodeURIComponent(here)}`,
      mode: (mode) => `${base}/mode?mode=${mode}&path=${encodeURIComponent(here)}`,
      admin: (ref: DocRef) =>
        ref.kind === 'global'
          ? `${admin}/globals/${ref.slug}`
          : `${admin}/collections/${ref.slug}/${ref.id}`,
      previewLink: async (ref: DocRef) => {
        const res = await fetch(`${base}/preview-link`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: ref.kind,
            slug: ref.slug,
            id: ref.kind === 'collection' ? ref.id : undefined,
            locale,
            path: here.split('?')[0],
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error ?? res.statusText)
        return body
      },
    }),
    [base, admin, here, locale],
  )
}

const htmlLang = () =>
  (typeof document !== 'undefined' && document.documentElement.lang) || undefined

export function NextEditor(props: OnPageMountProps) {
  const locale = props.locale ?? htmlLang()
  const links = useLinks(props, locale)
  const renderer = useNextRefresh()
  const api = props.apiRoute ?? '/api'
  const dataSource = useMemo(
    () => props.dataSource ?? payloadRest({ apiBase: api, prefix: props.prefix }),
    [props.dataSource, api, props.prefix],
  )
  const media = useMemo(() => props.media ?? payloadUploads({ apiBase: api }), [props.media, api])
  const editors = useMemo(() => ({ ...lexicalEditors, ...props.editors }), [props.editors])
  if (inPreviewFrame()) return null
  return (
    <OnPageEditor
      dataSource={dataSource}
      media={media}
      locator={props.locator}
      renderer={renderer}
      editors={editors}
      links={links}
      locale={locale}
    />
  )
}

export function NextPreview(props: OnPageMountProps) {
  const links = useLinks(props, props.locale ?? htmlLang())
  return (
    <PreviewToolbar
      exitHref={links.exit}
      editHref={props.shared ? undefined : links.mode?.('edit')}
      shared={props.shared}
    />
  )
}
