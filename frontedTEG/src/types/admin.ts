import type { UserRole } from './auth'

export interface AdminUser {
  id: number
  username: string
  full_name: string | null
  role: UserRole
  active: boolean
  last_login: string | null
  ci: string | null
}

export interface AdminProtectedAction {
  key: string
  label: string
  endpoint: string
  required_role: string
  description: string
}

export interface AdminRoleCapability {
  role: UserRole
  summary: string
  capabilities: string[]
}

export interface AdminOverview {
  generated_at: string
  total_users: number
  active_users: number
  superadmin_count: number
  admin_count: number
  analyst_count: number
  custom_public_views: number
  protected_public_views: number
  monitored_directories: string[]
  system_flags: Record<string, string>
  users: AdminUser[]
  protected_actions: AdminProtectedAction[]
  role_matrix: AdminRoleCapability[]
}
