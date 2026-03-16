import { NavLink } from 'react-router-dom'
import { Button } from '@heroui/react'
import {
  LayoutDashboard, TrendingUp, CreditCard, Wallet,
  Package, Factory, ShoppingCart, Users, Box, ChevronLeft,
} from 'lucide-react'
import { useUiStore } from '../../stores/uiStore'

const NAV_GROUPS = [
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
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUiStore()

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col bg-content1 border-r border-divider transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-divider">
        {sidebarOpen && (
          <span className="text-lg font-bold text-primary tracking-tight">TEG Analytics</span>
        )}
        <Button isIconOnly size="sm" variant="light" onPress={toggleSidebar}>
          <ChevronLeft className={`h-5 w-5 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {sidebarOpen && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-default-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-default-600 hover:bg-default-100'
                      } ${!sidebarOpen ? 'justify-center px-0' : ''}`
                    }
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
