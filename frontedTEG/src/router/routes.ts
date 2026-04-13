import { lazy } from 'react'

import type { UserRole } from '../types/auth'

const DashboardPage = lazy(() => import('../pages/DashboardPage'))
const VentasPage = lazy(() => import('../pages/VentasPage'))
const CxcPage = lazy(() => import('../pages/CxcPage'))
const CxpPage = lazy(() => import('../pages/CxpPage'))
const InventarioPage = lazy(() => import('../pages/InventarioPage'))
const ProduccionPage = lazy(() => import('../pages/ProduccionPage'))
const PedidosPage = lazy(() => import('../pages/PedidosPage'))
const ClientesPage = lazy(() => import('../pages/ClientesPage'))
const ProductosPage = lazy(() => import('../pages/ProductosPage'))
const EtlMonitorPage = lazy(() => import('../pages/EtlMonitorPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))

export interface AppRouteItem {
  path: string
  element: ReturnType<typeof lazy>
  allowedRoles?: UserRole[]
}

const ALL_ROLES: UserRole[] = ['superadmin', 'admin', 'analista']
const ADMIN_ROLES: UserRole[] = ['superadmin', 'admin']
const SUPERADMIN_ROLES: UserRole[] = ['superadmin']

export const appRoutes: AppRouteItem[] = [
  { path: '/', element: DashboardPage, allowedRoles: ALL_ROLES },
  { path: '/ventas', element: VentasPage, allowedRoles: ALL_ROLES },
  { path: '/cxc', element: CxcPage, allowedRoles: ALL_ROLES },
  { path: '/cxp', element: CxpPage, allowedRoles: ALL_ROLES },
  { path: '/inventario', element: InventarioPage, allowedRoles: ALL_ROLES },
  { path: '/produccion', element: ProduccionPage, allowedRoles: ALL_ROLES },
  { path: '/pedidos', element: PedidosPage, allowedRoles: ALL_ROLES },
  { path: '/clientes', element: ClientesPage, allowedRoles: ALL_ROLES },
  { path: '/productos', element: ProductosPage, allowedRoles: ALL_ROLES },
  { path: '/etl', element: EtlMonitorPage, allowedRoles: ADMIN_ROLES },
  { path: '/administracion', element: AdminPage, allowedRoles: SUPERADMIN_ROLES },
]
