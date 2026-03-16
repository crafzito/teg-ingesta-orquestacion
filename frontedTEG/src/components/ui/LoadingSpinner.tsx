import { Spinner } from '@heroui/react'

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <Spinner size="lg" color="primary" />
    </div>
  )
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-danger-50 border border-danger-200 p-4 text-sm text-danger">
      {message}
    </div>
  )
}
