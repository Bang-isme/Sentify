import type { ReactNode } from 'react'
import { merchantHubCopy } from './merchantHubCopy'
import type { MerchantHubPriority, MerchantHubState } from './merchantHubTypes'

export function MerchantHubBadge({
  children,
  state = 'now',
  className = '',
}: {
  children: ReactNode
  state?: MerchantHubState
  className?: string
}) {
  const toneClass =
    state === 'now'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass} ${className}`}
    >
      <span className="size-1 rounded-full bg-current"></span>
      {children}
    </span>
  )
}

export function MerchantHubPanel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`border border-[#e5ddd0] bg-white shadow-[0_1px_0_rgba(25,20,12,0.03)] ${className}`}
    >
      {children}
    </section>
  )
}

export function MerchantHubSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-[#dcc8a4] bg-[#faf4e4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a5a44]">
            <span className="size-1 rounded-full bg-[#ca8a04]"></span>
            {eyebrow}
          </div>
        ) : null}
        <h2 className={`text-[1.15rem] font-black tracking-tight text-[#1f1c18] ${eyebrow ? 'mt-2.5' : ''}`}>
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#5f584e]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function MerchantHubMetric({
  label,
  value,
  hint,
  state = 'now',
}: {
  label: string
  value: string
  hint: string
  state?: MerchantHubState
}) {
  return (
    <div className="border border-[#e5ddd0] bg-[#fcfaf6] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8f877c]">{label}</div>
        <MerchantHubBadge state={state}>
          {state === 'now' ? merchantHubCopy.nowLabel : merchantHubCopy.nextLabel}
        </MerchantHubBadge>
      </div>
      <div className="mt-2.5 text-[1.35rem] font-black tracking-tight text-[#1f1c18]">{value}</div>
      <div className="mt-2 text-[13px] leading-5 text-[#5f584e]">{hint}</div>
    </div>
  )
}

export function MerchantHubPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-[#e7ded0] bg-white text-[#3b352d]'

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-[12px] font-semibold ${toneClass}`}
    >
      {children}
    </span>
  )
}

export function MerchantHubPriorityPill({
  priority,
}: {
  priority: MerchantHubPriority
}) {
  const toneClass =
    priority === 'high'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : priority === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClass}`}>
      {priority}
    </span>
  )
}

export function MerchantHubEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-dashed border-[#dcc8a4] bg-[#fcfaf6] px-4 py-4 text-[13px] leading-6 text-[#5f584e]">
      <div className="font-semibold text-[#1f1c18]">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  )
}
