import { API_BASE } from '../config/env'
import type { LoginCredentials, LoginResponse, User } from '../types/auth'

export const TOKEN_KEY = 'teg_auth_token'
export const USER_KEY = 'teg_auth_user'

function mapUser(raw: LoginResponse['user'] | User): User {
  return {
    id: Number(raw.id),
    username: raw.username,
    fullName: 'full_name' in raw ? (raw.full_name ?? raw.username) : raw.fullName,
    role: raw.role,
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return mapUser(JSON.parse(raw) as User)
  } catch {
    return null
  }
}

export function persistAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearPersistedAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const activeToken = token ?? getStoredToken()
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`
  }
  return headers
}

async function readJsonError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({ detail: res.statusText }))
  const error = new Error(err.detail || `HTTP ${res.status}`) as Error & { status?: number }
  error.status = res.status
  return error
}

export async function loginRequest(credentials: LoginCredentials): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(credentials),
  })

  if (!res.ok) {
    throw await readJsonError(res)
  }

  const payload = (await res.json()) as LoginResponse
  return {
    token: payload.access_token,
    user: mapUser(payload.user),
  }
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: buildHeaders(token),
  })

  if (!res.ok) {
    throw await readJsonError(res)
  }

  return mapUser((await res.json()) as LoginResponse['user'])
}

export async function logoutRequest(token: string | null): Promise<void> {
  if (!token) return

  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: buildHeaders(token),
  })

  if (!res.ok && res.status !== 401) {
    throw await readJsonError(res)
  }
}

export interface ResetPasswordPayload {
  username: string
  ci: string
  new_password: string
}

export interface ResetPasswordResponse {
  status: string
  message: string
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  // Endpoint publico: NO incluir Authorization header.
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw await readJsonError(res)
  }

  return (await res.json()) as ResetPasswordResponse
}
