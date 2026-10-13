import { createServerFn } from '@tanstack/react-start'

/** The writing assistant: signed-in Payload users only (see ../lib/assist.ts). */
export const rewriteText = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      text: string
      instruction: string
      field: { label: string; type: string }
      locale?: string | undefined
    }) => ({
      text: String(data.text).slice(0, 5000),
      instruction: String(data.instruction).slice(0, 300),
      field: { label: String(data.field?.label ?? ''), type: String(data.field?.type ?? 'text') },
      locale: typeof data.locale === 'string' ? data.locale : undefined,
    }),
  )
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const config = (await import('@payload-config')).default
    const { getPayload } = await import('payload')
    const payload = await getPayload({ config })
    const { user } = await payload.auth({
      headers: new Headers(getRequestHeaders() as HeadersInit),
    })
    if (!user) throw new Error('Sign in first')
    const { rewrite } = await import('@/lib/assist')
    return { text: await rewrite(data) }
  })
