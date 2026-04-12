import { Avatar, Button, Chip } from '@heroui/react'
import { LogOut, Menu } from 'lucide-react'

import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { ROLE_LABELS } from '../../types/auth'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { sidebarOpen, isMobile, toggleSidebar } = useUiStore()

  const leftOffset = isMobile ? 'left-0' : (sidebarOpen ? 'left-64' : 'left-16')

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-background/80 backdrop-blur-md border-b border-divider flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${leftOffset}`}
    >
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

      <div className="flex items-center gap-3">
        <Avatar
          name={user?.fullName?.[0] ?? 'U'}
          size="sm"
          isBordered
          classNames={{
            base: 'bg-[#091B6B] ring-[#091B6B]',
            name: 'text-white',
          }}
        />
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm text-default-700">{user?.fullName ?? 'Usuario'}</span>
          {user?.role && (
            <Chip size="sm" variant="flat" color="primary" className="mt-1">
              {ROLE_LABELS[user.role]}
            </Chip>
          )}
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="danger"
          onPress={() => { void logout() }}
          aria-label="Cerrar sesion"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
