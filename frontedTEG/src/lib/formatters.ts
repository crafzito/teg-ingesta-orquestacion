import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(dateStr: string, fmt = 'dd/MM/yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt, { locale: es })
  } catch {
    return dateStr
  }
}

export function formatMonth(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM yyyy', { locale: es })
  } catch {
    return dateStr
  }
}

export function sociedadLabel(soc: string): string {
  const labels: Record<string, string> = {
    '1000': 'Pharsana (Consumo)',
    '1200': 'Ampofrasca (Empaque)',
    '1300': 'Proy. PET (Empaque)',
  }
  return labels[soc] ?? soc
}
