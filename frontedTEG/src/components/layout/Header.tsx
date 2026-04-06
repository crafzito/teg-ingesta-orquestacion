import { Button, Avatar } from '@heroui/react'
import { LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'

export function Header() {
  const { user, logout } = useAuthStore()
  const { sidebarOpen, isMobile, toggleSidebar } = useUiStore()

  // On mobile: header spans full width (left-0)
  // On desktop: header offsets by sidebar width
  const leftOffset = isMobile ? 'left-0' : (sidebarOpen ? 'left-64' : 'left-16')

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-background/80 backdrop-blur-md border-b border-divider flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${leftOffset}`}
    >
      {/* Left side: hamburger on mobile */}
      <div className="flex items-center">
        {isMobile && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={toggleSidebar}
            aria-label="Abrir menu"
            className="mr-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Right side: user info + logout */}
      <div className="flex items-center gap-3">
        <Avatar
          name={user?.displayName?.[0] ?? 'U'}
          size="sm"
          isBordered
          classNames={{
            base: 'bg-[#091B6B] ring-[#091B6B]',
            name: 'text-white',
          }}
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
