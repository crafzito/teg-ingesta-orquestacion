import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { DatabaseZap, KeyRound, RefreshCcw, Settings2, ShieldCheck, Users } from 'lucide-react'

import { useAdminOverview, useRefreshSchemaCache } from '../api/hooks/useAdminOverview'
import { PageHeader } from '../components/ui/PageHeader'
import { KpiCard } from '../components/ui/KpiCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ROLE_LABELS, type UserRole } from '../types/auth'

const ROLE_TONE: Record<UserRole, 'secondary' | 'primary' | 'default'> = {
  superadmin: 'secondary',
  admin: 'primary',
  analista: 'default',
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Sin acceso registrado'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export default function AdminPage() {
  const overview = useAdminOverview()
  const refreshSchema = useRefreshSchemaCache()

  if (overview.isLoading) {
    return <LoadingSpinner />
  }

  if (overview.isError || !overview.data) {
    return (
      <div>
        <PageHeader
          title="Administración"
          description="Gobernanza del sistema, usuarios seeded y acciones protegidas."
        />
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
          No se pudo cargar el panel de administración: {(overview.error as Error)?.message ?? 'Error desconocido'}
        </div>
      </div>
    )
  }

  const data = overview.data
  const generatedAt = formatDateTime(data.generated_at)

  return (
    <div>
      <PageHeader
        title="Administración"
        description="Gobernanza, control de accesos y acciones globales reservadas a superadmin."
        actions={(
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Chip color="secondary" variant="flat">
              Solo superadmin
            </Chip>
            <Button
              color="secondary"
              variant="flat"
              startContent={<RefreshCcw className={`h-4 w-4 ${refreshSchema.isPending ? 'animate-spin' : ''}`} />}
              isLoading={refreshSchema.isPending}
              onPress={() => refreshSchema.mutate()}
            >
              Refrescar esquema
            </Button>
          </div>
        )}
      />

      {refreshSchema.isSuccess && (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          Caché de esquema refrescada correctamente.
        </div>
      )}
      {refreshSchema.isError && (
        <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger">
          No se pudo refrescar el esquema: {(refreshSchema.error as Error)?.message ?? 'Error desconocido'}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Usuarios activos" value={`${data.active_users}/${data.total_users}`} icon={<Users className="h-6 w-6" />} />
        <KpiCard title="Vistas protegidas" value={String(data.protected_public_views)} icon={<ShieldCheck className="h-6 w-6" />} />
        <KpiCard title="Vistas personalizadas" value={String(data.custom_public_views)} icon={<DatabaseZap className="h-6 w-6" />} />
        <KpiCard title="Directorios monitoreados" value={String(data.monitored_directories.length)} icon={<Settings2 className="h-6 w-6" />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr,1fr]">
        <Card shadow="sm">
          <CardBody className="gap-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Matriz de permisos</h2>
                <p className="text-sm text-default-500">
                  Separación implementada entre consulta, operación y gobernanza.
                </p>
              </div>
              <Chip variant="flat">{generatedAt}</Chip>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.role_matrix.map((roleCard) => (
                <Card key={roleCard.role} shadow="none" className="border border-default-200 bg-default-50/70">
                  <CardBody className="gap-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground">{ROLE_LABELS[roleCard.role]}</h3>
                      <Chip color={ROLE_TONE[roleCard.role]} variant="flat" size="sm">
                        {roleCard.role}
                      </Chip>
                    </div>
                    <p className="text-sm text-default-600">{roleCard.summary}</p>
                    <ul className="space-y-2 text-sm text-default-700">
                      {roleCard.capabilities.map((capability) => (
                        <li key={capability} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF4E00]" />
                          <span>{capability}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardBody className="gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Acciones protegidas</h2>
              <p className="text-sm text-default-500">
                Operaciones sensibles que ya quedaron diferenciadas en esta ronda.
              </p>
            </div>

            <div className="space-y-3">
              {data.protected_actions.map((action) => (
                <div key={action.key} className="rounded-xl border border-default-200 bg-default-50/70 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{action.label}</span>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={action.required_role === 'superadmin' ? 'secondary' : 'primary'}
                    >
                      {action.required_role}
                    </Chip>
                  </div>
                  <p className="text-sm text-default-600">{action.description}</p>
                  <p className="mt-2 text-xs text-default-400">{action.endpoint}</p>
                </div>
              ))}
            </div>

            <Divider />

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-default-500">Configuración visible</h3>
              <div className="space-y-2 text-sm text-default-700">
                {Object.entries(data.system_flags).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <span className="text-default-500">{key}</span>
                    <span className="text-right font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr,1fr]">
        <Card shadow="sm">
          <CardBody className="gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Usuarios seeded</h2>
              <p className="text-sm text-default-500">
                Identidades actuales visibles para gobernanza. La gestión completa de usuarios puede crecer después.
              </p>
            </div>
            <Table aria-label="Usuarios seeded">
              <TableHeader>
                <TableColumn>USUARIO</TableColumn>
                <TableColumn>NOMBRE</TableColumn>
                <TableColumn>ROL</TableColumn>
                <TableColumn>ESTADO</TableColumn>
                <TableColumn>ÚLTIMO ACCESO</TableColumn>
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
                      <Chip size="sm" variant="flat" color={user.active ? 'success' : 'default'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </Chip>
                    </TableCell>
                    <TableCell>{formatDateTime(user.last_login)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardBody className="gap-4 p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#091B6B]" />
              <h2 className="text-lg font-semibold text-foreground">Alcance del superadmin</h2>
            </div>
            <div className="space-y-3 text-sm text-default-700">
              <p>
                Esta vista existe para hacer visible la diferencia con <strong>admin</strong>: gobierno, acciones
                globales y control de metadatos.
              </p>
              <p>
                <strong>Admin</strong> conserva operación diaria, ETL, monitor y negocio.
              </p>
              <p>
                <strong>Analista</strong> permanece en lectura y dashboards.
              </p>
            </div>
            <Divider />
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-default-500">Rutas monitoreadas</h3>
              <ul className="space-y-2 text-sm text-default-700">
                {data.monitored_directories.map((directory) => (
                  <li key={directory} className="rounded-lg bg-default-100 px-3 py-2">
                    {directory}
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
