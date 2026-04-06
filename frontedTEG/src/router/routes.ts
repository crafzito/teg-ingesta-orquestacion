import { lazy } from 'react'

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

export const appRoutes = [
  { path: '/', element: DashboardPage },
  { path: '/ventas', element: VentasPage },
  { path: '/cxc', element: CxcPage },
  { path: '/cxp', element: CxpPage },
  { path: '/inventario', element: InventarioPage },
  { path: '/produccion', element: ProduccionPage },
  { path: '/pedidos', element: PedidosPage },
  { path: '/clientes', element: ClientesPage },
  { path: '/productos', element: ProductosPage },
  { path: '/etl', element: EtlMonitorPage },
] as const
