import { useState, type FormEvent } from 'react'
import type {
  CreateRestaurantInput,
  RestaurantDetail,
  UpdateRestaurantInput,
} from '../../../lib/api'
import type { ProductUiCopy } from '../../../content/productUiCopy'
import {
  FIELD_LIMITS,
  isGoogleMapsUrl,
  normalizeText,
  type FieldErrors,
} from '../../../lib/validation'
import {
  EmptyPanel,
  FieldError,
  PageIntro,
  RestaurantSetupForm,
  SectionCard,
} from './shared'

function RestaurantProfileForm({
  copy,
  detail,
  pending,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail
  pending: boolean
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [name, setName] = useState(detail.name)
  const [address, setAddress] = useState(detail.address ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedAddress = normalizeText(address)
    const nextErrors: FieldErrors = {}

    if (!trimmedName) {
      nextErrors.name = copy.validation.restaurantNameRequired
    } else if (trimmedName.length > FIELD_LIMITS.restaurantName) {
      nextErrors.name = copy.validation.restaurantNameTooLong
    }

    if (trimmedAddress.length > FIELD_LIMITS.restaurantAddress) {
      nextErrors.address = copy.validation.restaurantAddressTooLong
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    await onSaveRestaurant({
      name: trimmedName,
      address: trimmedAddress || null,
    })
  }

  return (
    <SectionCard title={copy.settingsRestaurantTitle} description={copy.settingsRestaurantDescription}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label
          htmlFor="settings-restaurant-name"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantNameLabel}</span>
          <input
            id="settings-restaurant-name"
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
          htmlFor="settings-restaurant-address"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.restaurantAddressLabel}</span>
          <input
            id="settings-restaurant-address"
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
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
          >
            {pending ? copy.saving : copy.saveChanges}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

function SourceSettingsForm({
  copy,
  detail,
  pending,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail
  pending: boolean
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [googleMapUrl, setGoogleMapUrl] = useState(detail.googleMapUrl ?? '')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)

    if (trimmedGoogleMapUrl) {
      const sourceValidation = isGoogleMapsUrl(trimmedGoogleMapUrl)

      if (!sourceValidation.valid) {
        setFieldErrors({
          googleMapUrl:
            sourceValidation.reason === 'not_google'
              ? copy.validation.googleMapsUrlMustBeGoogle
              : copy.validation.googleMapsUrlInvalid,
        })
        return
      }
    }

    setFieldErrors({})
    await onSaveRestaurant({
      googleMapUrl: trimmedGoogleMapUrl || null,
    })
  }

  return (
    <SectionCard
      title={copy.settingsSourceTitle}
      description={copy.settingsSourceDescription}
      tone="accent"
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label
          htmlFor="settings-restaurant-source"
          className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
        >
          <span>{copy.googleMapsUrlLabel}</span>
          <input
            id="settings-restaurant-source"
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
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
          >
            {pending ? copy.saving : copy.saveChanges}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

export function SettingsPanel({
  copy,
  detail,
  pending,
  createPending,
  onCreateRestaurant,
  onSaveRestaurant,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  pending: boolean
  createPending: boolean
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
}) {
  const [isAddRestaurantOpen, setIsAddRestaurantOpen] = useState(false)

  if (!detail) {
    return (
      <div className="grid gap-6">
        <PageIntro title={copy.settingsTitle} description={copy.settingsDescription} />
        <EmptyPanel message={copy.noRestaurants} />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={copy.navSettings}
        title={copy.settingsTitle}
        description={copy.settingsDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail.name,
          },
          {
            icon: detail.googleMapUrl ? 'task_alt' : 'warning',
            label: detail.googleMapUrl ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration,
            tone: detail.googleMapUrl ? 'success' : 'warning',
          },
          {
            icon: 'pin_drop',
            label: detail.address || copy.restaurantAddressLabel,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RestaurantProfileForm
          key={`${detail.id}-profile-${detail.name}-${detail.address ?? ''}`}
          copy={copy}
          detail={detail}
          pending={pending}
          onSaveRestaurant={onSaveRestaurant}
        />
        <SourceSettingsForm
          key={`${detail.id}-source-${detail.googleMapUrl ?? ''}`}
          copy={copy}
          detail={detail}
          pending={pending}
          onSaveRestaurant={onSaveRestaurant}
        />
      </div>

      <SectionCard
        title={copy.addRestaurantTitle}
        description={copy.addRestaurantDescription}
        headerAside={
          <button
            type="button"
            aria-expanded={isAddRestaurantOpen}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-light/70 bg-bg-light/70 px-4 text-sm font-semibold text-text-charcoal transition hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-bg-dark/55 dark:text-white"
            onClick={() => setIsAddRestaurantOpen((current) => !current)}
          >
            <span>{copy.createAnotherRestaurant}</span>
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[18px] transition-transform ${
                isAddRestaurantOpen ? 'rotate-180' : ''
              }`}
            >
              expand_more
            </span>
          </button>
        }
      >
        {isAddRestaurantOpen ? (
          <RestaurantSetupForm
            copy={copy}
            pending={createPending}
            actionLabel={copy.createAnotherRestaurant}
            title={copy.addRestaurantTitle}
            description={copy.addRestaurantDescription}
            actionTone="secondary"
            embed
            onSubmit={onCreateRestaurant}
          />
        ) : (
          <div className="rounded-[1.3rem] border border-dashed border-border-light/80 bg-bg-light/60 p-4 text-sm leading-6 text-text-silver-light dark:border-border-dark dark:bg-bg-dark/45 dark:text-text-silver-dark">
            {copy.addRestaurantDescription}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
