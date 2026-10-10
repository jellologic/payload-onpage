'use client'

import type { ReactNode } from 'react'

/** A button that POSTs to `action` and navigates to the response (for the plugin's state-changing endpoints). */
export function PostButton({
  action,
  children,
  className = 'po-btn',
  title,
  testId,
  target,
}: {
  action: string
  children: ReactNode
  className?: string
  title?: string
  testId?: string
  target?: '_blank' | '_self'
}) {
  return (
    <form method="post" action={action} target={target} style={{ display: 'contents' }}>
      <button type="submit" className={className} title={title} data-testid={testId}>
        {children}
      </button>
    </form>
  )
}
