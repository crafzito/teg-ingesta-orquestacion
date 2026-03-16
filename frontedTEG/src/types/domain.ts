export interface KpiData {
  label: string
  value: number
  prefix?: string
  suffix?: string
  trend?: number
  icon: string
}

export interface VentaMensual {
  mes: string
  sociedad_1000: number
  sociedad_1200: number
  sociedad_1300: number
}

export interface AgingBucket {
  name: string
  value: number
}

export interface TopCliente {
  name: string
  value: number
}

export interface VentaSociedad {
  sociedad: string
  mes_actual: number
  mes_anterior: number
}

export interface PedidoStatus {
  name: string
  value: number
}

export interface OrdenCentro {
  centro: string
  abiertas: number
  liberadas: number
  cerradas: number
}

export interface VentaRow {
  sociedad: string
  sociedad_nombre: string
  cod_cliente: string
  nombre_cliente: string
  codigo_mat: string
  producto: string
  fecha_doc: string
  cantidad_umv: number
  monto_usd: number
  cod_moneda: string
}

export interface CxcRow {
  sociedad: string
  cod_cliente: string
  nombre_cliente: string
  n_documento: string
  fecha_doc: string
  fecha_venc: string
  valor_monetario: number
  cod_moneda: string
  d_venc: number
  total_vencido: number
}

export interface CxpRow {
  sociedad: string
  proveedor: string
  nombre_proveedor: string
  n_documento: string
  fecha_doc: string
  fecha_venc: string
  cod_moneda: string
  d_venc: number
  importe: number
}

export interface InventarioRow {
  centro: string
  almacen: string
  codigo_mat: string
  producto: string
  tipo_inv: string
  libre_ut: number
  valor_libre: number
  unidad: string
}

export interface OrdenRow {
  centro: string
  num_orden: string
  codigo_mat: string
  producto: string
  cantidad_orden: number
  cantidad_recibida: number
  estatus: string
  fecha_ini_extrema: string
  fecha_fin_extrema: string
}

export interface PedidoRow {
  num_pedido: string
  cod_cliente: string
  nombre_cliente: string
  codigo_mat: string
  producto: string
  ctd_ped: number
  valor_neto: number
  cod_moneda: string
  status: string
  fecha_doc: string
}

export interface ClienteRow {
  cod_cliente: string
  nombre_cliente: string
  sociedad: string
  total_ventas: number
  num_facturas: number
  ultima_compra: string
}

export interface ProductoRow {
  codigo_mat: string
  producto: string
  tipo: string
  unidad: string
  libre_ut_total: number
  valor_libre_total: number
  ventas_mes: number
}

export type Sociedad = '' | '1000' | '1200' | '1300'
