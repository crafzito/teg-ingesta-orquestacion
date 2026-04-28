import { create } from 'zustand'
import type { Sociedad } from '../types/domain'
import { API_BASE } from '../config/env'

const DEFAULT_SECTION_VALUES: Record<string, boolean> = {
  Principal: true,
  Finanzas: true,
  Operaciones: true,
  Maestros: true,
  Sistema: true,
}

const DEFAULT_SIDEBAR_SECTIONS_BY_ROLE: Record<string, Record<string, boolean>> = {
  superadmin: { ...DEFAULT_SECTION_VALUES },
  admin: { ...DEFAULT_SECTION_VALUES },
  analista: { ...DEFAULT_SECTION_VALUES },
}

/** Fire-and-forget PUT to persist sidebar section toggle to the backend. */
function persistSectionToBackend(role: string, sections: Record<string, boolean>) {
  const token = localStorage.getItem('teg_auth_token')
  if (!token) return
  fetch(`${API_BASE}/admin/sidebar-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role, sections }),
  }).catch(() => {
    // Best-effort — sidebar still works from local state
  })
}

export type PeriodoKey = 'mes' | 'trimestre' | 'ano' | 'todo'

interface UiState {
  sidebarOpen: boolean
  isMobile: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setIsMobile: (mobile: boolean) => void
  closeSidebarOnMobile: () => void
  selectedSociedad: Sociedad
  setSociedad: (soc: Sociedad) => void
  selectedCentro: string
  setCentro: (centro: string) => void
  selectedPeriodo: PeriodoKey
  setPeriodo: (p: PeriodoKey) => void
  sidebarSectionsByRole: Record<string, Record<string, boolean>>
  setSidebarSectionsByRole: (data: Record<string, Record<string, boolean>>) => void
  toggleSection: (role: string, label: string) => void
  setSectionEnabled: (role: string, label: string, enabled: boolean) => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  sidebarOpen: true,
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  closeSidebarOnMobile: () => {
    const { isMobile } = get()
    if (isMobile) {
      set({ sidebarOpen: false })
    }
  },
  selectedSociedad: '',
  setSociedad: (soc) => set({ selectedSociedad: soc }),
  selectedCentro: '',
  setCentro: (centro) => set({ selectedCentro: centro }),
  selectedPeriodo: 'ano',
  setPeriodo: (p) => set({ selectedPeriodo: p }),
  sidebarSectionsByRole: { ...DEFAULT_SIDEBAR_SECTIONS_BY_ROLE },
  setSidebarSectionsByRole: (data) => set({ sidebarSectionsByRole: data }),
  toggleSection: (role, label) => {
    const s = get()
    const roleSections = s.sidebarSectionsByRole[role] ?? { ...DEFAULT_SECTION_VALUES }
    const updatedSections = { ...roleSections, [label]: !roleSections[label] }
    set({
      sidebarSectionsByRole: {
        ...s.sidebarSectionsByRole,
        [role]: updatedSections,
      },
    })
    persistSectionToBackend(role, updatedSections)
  },
  setSectionEnabled: (role, label, enabled) => {
    const s = get()
    const roleSections = s.sidebarSectionsByRole[role] ?? { ...DEFAULT_SECTION_VALUES }
    const updatedSections = { ...roleSections, [label]: enabled }
    set({
      sidebarSectionsByRole: {
        ...s.sidebarSectionsByRole,
        [role]: updatedSections,
      },
    })
    persistSectionToBackend(role, updatedSections)
  },
}))
