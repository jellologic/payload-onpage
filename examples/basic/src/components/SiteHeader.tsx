/** The header global: auto-mapped like any document, edited on the same page as the page itself. */
import React from 'react'
import { getHeader } from '@/lib/data'

export async function SiteHeader() {
  const header = await getHeader()
  return (
    <header className="site-header" data-testid="site-header">
      <a href="/" className="brand">
        {header.siteName}
      </a>
      {header.tagline && <span className="tagline">{header.tagline}</span>}
      <nav>
        {(header.nav ?? []).map((l, i) => (
          <a key={l.id ?? i} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
