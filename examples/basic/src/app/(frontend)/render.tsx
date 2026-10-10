import React from 'react'
import { notFound } from 'next/navigation'
import { getOnPageMode } from '@payload-onpage/next'
import { editable } from '@payload-onpage/react/annotations'
import { getPage } from '@/lib/data'
import { InstantPage } from '@/components/InstantPage'
import { PageView } from '@/components/PageView'

export async function renderPage(slug: string) {
  const page = await getPage(slug)
  if (!page) notFound()
  if (page.instant) return <InstantPage page={page} />
  const e = editable({ collection: 'pages', doc: page }, { enabled: (await getOnPageMode()) === 'edit' })
  return <PageView page={page} e={e} />
}
