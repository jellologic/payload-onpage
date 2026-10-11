/** Client mode: the page renders from editor state, so edits show instantly. */
import React from 'react'
import { OnPageClient } from '@payload-onpage/react/client'
import { PageView } from './PageView'

export function InstantPage({ page }: { page: Record<string, any> }) {
  return (
    <OnPageClient
      collection="pages"
      doc={page}
      render={(doc, e) => <PageView page={doc} e={e} />}
    />
  )
}
