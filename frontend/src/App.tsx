import { useState, useEffect } from 'react'
import type { Page } from './types'
import { checkHealth } from './api'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'
import Dashboard from './pages/Dashboard'
import ViewsPage from './pages/ViewsPage'
import GuidePage from './pages/GuidePage'
import SqlExplorer from './pages/SqlExplorer'
import ExportPage from './pages/ExportPage'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [healthy, setHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    checkHealth()
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false))
  }, [])

  const pageComponents: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setPage} healthy={healthy} />,
    views: <ViewsPage />,
    guide: <GuidePage />,
    sql: <SqlExplorer />,
    export: <ExportPage />,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar current={page} onNavigate={setPage} healthy={healthy} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header page={page} healthy={healthy} />
        <main className="flex-1 overflow-y-auto p-6">
          {pageComponents[page]}
        </main>
      </div>
    </div>
  )
}
