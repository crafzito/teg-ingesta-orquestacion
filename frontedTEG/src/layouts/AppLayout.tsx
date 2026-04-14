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
      .catch(() => {})
  }, [isAuthenticated, setSidebarSectionsByRole])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const isDesktop = e.matches
      setIsMobile(!isDesktop)
      setSidebarOpen(isDesktop)
    }

    handleChange(mediaQuery)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [setIsMobile, setSidebarOpen])

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
