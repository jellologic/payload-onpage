import { renderPage } from '../render'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return renderPage(slug)
}
