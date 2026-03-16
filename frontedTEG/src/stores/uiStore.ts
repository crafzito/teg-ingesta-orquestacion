import { create } from 'zustand'
import type { Sociedad } from '../types/domain'

interface UiState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  selectedSociedad: Sociedad
  setSociedad: (soc: Sociedad) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  selectedSociedad: '',
  setSociedad: (soc) => set({ selectedSociedad: soc }),
}))
