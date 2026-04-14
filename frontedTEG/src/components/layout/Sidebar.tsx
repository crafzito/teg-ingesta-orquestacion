import { NavLink } from 'react-router-dom'
import { Button } from '@heroui/react'
import {
  Activity,
  Box,
  ChevronLeft,
  CreditCard,
  Factory,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import type { UserRole } from '../../types/auth'

interface NavItem {
  to: string
  icon: typeof LayoutDashboard
  label: string
  allowedRoles?: UserRole[]
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Principal',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/ventas', icon: TrendingUp, label: 'Ventas' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { to: '/cxc', icon: CreditCard, label: 'Cuentas por Cobrar' },
      { to: '/cxp', icon: Wallet, label: 'Cuentas por Pagar' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/inventario', icon: Package, label: 'Inventario' },
      { to: '/produccion', icon: Factory, label: 'Produccion' },
      { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
    ],
  },
  {
    label: 'Maestros',
    items: [
      { to: '/clientes', icon: Users, label: 'Clientes' },
      { to: '/productos', icon: Box, label: 'Productos' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/etl', icon: Activity, label: 'Monitor ETL', allowedRoles: ['superadmin', 'admin'] },
      { to: '/administracion', icon: ShieldCheck, label: 'Administración', allowedRoles: ['superadmin'] },
    ],
  },
]

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role)
  const { sidebarOpen, toggleSidebar, isMobile, setSidebarOpen, closeSidebarOnMobile } = useUiStore()

  const sidebarWidth = isMobile ? 'w-64' : (sidebarOpen ? 'w-64' : 'w-16')
  const mobileTransform = isMobile
    ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
    : ''
  const showLabels = isMobile || sidebarOpen

  const sidebarSectionsByRole = useUiStore((s) => s.sidebarSectionsByRole)
  const roleSections = role ? sidebarSectionsByRole[role] : undefined

  const visibleGroups = NAV_GROUPS
    .filter((group) => group.label === 'Sistema' || roleSections?.[group.label] !== false)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.allowedRoles || (!!role && item.allowedRoles.includes(role))),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/50 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 flex h-screen flex-col transition-all duration-300 ${sidebarWidth} ${mobileTransform} ${
          isMobile ? 'z-40' : 'z-30'
        }`}
        style={{ backgroundColor: '#091B6B' }}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/img/logo_380.png" alt="Proyectos PET" className="h-9 w-auto flex-shrink-0" />
            {showLabels && (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-bold text-white tracking-wide">Proyectos</span>
                <span className="text-lg font-extrabold tracking-wider" style={{ color: '#FF4E00' }}>PET</span>
              </div>
            )}
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={isMobile ? () => setSidebarOpen(false) : toggleSidebar}
            className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${!isMobile && !sidebarOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        <nav className="sidebar-nav flex-1 overflow-y-auto py-4 px-2">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {showLabels && (
                <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={closeSidebarOnMobile}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'text-white shadow-sm'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        } ${!showLabels ? 'justify-center px-0' : ''}`
                      }
                      style={({ isActive }) => (isActive ? { backgroundColor: '#FF4E00' } : undefined)}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {showLabels && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
