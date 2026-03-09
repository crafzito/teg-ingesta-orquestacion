import { useEffect, useState } from 'react'
import {
  Database,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  BookOpen,
} from 'lucide-react'
import type { Page, LookerView } from '../types'
import { getLookerViews } from '../api'

interface Props {
  onNavigate: (page: Page) => void
  healthy: boolean | null
}

interface StatCard {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

export default function Dashboard({ onNavigate, healthy }: Props) {
  const [views, setViews] = useState<LookerView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLookerViews()
      .then(setViews)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalViews = views.length
  const customViews = views.filter((v) => v.is_custom).length
  const protectedViews = totalViews - customViews

  const stats: StatCard[] = [
    {
      label: 'Vistas en Looker',
      value: loading ? '…' : totalViews,
      icon: <Database size={20} />,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Vistas protegidas',
      value: loading ? '…' : protectedViews,
      icon: <Layers size={20} />,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Vistas personalizadas',
      value: loading ? '…' : customViews,
      icon: <FileSpreadsheet size={20} />,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Estado del sistema',
      value: healthy === null ? 'Verificando' : healthy ? 'Activo' : 'Inactivo',
      icon: healthy === null
        ? <AlertCircle size={20} />
        : healthy
        ? <CheckCircle2 size={20} />
        : <AlertCircle size={20} />,
      color:
        healthy === null
          ? 'bg-slate-50 text-slate-500'
          : healthy
          ? 'bg-green-50 text-green-600'
          : 'bg-red-50 text-red-500',
    },
  ]

  return (
    <div className="w-full space-y-6">
      {/* Bienvenida */}
      <div className="card p-6 bg-gradient-to-r from-blue-600 to-blue-700 border-0 text-white">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white/20 rounded-lg">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Bienvenido al Gestor de Fuentes</h2>
            <p className="text-blue-100 mt-1 text-sm leading-relaxed">
              Desde aquí puedes ver y crear las <strong>vistas públicas</strong> que conectan
              tu base de datos SAP con <strong>Looker Studio</strong>. No necesitas escribir SQL:
              solo selecciona una fuente, aplica filtros si los necesitas, y copia el nombre
              de la vista en Looker.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`inline-flex p-2 rounded-lg ${s.color}`}>{s.icon}</div>
            <p className="text-2xl font-bold text-slate-800 mt-2">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Acciones rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            title="Gestionar Fuentes"
            description="Ver, crear y eliminar vistas públicas disponibles en Looker Studio."
            icon={<Database size={18} className="text-blue-600" />}
            onClick={() => onNavigate('views')}
            badge="Principal"
            badgeColor="bg-blue-100 text-blue-700"
          />
          <ActionCard
            title="Guía de Conexión"
            description="Aprende paso a paso cómo conectar Looker Studio a PostgreSQL."
            icon={<BookOpen size={18} className="text-purple-600" />}
            onClick={() => onNavigate('guide')}
            badge="Tutorial"
            badgeColor="bg-purple-100 text-purple-700"
          />
          <ActionCard
            title="SQL Explorer"
            description="Ejecuta consultas de solo lectura para explorar los datos."
            icon={<BarChart3 size={18} className="text-emerald-600" />}
            onClick={() => onNavigate('sql')}
            badge="Avanzado"
            badgeColor="bg-emerald-100 text-emerald-700"
          />
        </div>
      </div>

      {/* Info de conexión rápida */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Datos de conexión PostgreSQL
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Host', value: 'localhost' },
            { label: 'Puerto', value: '5432' },
            { label: 'Base de datos', value: 'sap_etl' },
            { label: 'Schema a usar', value: 'public' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className="text-sm font-mono font-semibold text-slate-700">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          💡 En Looker Studio siempre selecciona el schema{' '}
          <span className="font-mono bg-slate-100 px-1 rounded">public</span> para acceder
          a las vistas del sistema.
        </p>
      </div>
    </div>
  )
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
  badge,
  badgeColor,
}: {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  badge: string
  badgeColor: string
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div>
        <span className={`badge ${badgeColor}`}>{badge}</span>
      </div>
      <h4 className="font-semibold text-slate-700 text-sm mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Abrir <ArrowRight size={12} className="ml-1" />
      </div>
    </button>
  )
}
