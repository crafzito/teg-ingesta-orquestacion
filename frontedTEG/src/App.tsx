import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeroUIProvider } from '@heroui/react'
import { Toaster } from 'sonner'

import { EtlRealtimeBridge } from './components/system/EtlRealtimeBridge'
import { AppRouter } from './router'
import { useAuthStore } from './stores/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function Bootstrapper() {
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return null
}

export default function App() {
  return (
    <HeroUIProvider>
      <Toaster position="top-right" richColors closeButton />
      <QueryClientProvider client={queryClient}>
        <Bootstrapper />
        <EtlRealtimeBridge />
        <AppRouter />
      </QueryClientProvider>
    </HeroUIProvider>
  )
}
