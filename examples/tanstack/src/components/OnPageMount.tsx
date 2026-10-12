// The editor's client options: here, a writing assistant (see ../functions/assist.functions.ts).
import type { AssistPort } from '@payload-onpage/core'
import { OnPageMount, type OnPageMountProps } from '@payload-onpage/tanstack-start/client'
import { rewriteText } from '@/functions/assist.functions'

const assist: AssistPort = {
  async rewrite({ text, instruction, field, locale }) {
    return (await rewriteText({ data: { text, instruction, field, locale } })).text
  },
}

export function Mount(props: OnPageMountProps) {
  return <OnPageMount {...props} assist={assist} />
}
