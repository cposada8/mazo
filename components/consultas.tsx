'use client'

/**
 * Server state (Phase 33). Per `tech-stack.md`, TanStack Query enters "only
 * once online play needs polling" — which is now: a lobby has to notice
 * somebody sitting down on another phone.
 *
 * One client for the whole app, created once per browser session.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function ProveedorDeConsultas({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A lobby is read fresh or not at all: someone joining and the
            // seat list disagreeing is exactly the bug this screen must not
            // have.
            staleTime: 0,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}
