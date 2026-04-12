export type UserRole = 'superadmin' | 'admin' | 'analista'

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  analista: 'Analista',
}

export interface User {
  id: number
  username: string
  fullName: string
  role: UserRole
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: {
    id: number
    username: string
    full_name: string | null
    role: UserRole
  }
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  initialized: boolean
  isLoading: boolean
  bootstrap: () => Promise<void>
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  hasRole: (roles?: UserRole[]) => boolean
}
