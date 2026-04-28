import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, CardBody, CardHeader, Input } from '@heroui/react'
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { resetPassword } from '../api/auth'
import { PasswordRulesList } from '../components/ui/PasswordRulesList'
import { validatePassword } from '../utils/passwordValidation'

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [ci, setCi] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  const pwCheck = useMemo(() => validatePassword(newPassword), [newPassword])
  const matches = newPassword.length > 0 && newPassword === confirmPassword

  const canSubmit =
    username.trim().length > 0 &&
    ci.trim().length > 0 &&
    pwCheck.valid &&
    matches &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    try {
      await resetPassword({
        username: username.trim(),
        ci: ci.trim(),
        new_password: newPassword,
      })
      toast.success('Contrasena actualizada', {
        description: 'Inicia sesion con tus nuevas credenciales',
      })
      navigate('/login', {
        replace: true,
        state: { justReset: true, username: username.trim() },
      })
    } catch (err) {
      const msg = (err as Error).message || 'No se pudo restablecer la contrasena'
      setError(msg)
      toast.error('No se pudo restablecer', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      <Card shadow="lg" className="p-2 w-full">
        <CardHeader className="flex-col items-center pt-6 pb-0">
          <img src="/img/logo_380.png" alt="Proyectos PET" className="mb-3 h-20 w-auto" />
          <h1 className="text-2xl font-bold" style={{ color: '#091B6B' }}>
            Restablecer contraseña
          </h1>
          <p className="mt-2 text-center text-sm text-default-500">
            Verificamos tu identidad con tu usuario y cédula de identidad.
          </p>
        </CardHeader>
        <CardBody className="px-8 pb-8 pt-6">
          {error && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              placeholder="usuario"
              value={username}
              onValueChange={setUsername}
              variant="bordered"
              autoComplete="username"
              isRequired
            />
            <Input
              label="Cédula de identidad"
              placeholder="Solo números"
              value={ci}
              onValueChange={(v) => setCi(v.replace(/\D/g, ''))}
              variant="bordered"
              inputMode="numeric"
              isRequired
            />
            <Input
              label="Nueva contraseña"
              placeholder="••••••••"
              value={newPassword}
              onValueChange={setNewPassword}
              variant="bordered"
              autoComplete="new-password"
              isRequired
              type={showPw ? 'text' : 'password'}
              endContent={
                <button
                  type="button"
                  className="text-default-400"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <PasswordRulesList pw={newPassword} />
            <Input
              label="Confirmar contraseña"
              placeholder="••••••••"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              variant="bordered"
              autoComplete="new-password"
              isRequired
              type={showPwConfirm ? 'text' : 'password'}
              isInvalid={confirmPassword.length > 0 && !matches}
              errorMessage={
                confirmPassword.length > 0 && !matches
                  ? 'Las contraseñas no coinciden'
                  : undefined
              }
              endContent={
                <button
                  type="button"
                  className="text-default-400"
                  onClick={() => setShowPwConfirm((v) => !v)}
                  aria-label={showPwConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Button
              type="submit"
              isLoading={submitting}
              isDisabled={!canSubmit}
              fullWidth
              size="lg"
              startContent={!submitting ? <KeyRound className="h-4 w-4" /> : undefined}
              className="text-white font-semibold"
              style={{ backgroundColor: '#FF4E00' }}
            >
              Restablecer contraseña
            </Button>
          </form>
        </CardBody>
      </Card>
      <Link
        to="/login"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-default-500 hover:text-default-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al login
      </Link>
    </div>
  )
}
