import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPageData } from '@/functions/frontend.functions'
import { PageRoute } from '@/components/PageRoute'

export const Route = createFileRoute('/_frontend/$slug')({
  loader: async ({ params }) => {
    const data = await getPageData({ data: { slug: decodeURIComponent(params.slug) } })
    if (!data.page) throw notFound()
    return data
  },
  component: SlugPage,
})

function SlugPage() {
  const { page, editing } = Route.useLoaderData()
  return <PageRoute page={page} editing={editing} />
}
