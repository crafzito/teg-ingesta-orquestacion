import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { BookOpen, Eye, EyeOff, LogIn } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../stores/authStore'

const DEMO_CREDENTIALS = [
  'superadmin / SuperAdmin#2026',
  'admin / Admin#2026',
  'analista / Analista#2026',
]

interface LoginLocationState {
  from?: string
  justReset?: boolean
  username?: string
}

export default function LoginPage() {
  const location = useLocation()
  const locState = (location.state as LoginLocationState | null) ?? null
  const justReset = Boolean(locState?.justReset)
  const presetUsername = locState?.username

  const [username, setUsername] = useState(presetUsername ?? 'admin')
  const [password, setPassword] = useState(presetUsername ? '' : 'Admin#2026')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.isLoading)
  const navigate = useNavigate()
  const nextPath = locState?.from || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login({ username, password })
      const loggedUser = useAuthStore.getState().user
      const greetName = loggedUser?.fullName || loggedUser?.username || username
      toast.success(`Bienvenido, ${greetName}`, { duration: 2000 })
      navigate(nextPath, { replace: true })
    } catch (err) {
      const typedErr = err as Error & { status?: number }
      const backendDetail = typedErr?.message
      let description: string
      if (typedErr?.status === 401) {
        description = 'Usuario o contraseña incorrectos'
      } else if (err instanceof TypeError) {
        description = 'No se pudo conectar con el servidor'
      } else if (backendDetail && !backendDetail.startsWith('HTTP ')) {
        description = backendDetail
      } else {
        description = 'Intentá nuevamente en unos segundos'
      }
      toast.error('No se pudo iniciar sesión', { description })
      setError(backendDetail ?? 'Credenciales incorrectas')
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <Card shadow="lg" className="p-2 w-full">
        <CardHeader className="flex-col items-center pt-6 pb-0">
          <img src="/img/logo_380.png" alt="Proyectos PET" className="mb-3 h-20 w-auto" />
          <h1 className="text-2xl font-bold" style={{ color: '#091B6B' }}>Proyectos PET</h1>
          <p className="mt-2 text-sm text-default-500">Ingrese sus credenciales</p>
        </CardHeader>
        <CardBody className="px-8 pb-8 pt-6">
          {justReset && !error && (
            <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
              Contraseña actualizada, inicia sesión.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Usuario"
              placeholder="admin"
              value={username}
              onValueChange={setUsername}
              variant="bordered"
              autoComplete="username"
              isRequired
            />
            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              autoComplete="current-password"
              isRequired
              type={showPw ? 'text' : 'password'}
              endContent={
                <button type="button" className="text-default-400" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Button
              type="submit"
              isLoading={loading}
              fullWidth
              size="lg"
              startContent={!loading ? <LogIn className="h-4 w-4" /> : undefined}
              className="text-white font-semibold"
              style={{ backgroundColor: '#FF4E00' }}
            >
              Iniciar sesión
            </Button>
            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-xs text-default-500 hover:text-[#091B6B] transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
          <div className="mt-6 rounded-xl bg-default-50 p-3 text-xs text-default-500">
            <p className="mb-2 font-semibold text-default-700">Credenciales demo:</p>
            <ul className="space-y-1">
              {DEMO_CREDENTIALS.map((credential) => (
                <li key={credential}>{credential}</li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
      <Link
        to="/manual"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-default-500 hover:text-default-700 transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
        ¿Necesitas ayuda? Consulta el manual de usuario
      </Link>
    </div>
  )
}
