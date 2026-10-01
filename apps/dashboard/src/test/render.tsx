import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, type MemoryRouterProps } from 'react-router'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type ReactElement, type ReactNode } from 'react'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface RenderAppOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  routerProps?: MemoryRouterProps
}

/**
 * Renders a node with the same provider stack the app uses in main.tsx:
 * QueryClient + Router (memory) + nuqs adapter.
 */
export function renderWithProviders(
  ui: ReactNode,
  { queryClient = createTestQueryClient(), routerProps, ...renderOptions }: RenderAppOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter {...routerProps}>
          <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  return { queryClient, ...render(<div>{ui}</div>, { wrapper: Wrapper, ...renderOptions }) }
}

/** Convenience for rendering raw JSX elements. */
export function renderUi(ui: ReactElement, options: RenderAppOptions = {}) {
  return renderWithProviders(ui, options)
}
