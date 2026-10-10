'use client';

/**
 * The bottom bar: save status across every open document, undo/redo, locale,
 * share link, preview, discard, admin, exit and publish.
 */
import React, { useEffect, useState } from 'react';
import type { DocumentState } from '@payload-onpage/core';
import { useOnPage } from './context.tsx';

function ago(ts?: number): string {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

const title = (d: DocumentState) => d.schema?.labels.singular ?? d.ref.slug;

function useTicker(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function Dock({ flash }: { flash: { text: string; bad?: boolean } | null }) {
  const { session, snap, links, rendering, notify, renderer, docKeys } = useOnPage();
  const [publishing, setPublishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useTicker(5000);
  useEffect(() => {
    if (!confirmDiscard) return;
    const t = setTimeout(() => setConfirmDiscard(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDiscard]);

  const docs = docKeys.map((k) => snap.docs[k]).filter(Boolean);
  const ready = docs.filter((d) => d.status === 'ready');
  const failed = docs.find((d) => d.status === 'error');
  const conflict = docs.find((d) => d.save.status === 'conflict');
  const error = docs.find((d) => d.save.status === 'error');
  const saving = docs.some((d) => d.save.status === 'saving' || d.save.status === 'pending');
  const lastSaved = Math.max(0, ...docs.map((d) => d.save.lastSavedAt ?? 0));
  const edited = docs.filter((d) => d.edited);
  const primary = docs[0];

  const status = failed
    ? { text: `Editor unavailable: ${failed.error}`, bad: true }
    : !docs.length
      ? { text: 'Nothing editable on this page' }
      : !ready.length
        ? { text: 'Loading editor…' }
        : conflict
          ? { text: `${title(conflict)}: someone else changed it`, bad: true }
          : error
            ? { text: error.save.message ?? 'Save failed', bad: true }
            : saving
              ? { text: 'Saving draft…' }
              : rendering
                ? { text: 'Updating page…' }
                : lastSaved
                  ? { text: `Draft saved ${ago(lastSaved)}` }
                  : { text: 'Editing draft' };

  const schema = ready[0]?.schema;
  const nonDefaultLocale = schema?.defaultLocale && session.locale && session.locale !== schema.defaultLocale;

  const publish = async () => {
    setPublishing(true);
    const res = await session.publish({ keys: docKeys });
    setPublishing(false);
    if (res.published.length) await renderer.afterSave({ refs: res.published });
    notify(res.ok ? (res.published.length ? 'Published ✓' : 'Nothing to publish') : res.message ?? 'Publish failed', !res.ok);
  };
  const share = async () => {
    if (!links.previewLink || !primary) return;
    try {
      const { url, expiresAt } = await links.previewLink(primary.ref);
      await navigator.clipboard.writeText(url);
      notify(`Preview link copied${expiresAt ? ` — valid until ${new Date(expiresAt).toLocaleDateString()}` : ''}`);
    } catch (e) {
      notify(`Couldn't create a preview link: ${(e as Error).message}`, true);
    }
  };

  return (
    <>
      {nonDefaultLocale && (
        <div className="po-notice" data-testid="onpage-locale-notice">
          Editing <b>{session.locale}</b>: text changes apply to this language only; adding, moving or removing sections changes every language.
        </div>
      )}
      <div className="po-dock" role="toolbar" aria-label="Page editor" data-testid="onpage-dock">
        <span className={`po-status${(flash?.bad ?? status.bad) ? ' is-bad' : ''}`} aria-live="polite" data-testid="onpage-status">
          {flash?.text ?? status.text}
        </span>
        {conflict && (
          <button className="po-btn" onClick={() => void session.reload(conflict.key).then(() => renderer.afterSave({ refs: [conflict.ref] }))} data-testid="onpage-reload">
            Reload latest
          </button>
        )}
        {docs.length > 1 && (
          <span className="po-docs" title={docs.map(title).join(', ')} data-testid="onpage-doc-count">
            {docs.length} documents
          </span>
        )}
        {session.locale && <span className="po-chip-locale">{session.locale}</span>}
        <span className="po-sep" />
        <button className="po-btn" onClick={() => session.undo()} disabled={!snap.canUndo} aria-label="Undo" title="Undo (⌘Z)" data-testid="onpage-undo">
          ↶
        </button>
        <button className="po-btn" onClick={() => session.redo()} disabled={!snap.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" data-testid="onpage-redo">
          ↷
        </button>
        <span className="po-sep" />
        {links.mode && (
          <a className="po-btn" href={links.mode('view')} title="See the draft without editing tools" data-testid="onpage-preview">
            Preview
          </a>
        )}
        {links.previewLink && primary && (
          <button className="po-btn" onClick={share} title="Copy a read-only link to this draft" data-testid="onpage-share">
            Share
          </button>
        )}
        <button
          className={`po-btn${confirmDiscard ? ' is-danger' : ''}`}
          disabled={!ready.length}
          onClick={async () => {
            // Two-step: the first click arms, the second (within 4s) discards.
            if (!confirmDiscard) {
              setConfirmDiscard(true);
              return;
            }
            setConfirmDiscard(false);
            await session.discard({ keys: docKeys });
            notify('Draft reset to the published version');
          }}
          onBlur={() => setConfirmDiscard(false)}
          title="Throw away draft changes made here and return to the published content"
          data-testid="onpage-discard"
        >
          {confirmDiscard ? 'Confirm discard?' : 'Discard'}
        </button>
        {links.admin && primary && (
          <a className="po-btn" href={links.admin(primary.ref)} target="_blank" rel="noopener noreferrer" data-testid="onpage-open-admin">
            Admin
          </a>
        )}
        <a className="po-btn" href={links.exit} data-testid="onpage-exit">
          Exit
        </a>
        <button className="po-btn po-primary" disabled={!ready.length || publishing || !!conflict} onClick={publish} title={edited.length ? `Publish ${edited.map(title).join(', ')}` : 'Publish'} data-testid="onpage-publish">
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </>
  );
}
