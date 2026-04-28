export const CHART_COLORS = ['#091B6B', '#FF4E00', '#00972E', '#FFC107', '#7C3AED', '#EC4899'] as const

export const ACCENT_TOKENS = {
  primary: '#091B6B',
  accent: '#FF4E00',
  success: '#00972E',
  warning: '#FFC107',
  violet: '#7C3AED',
  pink: '#EC4899',
} as const

export type AccentKey = keyof typeof ACCENT_TOKENS

export const ACCENT_BG: Record<AccentKey, string> = {
  primary: 'bg-[#091B6B]/10 text-[#091B6B]',
  accent: 'bg-[#FF4E00]/10 text-[#FF4E00]',
  success: 'bg-[#00972E]/10 text-[#00972E]',
  warning: 'bg-[#FFC107]/15 text-[#B45309]',
  violet: 'bg-[#7C3AED]/10 text-[#7C3AED]',
  pink: 'bg-[#EC4899]/10 text-[#EC4899]',
}
