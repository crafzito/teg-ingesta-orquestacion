import { useState, useCallback } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
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
  Pencil,
  Plus,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { API_BASE } from '../config/env'
import { useAdminOverview, useRefreshSchemaCache } from '../api/hooks/useAdminOverview'
import { PageHeader } from '../components/ui/PageHeader'
import { KpiCard } from '../components/ui/KpiCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ROLE_LABELS, type UserRole } from '../types/auth'
import type { AdminUser } from '../types/admin'
import { useUiStore } from '../stores/uiStore'

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
}

const EMPTY_FORM: UserFormState = { username: '', password: '', full_name: '', role: 'analista' }

// Sistema section intentionally hidden from the sidebar toggles UI.
const CONFIGURABLE_SECTIONS = ['Principal', 'Finanzas', 'Operaciones', 'Maestros']

export default function AdminPage() {
  const queryClient = useQueryClient()
  const overview = useAdminOverview()
  const refreshSchema = useRefreshSchemaCache()

  const createUser = useMutation({
    mutationFn: async (body: UserFormState) => {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      return readJson<AdminUser>(res)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const updateUser = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; full_name?: string; role?: UserRole; password?: string }) => {
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      return readJson<{ detail: string }>(res)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const deleteModal = useDisclosure()

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [mutationError, setMutationError] = useState('')

  const sidebarSectionsByRole = useUiStore((s) => s.sidebarSectionsByRole)
  const toggleSection = useUiStore((s) => s.toggleSection)

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
    })
    setMutationError('')
    editModal.onOpen()
  }, [editModal])

  const openDelete = useCallback((user: AdminUser) => {
    setDeleteTarget(user)
    setMutationError('')
    deleteModal.onOpen()
  }, [deleteModal])

  const handleCreate = useCallback(async () => {
    setMutationError('')
    try {
      await createUser.mutateAsync(form)
      createModal.onClose()
    } catch (err) {
      setMutationError((err as Error).message)
    }
  }, [form, createUser, createModal])

  const handleUpdate = useCallback(async () => {
    if (editId == null) return
    setMutationError('')
    const payload: Record<string, unknown> = { id: editId, full_name: form.full_name, role: form.role }
    if (form.password) payload.password = form.password
    try {
      await updateUser.mutateAsync(payload as { id: number; full_name?: string; role?: UserRole; password?: string })
      editModal.onClose()
    } catch (err) {
      setMutationError((err as Error).message)
    }
  }, [editId, form, updateUser, editModal])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setMutationError('')
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      deleteModal.onClose()
    } catch (err) {
      setMutationError((err as Error).message)
    }
  }, [deleteTarget, deleteUser, deleteModal])

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
                        <TableCell>
                          <Chip size="sm" variant="flat" color={ROLE_TONE[user.role]}>
                            {ROLE_LABELS[user.role]}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Switch
                            size="sm"
                            isSelected={user.active}
                            isDisabled={toggleUser.isPending}
                            onValueChange={() => toggleUser.mutate(user.id)}
                            aria-label={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-default-500">{formatDateTime(user.last_login)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
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
                              color="danger"
                              onPress={() => openDelete(user)}
                              aria-label="Eliminar usuario"
                            >
                              <Trash2 className="h-4 w-4" />
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

            <Card shadow="sm">
              <CardBody className="gap-4 p-5">
                <h2 className="text-lg font-semibold text-foreground">Sistema</h2>
                <div className="space-y-3">
                  {Object.entries(data.system_flags).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50/70 px-4 py-3">
                      <span className="text-sm text-default-500">{key}</span>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                  ))}
                  <Divider />
                  <h3 className="text-sm font-semibold text-default-500">Rutas monitoreadas</h3>
                  {data.monitored_directories.map((directory) => (
                    <div key={directory} className="rounded-xl border border-default-200 bg-default-50/70 px-4 py-3 text-sm text-default-700">
                      {directory}
                    </div>
                  ))}
                  <Divider />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Cache de esquema</p>
                      <p className="text-xs text-default-400">Refresca las vistas y tablas cacheadas</p>
                    </div>
                    <Button
                      color="secondary"
                      variant="flat"
                      size="sm"
                      startContent={<RefreshCcw className={`h-4 w-4 ${refreshSchema.isPending ? 'animate-spin' : ''}`} />}
                      isLoading={refreshSchema.isPending}
                      onPress={() => refreshSchema.mutate()}
                    >
                      Refrescar
                    </Button>
                  </div>
                  {refreshSchema.isSuccess && (
                    <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                      Cache de esquema refrescada correctamente.
                    </div>
                  )}
                  {refreshSchema.isError && (
                    <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                      Error: {(refreshSchema.error as Error)?.message ?? 'Desconocido'}
                    </div>
                  )}
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
                <Input
                  label="Nombre completo"
                  placeholder="Juan Perez"
                  value={form.full_name}
                  onValueChange={(v) => setForm((p) => ({ ...p, full_name: v }))}
                  variant="bordered"
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
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="w-full sm:w-auto"
                  isLoading={updateUser.isPending}
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
        isOpen={deleteModal.isOpen}
        onOpenChange={deleteModal.onOpenChange}
        size="sm"
        classNames={{ base: 'mx-2 sm:mx-auto' }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-base sm:text-lg">Eliminar Usuario</ModalHeader>
              <ModalBody>
                {mutationError && (
                  <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
                    {mutationError}
                  </div>
                )}
                <p className="text-sm text-default-600">
                  Se eliminara permanentemente al usuario <strong>{deleteTarget?.username}</strong>. Esta accion no se puede deshacer.
                </p>
              </ModalBody>
              <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="flat" className="w-full sm:w-auto" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  color="danger"
                  className="w-full sm:w-auto"
                  isLoading={deleteUser.isPending}
                  onPress={handleDelete}
                >
                  Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
