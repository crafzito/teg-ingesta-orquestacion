import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../stores/authStore'
import { useUiStore } from '../stores/uiStore'
import { API_BASE } from '../config/env'

export function AppLayout() {
  const { sidebarOpen, isMobile, setIsMobile, setSidebarOpen } = useUiStore()
  const setSidebarSectionsByRole = useUiStore((s) => s.setSidebarSectionsByRole)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Hydrate sidebar section config from backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    const token = localStorage.getItem('teg_auth_token')
    if (!token) return

    fetch(`${API_BASE}/admin/sidebar-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Record<string, Record<string, boolean>>>
      })
      .then((data) => setSidebarSectionsByRole(data))
      .catch(() => {
        // Fallback: keep defaults already in the store
      })
  }, [isAuthenticated, setSidebarSectionsByRole])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const isDesktop = e.matches
      setIsMobile(!isDesktop)

      if (isDesktop) {
        // Switching to desktop: expand sidebar by default
        setSidebarOpen(true)
      } else {
        // Switching to mobile: hide sidebar by default
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [setIsMobile, setSidebarOpen])

  // On mobile: no left margin (sidebar overlays)
  // On desktop: margin matches sidebar width
  const mainMargin = isMobile ? 'ml-0' : (sidebarOpen ? 'ml-64' : 'ml-16')

  return (
    <div className="flex h-screen overflow-hidden bg-default-50">
      <Sidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ${mainMargin}`}>
        <Header />
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
