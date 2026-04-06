import { create } from 'zustand'
import type { Sociedad } from '../types/domain'

interface UiState {
  sidebarOpen: boolean
  isMobile: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setIsMobile: (mobile: boolean) => void
  closeSidebarOnMobile: () => void
  selectedSociedad: Sociedad
  setSociedad: (soc: Sociedad) => void
}

export const useUiStore = create<UiState>((set, get) => ({
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
}))
