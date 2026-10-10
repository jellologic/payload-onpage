'use client'

/**
 * Document controls added by payload-onpage: open this document's page in edit
 * mode, or copy a sealed read-only preview link. Hidden for users who can't
 * update the document.
 */
import { payloadRest } from '@payload-onpage/core/payload'
import { Button, toast, useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { useMemo, useState } from 'react'

export interface OnPageAdminControlsProps {
  kind: 'collection' | 'global'
  slug: string
  /** Plugin endpoint prefix (`routePrefix`). */
  prefix: string
}

/**
 * Same-origin POST (the endpoint refuses cross-site requests) opened in a new tab.
 * A detached form: these controls render inside the admin's document <form>, and forms can't nest.
 */
function postInNewTab(action: string) {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = action
  form.target = '_blank'
  document.body.appendChild(form)
  form.submit()
  form.remove()
}

export function OnPageAdminControls({ kind, slug, prefix }: OnPageAdminControlsProps) {
  const { id, hasSavePermission } = useDocumentInfo()
  const { config } = useConfig()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const apiBase = `${config.serverURL ?? ''}${config.routes.api}`
  const dataSource = useMemo(() => payloadRest({ apiBase, prefix }), [apiBase, prefix])

  if ((kind === 'collection' && !id) || hasSavePermission === false) return null

  const ref = kind === 'global' ? ({ kind, slug } as const) : ({ kind, slug, id: id! } as const)
  const params = new URLSearchParams({ kind, slug, mode: 'edit' })
  if (kind === 'collection') params.set('id', String(id))
  if (locale?.code) params.set('locale', locale.code)

  const copyLink = async () => {
    setBusy(true)
    try {
      const link = await dataSource.createPreviewLink!(ref, { locale: locale?.code })
      await navigator.clipboard.writeText(link.url)
      toast.success(
        `Preview link copied — valid until ${new Date(link.expiresAt).toLocaleString()}`,
      )
    } catch (e) {
      toast.error(`Couldn't create a preview link: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const style = { whiteSpace: 'nowrap' as const, flexShrink: 0 }
  return (
    <div style={{ display: 'flex', gap: 6 }} data-testid="onpage-admin-controls">
      <Button
        buttonStyle="secondary"
        size="medium"
        onClick={() => postInNewTab(`${apiBase}${prefix}/enter?${params}`)}
        extraButtonProps={{ style, 'data-testid': 'onpage-edit-on-page' }}
      >
        Edit on page
      </Button>
      <Button
        buttonStyle="subtle"
        size="medium"
        onClick={() => void copyLink()}
        disabled={busy}
        tooltip="Copy a read-only link to this draft"
        extraButtonProps={{ style, 'data-testid': 'onpage-copy-preview-link' }}
      >
        Copy preview link
      </Button>
    </div>
  )
}

export default OnPageAdminControls
