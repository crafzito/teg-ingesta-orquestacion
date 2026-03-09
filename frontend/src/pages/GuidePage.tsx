import { useState } from 'react'
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  Globe,
  Database,
  Settings,
  BarChart3,
  Lightbulb,
  Monitor,
} from 'lucide-react'

interface Step {
  id: number
  title: string
  icon: React.ReactNode
  content: React.ReactNode
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-mono font-semibold text-slate-700 truncate">{value}</p>
      </div>
      <button
        onClick={handle}
        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          copied
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
        }`}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
      <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Abre Google Looker Studio',
    icon: <Globe size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Ve a{' '}
          <a
            href="https://lookerstudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            lookerstudio.google.com
            <ExternalLink size={12} />
          </a>{' '}
          e inicia sesión con tu cuenta de Google.
        </p>
        <p className="text-sm text-slate-600">
          En la pantalla principal, haz clic en el botón azul <strong>«Crear»</strong> y luego
          selecciona <strong>«Informe»</strong>.
        </p>
        <Tip>
          Si es la primera vez que lo usas, Looker Studio te pedirá que configures una fuente
          de datos. Puedes ir directamente al paso 2.
        </Tip>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Agrega una nueva fuente de datos',
    icon: <Database size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Al crear un informe o desde el menú <strong>Recurso → Gestionar fuentes de datos</strong>,
          haz clic en <strong>«Agregar una fuente de datos»</strong> (botón azul en la esquina
          inferior izquierda).
        </p>
        <p className="text-sm text-slate-600">
          En el buscador de conectores, escribe <strong>«PostgreSQL»</strong> y selecciónalo.
        </p>
        <Tip>
          Looker Studio tiene un conector nativo para PostgreSQL. No necesitas instalar nada
          adicional.
        </Tip>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Ingresa los datos de conexión',
    icon: <Settings size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 mb-2">
          Completa el formulario del conector PostgreSQL con estos valores:
        </p>
        <div className="space-y-2">
          <CopyField label="Host / Nombre del servidor" value="localhost" />
          <CopyField label="Puerto" value="5432" />
          <CopyField label="Base de datos" value="sap_etl" />
          <CopyField label="Usuario" value="postgres" />
        </div>
        <Warning>
          La contraseña te la debe proporcionar el administrador del sistema. Por defecto es
          <span className="font-mono ml-1">postgres</span>, pero esto varía en producción.
        </Warning>
        <Tip>
          Si la base de datos está en un servidor remoto, usa la IP o dominio del servidor
          en lugar de <span className="font-mono">localhost</span>.
        </Tip>
      </div>
    ),
  },
  {
    id: 4,
    title: 'Selecciona el schema y la vista',
    icon: <Monitor size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Después de conectar, Looker Studio te mostrará los schemas disponibles.
          Selecciona el schema <strong className="font-mono">public</strong>.
        </p>
        <div className="space-y-2">
          <CopyField label="Schema a seleccionar" value="public" />
        </div>
        <p className="text-sm text-slate-600">
          Verás la lista de vistas disponibles. Selecciona la que necesitas según tu reporte:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'v_ventas', desc: 'Ventas detalladas' },
            { name: 'v_cxc', desc: 'Cuentas por cobrar' },
            { name: 'v_cxp', desc: 'Cuentas por pagar' },
            { name: 'v_inventario', desc: 'Stock en almacenes' },
            { name: 'v_ordenes', desc: 'Órdenes de producción' },
            { name: 'v_pedidos', desc: 'Pedidos SAP' },
          ].map((v) => (
            <div key={v.name} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <p className="font-mono text-xs font-semibold text-slate-700">{v.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{v.desc}</p>
            </div>
          ))}
        </div>
        <Tip>
          También puedes seleccionar vistas personalizadas que hayas creado desde la sección
          «Fuentes Looker» de esta aplicación.
        </Tip>
      </div>
    ),
  },
  {
    id: 5,
    title: 'Conectar y verificar campos',
    icon: <CheckCircle2 size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Haz clic en <strong>«Conectar»</strong> (botón azul en la esquina superior derecha).
          Looker Studio cargará todos los campos de la vista automáticamente.
        </p>
        <p className="text-sm text-slate-600">
          Verás la lista de campos con su tipo de dato. Verifica que estén correctos y haz clic
          en <strong>«Crear informe»</strong>.
        </p>
        <Tip>
          Puedes cambiar el tipo de campo aquí si Looker no lo detectó correctamente (por ejemplo,
          convertir un texto a fecha o número).
        </Tip>
        <Warning>
          Si ves el error <em>«No se pudo conectar»</em>, verifica que el servidor PostgreSQL
          esté corriendo y que el usuario tenga permisos de lectura en el schema{' '}
          <span className="font-mono">public</span>.
        </Warning>
      </div>
    ),
  },
  {
    id: 6,
    title: 'Construye tu reporte',
    icon: <BarChart3 size={18} />,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          ¡Listo! Ahora puedes arrastrar campos al lienzo y crear tablas, gráficos y scorecards.
          Algunos tips para empezar:
        </p>
        <ul className="space-y-2 text-sm text-slate-600">
          {[
            'Usa el panel derecho para agregar métricas (números) y dimensiones (categorías).',
            'Los filtros de Looker se aplican sobre la vista — no modifican los datos en PostgreSQL.',
            'Puedes combinar múltiples vistas en un mismo informe usando «Fuentes de datos combinadas».',
            'Si necesitas una vista con filtros predefinidos, créala desde «Fuentes Looker» en esta app.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
]

export default function GuidePage() {
  const [openStep, setOpenStep] = useState<number | null>(1)

  return (
    <div className="w-full max-w-3xl space-y-4">
      {/* Banner */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-1">
          Guía: conectar Looker Studio a PostgreSQL
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Sigue estos pasos para conectar Google Looker Studio directamente a las vistas del
          sistema SAP. No necesitas conocimientos técnicos avanzados.
        </p>
        <div className="flex items-center gap-2 mt-3">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  openStep && openStep >= s.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {s.id}
              </div>
              {s.id < STEPS.length && (
                <div
                  className={`w-5 h-0.5 ${
                    openStep && openStep > s.id ? 'bg-blue-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Steps accordion */}
      <div className="space-y-2">
        {STEPS.map((step) => (
          <div key={step.id} className="card overflow-hidden">
            <button
              onClick={() => setOpenStep(openStep === step.id ? null : step.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  openStep === step.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-400">Paso {step.id}</span>
                <p className="text-sm font-semibold text-slate-700">{step.title}</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${
                  openStep === step.id ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openStep === step.id && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                {step.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Final note */}
      <div className="card p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <p className="text-sm font-semibold text-blue-800 mb-1">¿Necesitas una vista nueva?</p>
        <p className="text-sm text-blue-700 leading-relaxed">
          Si los datos que necesitas no están en ninguna vista, ve a{' '}
          <strong>«Fuentes Looker»</strong> y crea una vista personalizada con filtros. Así
          Looker Studio siempre verá exactamente los datos que tú defines.
        </p>
      </div>
    </div>
  )
}
