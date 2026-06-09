import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@workspace/hax-design/components/sonner"
import { NotFoundPage } from "@workspace/hax-design/components/fleet-pi/not-found-page"

import appCss from "@workspace/hax-design/globals.css?url"
import { getQueryClient } from "@/lib/query-client"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Qredence Fleet Pi",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: () => (
    <QueryClientProvider client={getQueryClient()}>
      <Outlet />
    </QueryClientProvider>
  ),
  notFoundComponent: () => <NotFoundPage />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
