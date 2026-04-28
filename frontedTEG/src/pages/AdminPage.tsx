import { useState, useCallback, useMemo } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  useDisclosure,
} from '@heroui/react'
import {
  DatabaseZap,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { API_BASE } from '../config/env'
import { useAdminOverview } from '../api/hooks/useAdminOverview'
import { PageHeader } from '../components/ui/PageHeader'
import { KpiCard } from '../components/ui/KpiCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { PasswordRulesList } from '../components/ui/PasswordRulesList'
import { ROLE_LABELS, type UserRole } from '../types/auth'
import type { AdminUser } from '../types/admin'
import { useUiStore } from '../stores/uiStore'
import { validatePassword } from '../utils/passwordValidation'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('teg_auth_token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

const ROLE_TONE: Record<UserRole, 'secondary' | 'primary' | 'default'> = {
  superadmin: 'secondary',
  admin: 'primary',
  analista: 'default',
}

const ROLES: UserRole[] = ['superadmin', 'admin', 'analista']

function formatDateTime(value: string | null): string {
  if (!value) return 'Sin acceso registrado'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

interface UserFormState {
  username: string
  password: string
  full_name: string
  role: UserRole
  ci: string
}

const EMPTY_FORM: UserFormState = { username: '', password: '', full_name: '', role: 'analista', ci: '' }

// Sistema section intentionally hidden from the sidebar toggles UI.
const CONFIGURABLE_SECTIONS = ['Principal', 'Finanzas', 'Operaciones', 'Maestros']

export default function AdminPage() {
  const queryClient = useQueryClient()
  const overview = useAdminOverview()

  const createUser = useMutation({
    mutationFn: async (body: UserFormState) => {
      const payload = {
        username: body.username,
        password: body.password,
        full_name: body.full_name,
        role: body.role,
        ci: body.ci.trim() === '' ? null : body.ci.trim(),
      }
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      return readJson<AdminUser>(res)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; full_name?: string; role?: UserRole; password?: string; ci?: string | null }) => {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      return readJson<AdminUser>(res)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const toggleUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/admin/users/${id}/toggle`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
      return readJson<AdminUser>(res)
    },
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
      toast.success(user.active ? 'Usuario activado' : 'Usuario desactivado', {
        description: user.username,
      })
    },
    onError: (err) => {
      toast.error('No se pudo cambiar el estado del usuario', {
        description: (err as Error).message,
      })
    },
  })

  const resetPassword = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ password }),
      })
      return readJson<AdminUser>(res)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const toggleModal = useDisclosure()
  const resetPwModal = useDisclosure()

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [mutationError, setMutationError] = useState('')

  const sidebarSectionsByRole = useUiStore((s) => s.sidebarSectionsByRole)
  const toggleSection = useUiStore((s) => s.toggleSection)

  const createPwCheck = useMemo(() => validatePassword(form.password), [form.password])
  const editPwCheck = useMemo(() => validatePassword(form.password), [form.password])
  const resetPwCheck = useMemo(() => validatePassword(resetPw), [resetPw])
  const resetMatches = resetPw.length > 0 && resetPw === resetPwConfirm

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM)
    setMutationError('')
    createModal.onOpen()
  }, [createModal])

  const openEdit = useCallback((user: AdminUser) => {
    setEditId(user.id)
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name ?? '',
      role: user.role,
      ci: user.ci ?? '',
    })
    setMutationError('')
    editModal.onOpen()
  }, [editModal])

  const openToggle = useCallback((user: AdminUser) => {
    setToggleTarget(user)
    setMutationError('')
    toggleModal.onOpen()
  }, [toggleModal])

  const openResetPw = useCallback((user: AdminUser) => {
    setResetTarget(user)
    setResetPw('')
    setResetPwConfirm('')
    setMutationError('')
    resetPwModal.onOpen()
  }, [resetPwModal])

  const handleCreate = useCallback(async () => {
    setMutationError('')
    try {
      const created = await createUser.mutateAsync(form)
      toast.success('Usuario creado', {
        description: `${created.username} fue agregado como ${ROLE_LABELS[created.role]}`,
      })
      createModal.onClose()
    } catch (err) {
      const msg = (err as Error).message
      setMutationError(msg)
      toast.error('No se pudo crear el usuario', { description: msg })
    }
  }, [form, createUser, createModal])

  const handleUpdate = useCallback(async () => {
    if (editId == null) return
    setMutationError('')
    const payload: { id: number; full_name?: string; role?: UserRole; password?: string; ci?: string | null } = {
      id: editId,
      full_name: form.full_name,
      role: form.role,
      ci: form.ci.trim() === '' ? null : form.ci.trim(),
    }
    if (form.password) payload.password = form.password
    try {
      await updateUser.mutateAsync(payload)
      toast.success('Usuario actualizado', { description: form.username })
      editModal.onClose()
    } catch (err) {
      const msg = (err as Error).message
      setMutationError(msg)
      toast.error('No se pudo actualizar', { description: msg })
    }
  }, [editId, form, updateUser, editModal])

  const handleToggle = useCallback(async () => {
    if (!toggleTarget) return
    setMutationError('')
    try {
      await toggleUser.mutateAsync(toggleTarget.id)
      toggleModal.onClose()
    } catch (err) {
      setMutationError((err as Error).message)
    }
  }, [toggleTarget, toggleUser, toggleModal])

  const handleResetPassword = useCallback(async () => {
    if (!resetTarget) return
    setMutationError('')
    try {
      await resetPassword.mutateAsync({ id: resetTarget.id, password: resetPw })
      toast.success('Contrasena restablecida', { description: resetTarget.username })
      resetPwModal.onClose()
    } catch (err) {
      const msg = (err as Error).message
      setMutationError(msg)
      toast.error('No se pudo restablecer la contrasena', { description: msg })
    }
  }, [resetTarget, resetPw, resetPassword, resetPwModal])

  if (overview.isLoading) return <LoadingSpinner />

  if (overview.isError || !overview.data) {
    return (
      <div>
        <PageHeader title="Administracion" description="Gestion de usuarios, base de datos y configuracion del sistema." />
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
          No se pudo cargar el panel de administracion: {(overview.error as Error)?.message ?? 'Error desconocido'}
        </div>
      </div>
    )
  }

  const data = overview.data

  return (
    <div>
      <PageHeader
        title="Administracion"
        description="Gestion de usuarios, base de datos y configuracion del sistema"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Usuarios activos" value={`${data.active_users}/${data.total_users}`} icon={<Users className="h-6 w-6" />} />
        <KpiCard title="Vistas protegidas" value={String(data.protected_public_views)} icon={<ShieldCheck className="h-6 w-6" />} />
        <KpiCard title="Vistas personalizadas" value={String(data.custom_public_views)} icon={<DatabaseZap className="h-6 w-6" />} />
        <KpiCard title="Directorios monitoreados" value={String(data.monitored_directories.length)} icon={<Settings2 className="h-6 w-6" />} />
      </div>

      <Tabs aria-label="Secciones de administracion" color="primary" variant="underlined" classNames={{ tabList: 'gap-6' }}>
        <Tab
          key="usuarios"
          title={
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Usuarios</span>
            </div>
          }
        >
          <div className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Usuarios del sistema</h2>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus className="h-4 w-4" />}
                onPress={openCreate}
              >
                Nuevo Usuario
              </Button>
            </div>

            <Card shadow="sm">
              <CardBody className="p-0">
                <Table aria-label="Usuarios del sistema" removeWrapper>
                  <TableHeader>
                    <TableColumn>USUARIO</TableColumn>
                    <TableColumn>NOMBRE</TableColumn>
                    <TableColumn>CEDULA</TableColumn>
                    <TableColumn>ROL</TableColumn>
                    <TableColumn>ESTADO</TableColumn>
                    <TableColumn>ULTIMO ACCESO</TableColumn>
                    <TableColumn align="center">ACCIONES</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No hay usuarios cargados">
                    {data.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium text-foreground">{user.username}</TableCell>
                        <TableCell>{user.full_name ?? user.username}</TableCell>
                        <TableCell className="text-sm text-default-600">{user.ci ?? '—'}</TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color={ROLE_TONE[user.role]}>
                            {ROLE_LABELS[user.role]}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="sm"
                            variant="flat"
                            color={user.active ? 'success' : 'default'}
                          >
                            {user.active ? 'Activo' : 'Inactivo'}
                          </Chip>
                        </TableCell>
                        <TableCell className="text-sm text-default-500">{formatDateTime(user.last_login)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => openEdit(user)}
                              aria-label="Editar usuario"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => openResetPw(user)}
                              aria-label="Restablecer contrasena"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color={user.active ? 'danger' : 'success'}
                              onPress={() => openToggle(user)}
                              aria-label={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab
          key="config"
          title={
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span>Configuracion</span>
            </div>
          }
        >
          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card shadow="sm" className="xl:col-span-2">
              <CardBody className="gap-4 p-5">
                <h2 className="text-lg font-semibold text-foreground">Secciones del Sidebar</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {ROLES.map((role) => (
                    <div key={role} className="space-y-2">
                      <h3 className="text-sm font-semibold text-default-600">{ROLE_LABELS[role]}</h3>
                      {CONFIGURABLE_SECTIONS.map((label) => (
                        <div key={label} className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50/70 px-4 py-2.5">
                          <span className="text-sm text-foreground">{label}</span>
                          <Switch
                            size="sm"
                            isSelected={sidebarSectionsByRole[role]?.[label] ?? true}
                            onValueChange={() => toggleSection(role, label)}
                            aria-label={`Toggle ${label} para ${ROLE_LABELS[role]}`}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

          
          </div>
        </Tab>
      </Tabs>

      <Modal
        isOpen={createModal.isOpen}
        onOpenChange={createModal.onOpenChange}
        size="md"
        classNames={{ base: 'mx-2 sm:mx-auto' }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base sm:text-lg">Nuevo Usuario</ModalHeader>
              <ModalBody>
                {mutationError && (
                  <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                    {mutationError}
                  </div>
                )}
                <Input
                  label="Nombre de usuario"
                  placeholder="usuario123"
                  value={form.username}
                  onValueChange={(v) => setForm((p) => ({ ...p, username: v }))}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label="Contrasena"
                  placeholder="••••••••"
                  type="password"
                  value={form.password}
                  onValueChange={(v) => setForm((p) => ({ ...p, password: v }))}
                  variant="bordered"
                  isRequired
                />
                <PasswordRulesList pw={form.password} />
                <Input
                  label="Nombre completo"
                  placeholder="Juan Perez"
                  value={form.full_name}
                  onValueChange={(v) => setForm((p) => ({ ...p, full_name: v }))}
                  variant="bordered"
                />
                <Input
                  label="Cedula de identidad"
                  placeholder="Solo numeros"
                  value={form.ci}
                  onValueChange={(v) => setForm((p) => ({ ...p, ci: v.replace(/\D/g, '') }))}
                  variant="bordered"
                  inputMode="numeric"
                />
                <Select
                  label="Rol"
                  selectedKeys={[form.role]}
                  onSelectionChange={(keys) => {
                    const next = Array.from(keys)[0] as UserRole
                    if (next) setForm((p) => ({ ...p, role: next }))
                  }}
                  variant="bordered"
                >
                  {ROLES.map((r) => (
                    <SelectItem key={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </Select>
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="w-full sm:w-auto"
                  isLoading={createUser.isPending}
                  isDisabled={!createPwCheck.valid || !form.username.trim()}
                  onPress={handleCreate}
                >
                  Crear
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={editModal.isOpen}
        onOpenChange={editModal.onOpenChange}
        size="md"
        classNames={{ base: 'mx-2 sm:mx-auto' }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base sm:text-lg">Editar Usuario</ModalHeader>
              <ModalBody>
                {mutationError && (
                  <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                    {mutationError}
                  </div>
                )}
                <Input
                  label="Nombre de usuario"
                  value={form.username}
                  variant="bordered"
                  isReadOnly
                  isDisabled
                />
                <Input
                  label="Nombre completo"
                  placeholder="Juan Perez"
                  value={form.full_name}
                  onValueChange={(v) => setForm((p) => ({ ...p, full_name: v }))}
                  variant="bordered"
                />
                <Input
                  label="Cedula de identidad"
                  placeholder="Solo numeros"
                  value={form.ci}
                  onValueChange={(v) => setForm((p) => ({ ...p, ci: v.replace(/\D/g, '') }))}
                  variant="bordered"
                  inputMode="numeric"
                />
                <Select
                  label="Rol"
                  selectedKeys={[form.role]}
                  onSelectionChange={(keys) => {
                    const next = Array.from(keys)[0] as UserRole
                    if (next) setForm((p) => ({ ...p, role: next }))
                  }}
                  variant="bordered"
                >
                  {ROLES.map((r) => (
                    <SelectItem key={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Nueva contrasena (opcional)"
                  placeholder="Dejar vacio para no cambiar"
                  type="password"
                  value={form.password}
                  onValueChange={(v) => setForm((p) => ({ ...p, password: v }))}
                  variant="bordered"
                />
                {form.password.length > 0 && <PasswordRulesList pw={form.password} />}
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="w-full sm:w-auto"
                  isLoading={updateUser.isPending}
                  isDisabled={form.password.length > 0 && !editPwCheck.valid}
                  onPress={handleUpdate}
                >
                  Guardar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={toggleModal.isOpen}
        onOpenChange={toggleModal.onOpenChange}
        size="sm"
        classNames={{ base: 'mx-2 sm:mx-auto' }}
      >
        <ModalContent>
          {(onClose) => {
            const isActive = toggleTarget?.active ?? false
            return (
              <>
                <ModalHeader className="text-base sm:text-lg">
                  {isActive ? 'Desactivar usuario' : 'Activar usuario'}
                </ModalHeader>
                <ModalBody>
                  {mutationError && (
                    <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                      {mutationError}
                    </div>
                  )}
                  <p className="text-sm text-default-600">
                    {isActive ? (
                      <>Se desactivara al usuario <strong>{toggleTarget?.username}</strong>. No podra iniciar sesion hasta que sea reactivado.</>
                    ) : (
                      <>Se activara al usuario <strong>{toggleTarget?.username}</strong>. Podra iniciar sesion nuevamente.</>
                    )}
                  </p>
                </ModalBody>
                <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                    Cancelar
                  </Button>
                  <Button
                    color={isActive ? 'danger' : 'success'}
                    className="w-full sm:w-auto"
                    isLoading={toggleUser.isPending}
                    onPress={handleToggle}
                  >
                    {isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </ModalFooter>
              </>
            )
          }}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={resetPwModal.isOpen}
        onOpenChange={resetPwModal.onOpenChange}
        size="md"
        classNames={{ base: 'mx-2 sm:mx-auto' }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base sm:text-lg">Restablecer contrasena</ModalHeader>
              <ModalBody>
                {mutationError && (
                  <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                    {mutationError}
                  </div>
                )}
                <p className="text-sm text-default-600">
                  Se actualizara la contrasena del usuario <strong>{resetTarget?.username}</strong>.
                </p>
                <Input
                  label="Nueva contrasena"
                  placeholder="••••••••"
                  type="password"
                  value={resetPw}
                  onValueChange={setResetPw}
                  variant="bordered"
                  isRequired
                />
                <PasswordRulesList pw={resetPw} />
                <Input
                  label="Confirmar contrasena"
                  placeholder="••••••••"
                  type="password"
                  value={resetPwConfirm}
                  onValueChange={setResetPwConfirm}
                  variant="bordered"
                  isRequired
                  isInvalid={resetPwConfirm.length > 0 && !resetMatches}
                  errorMessage={
                    resetPwConfirm.length > 0 && !resetMatches
                      ? 'Las contrasenas no coinciden'
                      : undefined
                  }
                />
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="w-full sm:w-auto"
                  isLoading={resetPassword.isPending}
                  isDisabled={!resetPwCheck.valid || !resetMatches}
                  onPress={handleResetPassword}
                >
                  Restablecer
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

