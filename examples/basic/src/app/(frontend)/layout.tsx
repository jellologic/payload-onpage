import React, { Suspense } from 'react'
import { OnPage } from '@payload-onpage/next'
import { SiteHeader } from '@/components/SiteHeader'
import './styles.css'

export const metadata = { title: 'payload-onpage example' }

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          Signed in? Open a page in the <a href="/admin/collections/pages">admin</a> and press <b>Edit on page</b>.
        </footer>
        {/* Renders nothing unless an editor turned on edit or preview mode. */}
        <Suspense fallback={null}>
          <OnPage />
        </Suspense>
      </body>
    </html>
  )
}
