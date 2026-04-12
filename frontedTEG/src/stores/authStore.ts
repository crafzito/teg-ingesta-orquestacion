import { create } from 'zustand'

import {
  clearPersistedAuth,
  fetchCurrentUser,
  getStoredToken,
  getStoredUser,
  loginRequest,
  logoutRequest,
  persistAuth,
} from '../api/auth'
import type { AuthState } from '../types/auth'

const persistedToken = getStoredToken()
const persistedUser = getStoredUser()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: persistedUser,
  token: persistedToken,
  isAuthenticated: !!persistedToken && !!persistedUser,
  initialized: false,
  isLoading: false,

  bootstrap: async () => {
    const token = get().token ?? getStoredToken()
    if (!token) {
      clearPersistedAuth()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      })
      return
    }

    set({ isLoading: true })
    try {
      const user = await fetchCurrentUser(token)
      persistAuth(token, user)
      set({
        user,
        token,
        isAuthenticated: true,
        initialized: true,
        isLoading: false,
      })
    } catch {
      clearPersistedAuth()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      })
    }
  },

  login: async (credentials) => {
    set({ isLoading: true })
    try {
      const { token, user } = await loginRequest(credentials)
      persistAuth(token, user)
      set({
        user,
        token,
        isAuthenticated: true,
        initialized: true,
        isLoading: false,
      })
    } catch (error) {
      clearPersistedAuth()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      })
      throw error
    }
  },

  logout: async () => {
    const token = get().token ?? getStoredToken()
    try {
      await logoutRequest(token)
    } catch {
      // el backend puede estar caído; igual limpiamos la sesión local
    } finally {
      clearPersistedAuth()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      })
    }
  },

  hasRole: (roles) => {
    if (!roles || roles.length === 0) return true
    const role = get().user?.role
    return !!role && roles.includes(role)
  },
}))
