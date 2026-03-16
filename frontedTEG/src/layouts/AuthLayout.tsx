import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-default-100 to-primary-50 flex items-center justify-center p-4">
      <Outlet />
    </div>
  )
}
