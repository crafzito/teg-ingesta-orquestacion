import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { useUiStore } from '../stores/uiStore'

export function AppLayout() {
  const { sidebarOpen, isMobile, setIsMobile, setSidebarOpen } = useUiStore()

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
    <div className="min-h-screen bg-default-50">
      <Sidebar />
      <Header />
      <main
        className={`pt-16 transition-all duration-300 ${mainMargin}`}
      >
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
