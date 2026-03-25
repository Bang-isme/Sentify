import { useState, type FormEvent, type ReactNode } from 'react'
import type { CreateRestaurantInput } from '../../../lib/api'
import {
  FIELD_LIMITS,
  isGoogleMapsUrl,
  normalizeText,
  type FieldErrors,
} from '../../../lib/validation'
import type { ProductUiCopy } from '../../../content/productUiCopy'

export function PageIntro({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  meta?: Array<{
    icon: string
    label: string
    tone?: 'default' | 'success' | 'warning'
  }>
  actions?: ReactNode
}) {
  const toneClass = (tone: 'default' | 'success' | 'warning' = 'default') =>
    tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'
        : 'border-border-light/70 bg-bg-light/70 text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white'

  return (
    <section className="app-shell-panel rounded-[1.45rem] border border-border-light/70 bg-surface-white/88 p-4 shadow-[0_18px_56px_-36px_rgba(0,0,0,0.3)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              <span className="size-2 rounded-full bg-primary"></span>
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={`text-[1.5rem] font-black tracking-tight text-text-charcoal dark:text-white sm:text-[1.65rem] ${
              eyebrow ? 'mt-4' : ''
            }`}
          >
            {title}
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
            {description}
          </p>
          {meta?.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {meta.map((item) => (
                <div
                  key={`${item.icon}-${item.label}`}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${toneClass(item.tone)}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end [&>*]:w-full [&>*]:justify-center sm:[&>*]:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function SectionCard({
  title,
  description,
  headerAside,
  tone = 'default',
  className,
  children,
}: {
  title: string
  description?: string
  headerAside?: ReactNode
  tone?: 'default' | 'accent'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`app-shell-panel rounded-[1.45rem] border p-4 shadow-[0_18px_56px_-36px_rgba(0,0,0,0.32)] backdrop-blur sm:p-5 ${
        tone === 'accent'
          ? 'border-primary/18 bg-primary/[0.04] dark:border-primary/15 dark:bg-primary/[0.05]'
          : 'border-border-light/70 bg-surface-white/88 dark:border-border-dark/70 dark:bg-surface-dark/82'
      } ${className ?? ''}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text-charcoal dark:text-white sm:text-[1.15rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
              {description}
            </p>
          ) : null}
        </div>
        {headerAside ? <div className="w-full shrink-0 sm:w-auto">{headerAside}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function SidebarStatusPill({
  icon,
  label,
  tone = 'neutral',
  compact = false,
}: {
  icon: string
  label: string
  tone?: 'neutral' | 'success' | 'warning'
  compact?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200'
      : tone === 'warning'
        ? 'border-amber-300/35 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200'
        : 'border-border-light/70 bg-surface-white/80 text-text-charcoal dark:border-border-dark dark:bg-surface-dark/70 dark:text-white'

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border ${compact ? 'px-3 py-2.5 text-[13px]' : 'px-3 py-3 text-sm'} ${toneClass}`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span className="font-semibold leading-5">{label}</span>
    </div>
  )
}

export function StatusMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'error'
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
          : 'border-border-light/70 bg-surface-white/80 text-text-silver-light dark:border-border-dark dark:bg-surface-dark/70 dark:text-text-silver-dark'
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <span className="text-xs font-medium text-red-600 dark:text-red-300">{message}</span>
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-border-light/90 bg-bg-light/70 p-5 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/60 dark:text-text-silver-dark">
      {message}
    </div>
  )
}

export function RestaurantSetupForm({
  copy,
  pending,
  actionLabel,
  title,
  description,
  tone = 'default',
  actionTone = 'primary',
  embed = false,
  onSubmit,
}: {
  copy: ProductUiCopy['app']
  pending: boolean
  actionLabel: string
  title: string
  description: string
  tone?: 'default' | 'accent'
  actionTone?: 'primary' | 'secondary'
  embed?: boolean
  onSubmit: (input: CreateRestaurantInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [googleMapUrl, setGoogleMapUrl] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedAddress = normalizeText(address)
    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)
    const nextErrors: FieldErrors = {}

    if (!trimmedName) {
      nextErrors.name = copy.validation.restaurantNameRequired
    } else if (trimmedName.length > FIELD_LIMITS.restaurantName) {
      nextErrors.name = copy.validation.restaurantNameTooLong
    }

    if (trimmedAddress.length > FIELD_LIMITS.restaurantAddress) {
      nextErrors.address = copy.validation.restaurantAddressTooLong
    }

    if (trimmedGoogleMapUrl) {
      const sourceValidation = isGoogleMapsUrl(trimmedGoogleMapUrl)

      if (!sourceValidation.valid) {
        nextErrors.googleMapUrl =
          sourceValidation.reason === 'not_google'
            ? copy.validation.googleMapsUrlMustBeGoogle
            : copy.validation.googleMapsUrlInvalid
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    await onSubmit({
      name: trimmedName,
      address: trimmedAddress || undefined,
      googleMapUrl: trimmedGoogleMapUrl || undefined,
    })

    setName('')
    setAddress('')
    setGoogleMapUrl('')
  }

  const formContent = (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label
        htmlFor="setup-restaurant-name"
        className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
      >
        <span>{copy.restaurantNameLabel}</span>
        <input
          id="setup-restaurant-name"
          required
          maxLength={FIELD_LIMITS.restaurantName}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setFieldErrors((current) => ({ ...current, name: undefined }))
          }}
          aria-invalid={fieldErrors.name ? 'true' : 'false'}
          className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          type="text"
        />
        <FieldError message={fieldErrors.name} />
      </label>
      <label
        htmlFor="setup-restaurant-address"
        className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
      >
        <span>{copy.restaurantAddressLabel}</span>
        <input
          id="setup-restaurant-address"
          maxLength={FIELD_LIMITS.restaurantAddress}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value)
            setFieldErrors((current) => ({ ...current, address: undefined }))
          }}
          aria-invalid={fieldErrors.address ? 'true' : 'false'}
          className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          type="text"
        />
        <FieldError message={fieldErrors.address} />
      </label>
      <label
        htmlFor="setup-restaurant-source"
        className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white md:col-span-2"
      >
        <span>{copy.googleMapsUrlLabel}</span>
        <input
          id="setup-restaurant-source"
          value={googleMapUrl}
          onChange={(event) => {
            setGoogleMapUrl(event.target.value)
            setFieldErrors((current) => ({ ...current, googleMapUrl: undefined }))
          }}
          aria-invalid={fieldErrors.googleMapUrl ? 'true' : 'false'}
          className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark"
          type="url"
          placeholder={copy.googleMapsUrlPlaceholder}
        />
        <FieldError message={fieldErrors.googleMapUrl} />
      </label>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
            actionTone === 'secondary'
              ? 'border border-primary/30 bg-transparent text-primary hover:border-primary hover:bg-primary/8'
              : 'bg-primary text-white hover:bg-primary-dark dark:text-bg-dark'
          }`}
        >
          {pending ? `${actionLabel}...` : actionLabel}
        </button>
      </div>
    </form>
  )

  if (embed) {
    return formContent
  }

  return (
    <SectionCard title={title} description={description} tone={tone}>
      {formContent}
    </SectionCard>
  )
}
