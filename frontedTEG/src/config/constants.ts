export const SOCIEDADES = [
  { value: '', label: 'Todas las Sociedades' },
  { value: '1000', label: 'Pharsana (Consumo)' },
  { value: '1200', label: 'Ampofrasca (Empaque)' },
  { value: '1300', label: 'Proy. PET (Empaque)' },
] as const

export const CENTROS: Record<string, string[]> = {
  '1000': ['1000', '1001', '1002'],
  '1200': ['1200'],
  '1300': ['1300'],
}

export const AGING_LABELS = [
  'No vencido',
  '1-15 dias',
  '16-30 dias',
  '31-60 dias',
  '61-90 dias',
  '91+ dias',
] as const
