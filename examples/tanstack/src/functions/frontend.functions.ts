import { createServerFn } from '@tanstack/react-start'

async function payload() {
  const config = (await import('@payload-config')).default
  const { getPayload } = await import('payload')
  return getPayload({ config })
}

/** A page by slug: the draft for editors and preview links, the published version for everyone else. */
export const getPageData = createServerFn({ method: 'GET' })
  .validator((data: { slug: string }) => data)
  // Plain JSON at runtime; widened here because Start's serializability
  // validator cannot prove the generated Lexical union serializable.
  .handler(async ({ data }): Promise<{ page: Record<string, any> | null; editing: boolean }> => {
    const { isDraftEnabled, onpageContext, getOnPageMode } =
      await import('@payload-onpage/tanstack-start/session')
    const draft = await isDraftEnabled()
    const { docs } = await (
      await payload()
    ).find({
      collection: 'pages',
      where: draft
        ? { slug: { equals: data.slug } }
        : { and: [{ slug: { equals: data.slug } }, { _status: { equals: 'published' } }] },
      draft,
      depth: 1,
      limit: 1,
      // In edit mode, strings come back with invisible field markers (auto-mapping).
      ...(await onpageContext()),
    })
    return { page: docs[0] ?? null, editing: (await getOnPageMode()) === 'edit' }
  })

export const getHeaderData = createServerFn({ method: 'GET' }).handler(async () => {
  const { isDraftEnabled, onpageContext } = await import('@payload-onpage/tanstack-start/session')
  const draft = await isDraftEnabled()
  return await (
    await payload()
  ).findGlobal({ slug: 'header', draft, depth: 0, ...(await onpageContext()) })
})
