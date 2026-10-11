import { withPayloadRoot } from '@payloadcms/tanstack-start/client'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

export const Route = createRootRoute({
  // Single Payload integration touch point: `withPayloadRoot` renders the
  // Payload admin document shell on `/admin` routes and our own shell
  // everywhere else.
  shellComponent: withPayloadRoot(ExampleHtml),
})

function ExampleHtml({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
