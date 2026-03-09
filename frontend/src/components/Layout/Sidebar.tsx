import {
  LayoutDashboard,
  Database,
  BookOpen,
  Terminal,
  ChevronRight,
  Activity,
  FileJson,
} from 'lucide-react'
import type { Page } from '../../types'

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
  description: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: <LayoutDashboard size={18} />,
    description: 'Resumen del sistema',
  },
  {
    id: 'views',
    label: 'Fuentes Looker',
    icon: <Database size={18} />,
    description: 'Gestionar vistas públicas',
  },
  {
    id: 'guide',
    label: 'Guía de Conexión',
    icon: <BookOpen size={18} />,
    description: 'Cómo conectar Looker Studio',
  },
  {
    id: 'sql',
    label: 'SQL Explorer',
    icon: <Terminal size={18} />,
    description: 'Ejecutar consultas ad-hoc',
  },
  {
    id: 'export',
    label: 'Exportar / API',
    icon: <FileJson size={18} />,
    description: 'Exportar datos como JSON',
  },
]

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  healthy: boolean | null
}

export default function Sidebar({ current, onNavigate, healthy }: Props) {
  return (
    <aside className="w-64 bg-slate-800 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Database size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">TEG Manager</p>
            <p className="text-slate-400 text-xs">Looker Studio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`sidebar-item w-full text-left group ${
              current === item.id ? 'sidebar-item-active' : 'sidebar-item-inactive'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {current === item.id && (
              <ChevronRight size={14} className="opacity-70" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer status */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400">Estado del backend</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              healthy === null
                ? 'bg-slate-500 animate-pulse'
                : healthy
                ? 'bg-green-400'
                : 'bg-red-400'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              healthy === null
                ? 'text-slate-400'
                : healthy
                ? 'text-green-400'
                : 'text-red-400'
            }`}
          >
            {healthy === null ? 'Verificando…' : healthy ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">localhost:8000</p>
      </div>
    </aside>
  )
}
