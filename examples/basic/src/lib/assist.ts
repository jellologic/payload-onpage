/**
 * The example's writing assistant. With ANTHROPIC_API_KEY it asks Claude;
 * without one it falls back to a tiny demo rewrite (so the example and its
 * tests work offline). Server-only: the key never reaches the browser.
 */
export interface AssistInput {
  text: string
  instruction: string
  field: { label: string; type: string }
  locale?: string | undefined
}

export async function rewrite({ text, instruction, field, locale }: AssistInput): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return demo(text, instruction)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: 1024,
      system:
        'You rewrite text for one field of a web page. Reply with the new text only: no quotes, no commentary. Keep its language unless the instruction says to translate.',
      messages: [
        {
          role: 'user',
          content: `Field: ${field.label} (${field.type})${locale ? `\nContent language: ${locale}` : ''}\nInstruction: ${instruction}\n\nText:\n${text}`,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`The assistant failed (${res.status})`)
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return json.content?.find((c) => c.type === 'text')?.text?.trim() ?? text
}

/** Offline stand-in: shortens and tidies, and says so for anything else. */
function demo(text: string, instruction: string): string {
  const words = text.trim().split(/\s+/)
  if (/shorter/i.test(instruction))
    return words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(' ')
  if (/spelling/i.test(instruction)) return words.join(' ')
  return `${text} (demo assistant: set ANTHROPIC_API_KEY for real answers)`
}
