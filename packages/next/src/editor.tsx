'use client'

/** The lazily loaded part of the Next adapter: the editor and the preview toolbar, wired to Next and Payload. */
import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation.js'
import { DEFAULTS, ROUTES, type DocRef } from '@payload-onpage/core'
import { payloadRest, payloadUploads } from '@payload-onpage/core/payload'
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

/** Routes resolved once, with the defaults applied. */
const routesOf = (props: OnPageMountProps) => {
  const api = props.apiRoute ?? DEFAULTS.apiRoute
  const prefix = props.prefix ?? DEFAULTS.routePrefix
  return { api, prefix, base: `${api}${prefix}`, admin: props.adminRoute ?? DEFAULTS.adminRoute }
}

function useLinks(props: OnPageMountProps): Links {
  const here = useHere()
  const { base, admin } = routesOf(props)
  return useMemo<Links>(
    () => ({
      exit: `${base}${ROUTES.exit}?path=${encodeURIComponent(here)}`,
      mode: (mode) => `${base}${ROUTES.mode}?mode=${mode}&path=${encodeURIComponent(here)}`,
      admin: (ref: DocRef) =>
        ref.kind === 'global'
          ? `${admin}/globals/${ref.slug}`
          : `${admin}/collections/${ref.slug}/${ref.id}`,
    }),
    [base, admin, here],
  )
}

const htmlLang = () =>
  (typeof document !== 'undefined' && document.documentElement.lang) || undefined

export function NextEditor(props: OnPageMountProps) {
  const locale = props.locale ?? htmlLang()
  const links = useLinks(props)
  const renderer = useNextRefresh()
  const { api, prefix } = routesOf(props)
  const dataSource = useMemo(
    () => props.dataSource ?? payloadRest({ apiBase: api, prefix }),
    [props.dataSource, api, prefix],
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
      messages={props.messages}
      uiLocale={props.uiLocale}
    />
  )
}

export function NextPreview(props: OnPageMountProps) {
  const links = useLinks(props)
  return (
    <PreviewToolbar
      exitHref={links.exit}
      editHref={props.shared ? undefined : links.mode?.('edit')}
      shared={props.shared}
      messages={props.messages}
      uiLocale={props.uiLocale}
    />
  )
}
