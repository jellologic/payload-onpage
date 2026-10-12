// The writing assistant's endpoint: signed-in Payload users only, same-origin JSON.
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { rewrite } from '@/lib/assist'

export async function POST(req: Request): Promise<Response> {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return new Response('Cross-site request refused', { status: 403 })
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return new Response('Sign in first', { status: 401 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const text = typeof body?.text === 'string' ? body.text.slice(0, 5000) : null
  const instruction = typeof body?.instruction === 'string' ? body.instruction.slice(0, 300) : null
  if (text === null || !instruction)
    return new Response('Expected text and instruction', { status: 400 })
  const field = (body?.field ?? {}) as { label?: unknown; type?: unknown }
  return Response.json({
    text: await rewrite({
      text,
      instruction,
      field: { label: String(field.label ?? ''), type: String(field.type ?? 'text') },
      locale: typeof body?.locale === 'string' ? body.locale : undefined,
    }),
  })
}
