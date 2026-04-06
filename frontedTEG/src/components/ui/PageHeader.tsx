interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-default-500">{description}</p>}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}
