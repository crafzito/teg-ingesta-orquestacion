import type { Page } from '../../types'

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Inicio',
    subtitle: 'Resumen general del sistema ETL y Looker Studio',
  },
  views: {
    title: 'Fuentes Looker',
    subtitle: 'Gestiona las vistas públicas disponibles para conectar en Looker Studio',
  },
  guide: {
    title: 'Guía de Conexión',
    subtitle: 'Instrucciones paso a paso para conectar Looker Studio a PostgreSQL',
  },
  sql: {
    title: 'SQL Explorer',
    subtitle: 'Ejecuta consultas de solo lectura sobre la base de datos',
  },
  export: {
    title: 'Exportar / API',
    subtitle: 'Exporta datos de cualquier vista como JSON y obtén la URL del API para integrar',
  },
}

interface Props {
  page: Page
  healthy: boolean | null
}

export default function Header({ page, healthy }: Props) {
  const meta = PAGE_META[page]
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{meta.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{meta.subtitle}</p>
        </div>
        {healthy === false && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            <span className="text-xs font-medium text-red-600">Backend no disponible</span>
          </div>
        )}
      </div>
    </header>
  )
}
