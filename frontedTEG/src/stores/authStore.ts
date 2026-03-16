import { create } from 'zustand'
import type { AuthState, LoginCredentials, User } from '../types/auth'

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin123',
    user: { username: 'admin', displayName: 'Administrador', role: 'admin' },
  },
}

const TOKEN_KEY = 'teg_auth_token'
const USER_KEY = 'teg_auth_user'

function loadPersistedAuth(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    const user = raw ? (JSON.parse(raw) as User) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

const persisted = loadPersistedAuth()

export const useAuthStore = create<AuthState>((set) => ({
  user: persisted.user,
  token: persisted.token,
  isAuthenticated: !!persisted.token,

  login: async (credentials: LoginCredentials) => {
    // Mock auth - replace with POST /api/auth/login when available
    const entry = MOCK_USERS[credentials.username]
    if (entry && entry.password === credentials.password) {
      const token = `mock-token-${Date.now()}`
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(entry.user))
      set({ user: entry.user, token, isAuthenticated: true })
      return true
    }
    return false
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
