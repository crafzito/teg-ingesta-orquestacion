import { Button, Avatar } from '@heroui/react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'

export function Header() {
  const { user, logout } = useAuthStore()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-background/80 backdrop-blur-md border-b border-divider flex items-center justify-end px-6 transition-all duration-300 ${
        sidebarOpen ? 'left-64' : 'left-16'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar
          name={user?.displayName?.[0] ?? 'U'}
          size="sm"
          color="primary"
          isBordered
        />
        <span className="text-sm text-default-600 hidden sm:inline">
          {user?.displayName ?? 'Usuario'}
        </span>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="danger"
          onPress={logout}
          aria-label="Cerrar sesion"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
