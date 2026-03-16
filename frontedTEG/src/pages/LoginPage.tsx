import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react'
import { useAuthStore } from '../stores/authStore'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login({ username, password })
    setLoading(false)
    if (ok) {
      navigate('/', { replace: true })
    } else {
      setError('Credenciales incorrectas')
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card shadow="lg" className="p-2">
        <CardHeader className="flex-col items-center pt-6 pb-0">
          <h1 className="text-3xl font-bold text-primary">TEG Analytics</h1>
          <p className="mt-2 text-sm text-default-500">Ingrese sus credenciales</p>
        </CardHeader>
        <CardBody className="px-8 pb-8 pt-6">
          {error && (
            <div className="mb-4 rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger">
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
              isRequired
            />
            <Input
              label="Contrasena"
              placeholder="••••••••"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
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
              color="primary"
              isLoading={loading}
              fullWidth
              size="lg"
              startContent={!loading ? <LogIn className="h-4 w-4" /> : undefined}
            >
              Iniciar Sesion
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-default-400">
            Demo: admin / admin123
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
