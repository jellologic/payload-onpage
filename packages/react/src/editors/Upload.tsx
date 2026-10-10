'use client';

/**
 * Image editor: pick from the upload collection (search, pages) or upload a
 * new file, through the MediaLibrary port. The chosen document goes into state
 * populated, so a client-rendered page shows it at once; saving sends its id.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@payload-onpage/core';
import { useOnPage, type FieldEditorProps } from '../context.tsx';

export function UploadEditor({ field, value, commit, close }: FieldEditorProps) {
  const { media } = useOnPage();
  const relationTo = (Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo) ?? 'media';
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await media.search({ query, page, relationTo });
        if (!live) return;
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        setError(null);
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [media, relationTo, query, page]);

  const choose = (m: MediaItem) => {
    commit(m.doc);
    close();
  };
  const upload = async (file: File) => {
    if (!media.upload) return;
    setBusy(true);
    try {
      choose(await media.upload(file, { relationTo }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const currentId = value && typeof value === 'object' ? (value as { id?: unknown }).id : value;

  return (
    <div className="po-modal-bg" onClick={close} data-testid="onpage-media-picker">
      <div className="po-modal" role="dialog" aria-label={`Choose ${field.label}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="po-h3">{field.label}</div>
          <input
            className="po-input"
            style={{ width: 240 }}
            placeholder="Search images…"
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            data-testid="onpage-media-search"
          />
          {media.upload && (
            <>
              <button className="po-btn" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="onpage-media-upload">
                Upload…
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </>
          )}
          {!field.required && currentId != null && (
            <button
              className="po-btn"
              onClick={() => {
                commit(null);
                close();
              }}
              data-testid="onpage-media-remove"
            >
              Remove
            </button>
          )}
          <button className="po-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="po-body">
          {error && <p style={{ color: '#b91c1c', margin: '0 0 10px' }}>{error}</p>}
          <div className="po-grid">
            {items.map((m) => (
              <button key={String(m.id)} className="po-tile" onClick={() => choose(m)} aria-current={String(m.id) === String(currentId)} data-testid={`onpage-media-${m.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.thumbnailUrl ?? m.url ?? ''} alt={m.alt ?? ''} loading="lazy" />
                <span>{m.alt || m.filename}</span>
              </button>
            ))}
          </div>
          {!busy && !items.length && <p style={{ color: '#64748b' }}>No images found.</p>}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="po-btn" onClick={() => setPage((p) => p + 1)} disabled={busy}>
                Load more
              </button>
            </div>
          )}
          {busy && <p style={{ color: '#64748b' }}>Loading…</p>}
        </div>
      </div>
    </div>
  );
}
