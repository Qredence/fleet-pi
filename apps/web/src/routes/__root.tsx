import { QueryClientProvider } from "@tanstack/react-query"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { useEffect } from "react"

import { initAnalytics } from "@/lib/analytics/posthog"
import { getQueryClient } from "@/lib/query-client"
import { NotFoundPage } from "@workspace/hax-design/components/fleet-pi/not-found-page"
import { Toaster } from "@workspace/hax-design/components/sonner"
import appCss from "@workspace/hax-design/globals.css?url"

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
  component: RootComponent,
  notFoundComponent: () => <NotFoundPage />,
  shellComponent: RootDocument,
})

function RootComponent() {
  useEffect(() => {
    initAnalytics()
  }, [])

  return (
    <QueryClientProvider client={getQueryClient()}>
      <Outlet />
    </QueryClientProvider>
  )
}

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
