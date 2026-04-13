import { Button, Card, CardBody } from '@heroui/react'
import { ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/ui/PageHeader'

export default function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader title="Acceso restringido" description="No tienes permisos para entrar a esta sección." />
      <Card shadow="sm" className="max-w-2xl border border-warning-200 bg-warning-50/60">
        <CardBody className="gap-4 p-6">
          <div className="flex items-center gap-3 text-warning-700">
            <ShieldAlert className="h-6 w-6" />
            <p className="text-sm font-medium">
              Tu rol actual no tiene acceso a este módulo. La administración global es exclusiva de superadmin,
              mientras que el monitor ETL queda reservado a perfiles operativos autorizados.
            </p>
          </div>
          <div>
            <Button color="primary" onPress={() => navigate('/', { replace: true })}>
              Volver al dashboard
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
