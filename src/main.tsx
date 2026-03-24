import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import '@/index.css'
import '@/stores/authStore'
import { router } from './router'
import { DirectionProvider } from './components/ui/direction.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <DirectionProvider dir='rtl' direction='rtl'>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </DirectionProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  </StrictMode>,
)
