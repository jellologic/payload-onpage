import { createFileRoute } from '@tanstack/react-router'
import { getPageData } from '@/functions/frontend.functions'
import { PageRoute } from '@/components/PageRoute'

export const Route = createFileRoute('/_frontend/')({
  loader: () => getPageData({ data: { slug: 'home' } }),
  component: HomePage,
})

function HomePage() {
  const { page, editing } = Route.useLoaderData()
  return <PageRoute page={page} editing={editing} />
}
