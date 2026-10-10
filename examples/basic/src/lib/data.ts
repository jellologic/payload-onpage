import { getPayload } from 'payload'
import config from '@payload-config'
import { isDraftEnabled, onpageContext } from '@payload-onpage/next'

/** A page by slug: the draft for editors and preview links, the published version for everyone else. */
export async function getPage(slug: string) {
  const draft = await isDraftEnabled()
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    where: draft ? { slug: { equals: slug } } : { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
    draft,
    depth: 1,
    limit: 1,
    // In edit mode, strings come back with invisible field markers (auto-mapping).
    ...(await onpageContext()),
  })
  return docs[0] ?? null
}

export async function getHeader() {
  const draft = await isDraftEnabled()
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'header', draft, depth: 0, ...(await onpageContext()) })
}
