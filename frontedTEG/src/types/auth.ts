export interface User {
  username: string
  displayName: string
  role: 'admin' | 'viewer'
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
}
