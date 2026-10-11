import { editable } from '@payload-onpage/react/annotations'
import { PageView } from './PageView'
import { InstantPage } from './InstantPage'

export function PageRoute({
  page,
  editing,
}: {
  page: Record<string, any> | null
  editing: boolean
}) {
  if (!page) return <main data-testid="page">Not found</main>
  if (page.instant) return <InstantPage page={page} />
  const e = editable({ collection: 'pages', doc: page }, { enabled: editing })
  return <PageView page={page} e={e} />
}
