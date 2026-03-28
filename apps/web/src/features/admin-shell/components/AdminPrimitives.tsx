import type { ReactNode } from 'react'

export function AdminPageHeader({
  title,
  description,
  badgeToken,
  badgeLabel,
  actionSlot,
}: {
  title: string
  description?: string
  badgeToken?: 'success' | 'warning' | 'danger' | 'neutral'
  badgeLabel?: string
  actionSlot?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 max-w-3xl">
        {badgeLabel ? (
          <div className="mb-3">
            <AdminBadge label={badgeLabel} tone={badgeToken} />
          </div>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {actionSlot ? (
        <div className="shrink-0 pt-1 flex flex-wrap gap-3">
          {actionSlot}
        </div>
      ) : null}
    </div>
  )
}

export function AdminCard({
  title,
  description,
  headerAction,
  children,
  className = '',
}: {
  title?: string
  description?: string
  headerAction?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#18181b]/80 ${className}`}>
      {(title || description || headerAction) ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
          {headerAction ? <div>{headerAction}</div> : null}
        </div>
      ) : null}
      <div className="px-4 py-3.5">
        {children}
      </div>
    </section>
  )
}

export function AdminDataCell({
  label,
  value,
  secondaryValue,
  className = '',
}: {
  label: string
  value: ReactNode
  secondaryValue?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03] ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">
        {value}
      </div>
      {secondaryValue ? (
        <div className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
          {secondaryValue}
        </div>
      ) : null}
    </div>
  )
}

export function AdminBadge({
  label,
  tone = 'neutral',
}: {
  label: ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'primary'
}) {
  const base = 'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider'
  switch (tone) {
    case 'success':
      return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400`}>{label}</span>
    case 'warning':
      return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400`}>{label}</span>
    case 'danger':
      return <span className={`${base} border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400`}>{label}</span>
    case 'primary':
      return <span className={`${base} border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400`}>{label}</span>
    case 'neutral':
    default:
      return <span className={`${base} border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300`}>{label}</span>
  }
}

export function AdminButton({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  dataTestId,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  dataTestId?: string
}) {
  const base = 'inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  
  let styles = ''
  if (variant === 'primary') {
    styles = 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-sm'
  } else if (variant === 'secondary') {
    styles = 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/5'
  } else if (variant === 'danger') {
    styles = 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30'
  } else {
    styles = 'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function AdminStatusMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'error' | 'success'
}) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300'

  return <div className={`rounded-xl border p-4 text-sm font-medium ${styles}`}>{children}</div>
}
