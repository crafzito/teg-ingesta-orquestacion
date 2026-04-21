import { Navigate, Outlet } from 'react-router-dom'

import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuthStore } from '../stores/authStore'

export function AuthLayout() {
  const initialized = useAuthStore((s) => s.initialized)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!initialized) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#091B6B]/5 to-[#091B6B]/15 flex items-center justify-center p-4">
      <Outlet />
    </div>
  )
}
