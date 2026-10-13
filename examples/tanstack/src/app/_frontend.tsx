import { createFileRoute, Outlet } from '@tanstack/react-router'
import { OnPage } from '@payload-onpage/tanstack-start'
import { getHeaderData } from '@/functions/frontend.functions'
import { SiteHeader } from '@/components/SiteHeader'
import { Mount } from '@/components/OnPageMount'
import './styles.css'

export const Route = createFileRoute('/_frontend')({
  loader: async () => ({ header: await getHeaderData() }),
  component: FrontendLayout,
})

function FrontendLayout() {
  const { header } = Route.useLoaderData()
  return (
    <>
      <SiteHeader header={header as Record<string, any>} />
      <Outlet />
      <footer className="site-footer">
        Signed in? Open a page in the <a href="/admin/collections/pages">admin</a> and press{' '}
        <b>Edit on page</b>.
      </footer>
      {/* Renders nothing unless an editor turned on edit or preview mode. */}
      <OnPage mount={Mount} />
    </>
  )
}
