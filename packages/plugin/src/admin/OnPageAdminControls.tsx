'use client';

/**
 * Document controls added by payload-onpage: open this document on the site in
 * edit or preview mode, or copy a signed read-only preview link to share.
 */
import React, { useState } from 'react';
import { Button, toast, useDocumentInfo, useLocale } from '@payloadcms/ui';

export interface OnPageAdminControlsProps {
  kind: 'collection' | 'global';
  slug: string;
  apiRoute: string;
  prefix: string;
}

export function OnPageAdminControls({ kind, slug, apiRoute, prefix }: OnPageAdminControlsProps) {
  const { id } = useDocumentInfo();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  if (kind === 'collection' && !id) return null; // not saved yet

  const base = `${apiRoute}${prefix}`;
  const query = (mode: 'edit' | 'view') => {
    const p = new URLSearchParams({ kind, slug, mode });
    if (kind === 'collection') p.set('id', String(id));
    if (locale?.code) p.set('locale', locale.code);
    return p.toString();
  };

  const copyLink = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${base}/preview-link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, slug, id, locale: locale?.code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      await navigator.clipboard.writeText(body.url);
      toast.success(`Preview link copied — valid until ${new Date(body.expiresAt).toLocaleDateString()}`);
    } catch (e) {
      toast.error(`Couldn't create a preview link: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const style = { whiteSpace: 'nowrap' as const, flexShrink: 0 };
  return (
    <div style={{ display: 'flex', gap: 6 }} data-testid="onpage-admin-controls">
      <Button buttonStyle="secondary" size="medium" el="anchor" url={`${base}/enter?${query('edit')}`} newTab extraButtonProps={{ style, 'data-testid': 'onpage-edit-on-page' }}>
        Edit on page
      </Button>
      <Button
        buttonStyle="subtle"
        size="medium"
        onClick={copyLink}
        disabled={busy}
        tooltip="Copy a read-only link to this draft"
        extraButtonProps={{ style, 'data-testid': 'onpage-copy-preview-link' }}
      >
        Copy preview link
      </Button>
    </div>
  );
}

export default OnPageAdminControls;
