'use client'

/**
 * Image editor: pick from the upload collection (search, pages) or upload a
 * new file, through the MediaLibrary port. The chosen document goes into state
 * populated, so a client-rendered page shows it at once; saving sends its id.
 */
import { relationId, type MediaItem } from '@payload-onpage/core'
import { useCallback, useRef, useState } from 'react'
import { useOnPage } from '../context.tsx'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { useDebouncedSearch } from './useDebouncedSearch.ts'

export function UploadEditor({ field, value, commit, close, t }: FieldEditorProps) {
  const { media } = useOnPage()
  const relationTo =
    (Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo) ?? 'media'
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const search = useCallback(
    (query: string, page: number) =>
      media
        ? media.search({ query, page, relationTo })
        : Promise.resolve({ items: [] as MediaItem[], hasMore: false }),
    [media, relationTo],
  )
  const results = useDebouncedSearch<MediaItem>(media ? search : null, [])
  const currentId = relationId(value)

  const choose = (m: MediaItem) => {
    commit(m.doc)
    close()
  }
  const upload = async (file: File) => {
    if (!media?.upload) return
    setUploading(true)
    try {
      choose(await media.upload(file, { relationTo }))
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const actions = (
    <>
      <input
        className="po-input po-search"
        aria-label={t('media.search')}
        placeholder={t('media.search')}
        value={results.query}
        data-autofocus
        onChange={(e) => results.setQuery(e.target.value)}
        data-testid="onpage-media-search"
      />
      {media?.upload && (
        <>
          <button
            type="button"
            className="po-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            data-testid="onpage-media-upload"
          >
            {t('media.upload')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
        </>
      )}
      {!field.required && currentId != null && (
        <button
          type="button"
          className="po-btn"
          onClick={() => {
            commit(null)
            close()
          }}
          data-testid="onpage-media-remove"
        >
          {t('common.remove')}
        </button>
      )}
    </>
  )

  return (
    <Dialog
      title={field.label}
      onClose={close}
      t={t}
      actions={actions}
      testId="onpage-media-picker"
    >
      {(results.error ?? uploadError) && <p className="po-error">{results.error ?? uploadError}</p>}
      <div className="po-grid">
        {results.items.map((m) => (
          <button
            key={String(m.id)}
            type="button"
            className="po-tile"
            onClick={() => choose(m)}
            aria-current={String(m.id) === String(currentId)}
            data-testid={`onpage-media-${m.id}`}
          >
            <img src={m.thumbnailUrl ?? m.url ?? ''} alt={m.alt ?? ''} loading="lazy" />
            <span>{m.alt || m.filename}</span>
          </button>
        ))}
      </div>
      {!results.busy && !results.items.length && <p className="po-muted">{t('media.empty')}</p>}
      {results.hasMore && (
        <div className="po-center">
          <button type="button" className="po-btn" onClick={results.more} disabled={results.busy}>
            {t('media.more')}
          </button>
        </div>
      )}
      {(results.busy || uploading) && <p className="po-muted">{t('media.loading')}</p>}
    </Dialog>
  )
}
