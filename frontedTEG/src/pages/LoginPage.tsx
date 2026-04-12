import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { Eye, EyeOff, LogIn } from 'lucide-react'

import { useAuthStore } from '../stores/authStore'

const DEMO_CREDENTIALS = [
  'superadmin / Admin#2026',
  'admin / Admin#2026',
  'analista / Analista#2026',
]

export default function LoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Admin#2026')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.isLoading)
  const navigate = useNavigate()
  const location = useLocation()
  const nextPath = (location.state as { from?: string } | null)?.from || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login({ username, password })
      navigate(nextPath, { replace: true })
    } catch (err) {
      setError((err as Error)?.message ?? 'Credenciales incorrectas')
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card shadow="lg" className="p-2">
        <CardHeader className="flex-col items-center pt-6 pb-0">
          <img src="/img/logo_380.png" alt="Proyectos PET" className="mb-3 h-20 w-auto" />
          <h1 className="text-2xl font-bold" style={{ color: '#091B6B' }}>Proyectos PET</h1>
          <p className="mt-2 text-sm text-default-500">Ingrese sus credenciales</p>
        </CardHeader>
        <CardBody className="px-8 pb-8 pt-6">
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
    </div>
  )
}
