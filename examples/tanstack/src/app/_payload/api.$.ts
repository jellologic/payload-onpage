import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_payload/api/$')({
  server: {
    handlers: {
      DELETE: api,
      GET: api,
      OPTIONS: api,
      PATCH: api,
      POST: api,
      PUT: api,
    },
  },
})

/**
 * Routes one REST/GraphQL request to Payload. Imported dynamically so the
 * server-only graph stays inside the literal `server:` key, which TanStack
 * Start's compiler strips from the client bundle (`handleAPIRoute` replaced
 * the old `payloadApiHandlers` helper in payload 4.0.0-beta.4).
 */
async function api({ request }: { request: Request }): Promise<Response> {
  const { handleAPIRoute } = await import('@payloadcms/tanstack-start/server')
  return handleAPIRoute({ config: (await import('@payload-config')).default, request })
}
