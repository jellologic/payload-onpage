'use client'

// The editor's client options: here, a writing assistant (see ../onpage-assist/route.ts).
import type { AssistPort } from '@payload-onpage/core'
import { OnPageMount, type OnPageMountProps } from '@payload-onpage/next/client'

const assist: AssistPort = {
  async rewrite({ text, instruction, field, locale, signal }) {
    const res = await fetch('/onpage-assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, instruction, field, locale }),
      ...(signal ? { signal } : {}),
    })
    if (!res.ok) throw new Error(await res.text())
    return ((await res.json()) as { text: string }).text
  },
}

export function Mount(props: OnPageMountProps) {
  return <OnPageMount {...props} assist={assist} />
}
