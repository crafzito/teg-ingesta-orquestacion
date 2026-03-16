import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { useUiStore } from '../stores/uiStore'

export function AppLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)

  return (
    <div className="min-h-screen bg-default-50">
      <Sidebar />
      <Header />
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
