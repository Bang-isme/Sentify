import { useEffect, useState, type FormEvent } from 'react'
import { FIELD_LIMITS, isGoogleMapsUrl, normalizeText } from '../../lib/validation'
import type { MerchantHubSettingsScreenProps } from './merchantHubTypes'
import { getMerchantHubCopy } from './merchantHubCopy'
import { MerchantHubBadge, MerchantHubPanel, MerchantHubSectionHeader } from './merchantHubUi'

function SettingsBlock({
  title,
  description,
  status,
  items,
  language = 'vi',
}: MerchantHubSettingsScreenProps['profileBlock'] & { language?: string }) {
  const copy = getMerchantHubCopy(language)

  return (
    <div className="border border-[#e7ded0] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-black tracking-tight text-[#1f1c18]">{title}</div>
          <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">{description}</div>
        </div>
        <MerchantHubBadge state={status}>
          {status === 'now' ? copy.nowLabel : copy.nextLabel}
        </MerchantHubBadge>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className="border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{item.label}</div>
            <div className="mt-1 text-[13px] font-semibold text-[#1f1c18]">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <div className="text-[12px] font-medium text-rose-700">{message}</div>
}

export function MerchantHubSettingsScreen({
  language,
  restaurant,
  detail,
  pending,
  profileBlock,
  sourceBlock,
  accessBlock,
  nextBlock,
  restaurantNameLabel,
  restaurantAddressLabel,
  googleMapsUrlLabel,
  googleMapsUrlPlaceholder,
  saveLabel,
  savingLabel,
  validation,
  onSaveProfile,
  onSaveSource,
  onNavigateToReviews,
  onNavigateToActions,
}: MerchantHubSettingsScreenProps) {
  const copy = getMerchantHubCopy(language)
  void nextBlock
  const [name, setName] = useState(detail?.name ?? restaurant?.name ?? '')
  const [address, setAddress] = useState(detail?.address ?? '')
  const [googleMapUrl, setGoogleMapUrl] = useState(detail?.googleMapUrl ?? '')
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    address?: string
    googleMapUrl?: string
  }>({})

  useEffect(() => {
    setName(detail?.name ?? restaurant?.name ?? '')
    setAddress(detail?.address ?? '')
    setGoogleMapUrl(detail?.googleMapUrl ?? '')
    setFieldErrors({})
  }, [detail?.address, detail?.googleMapUrl, detail?.name, restaurant?.name])

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedAddress = normalizeText(address)
    const nextErrors: typeof fieldErrors = {}

    if (!trimmedName) {
      nextErrors.name = validation.restaurantNameRequired
    } else if (trimmedName.length > FIELD_LIMITS.restaurantName) {
      nextErrors.name = validation.restaurantNameTooLong
    }

    if (trimmedAddress.length > FIELD_LIMITS.restaurantAddress) {
      nextErrors.address = validation.restaurantAddressTooLong
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((current) => ({
        ...current,
        ...nextErrors,
      }))
      return
    }

    setFieldErrors((current) => ({
      ...current,
      name: undefined,
      address: undefined,
    }))
    await onSaveProfile({
      name: trimmedName,
      address: trimmedAddress || null,
    })
  }

  async function handleSaveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedGoogleMapUrl = normalizeText(googleMapUrl)

    if (trimmedGoogleMapUrl) {
      const result = isGoogleMapsUrl(trimmedGoogleMapUrl)

      if (!result.valid) {
        setFieldErrors((current) => ({
          ...current,
          googleMapUrl:
            result.reason === 'not_google'
              ? validation.googleMapsUrlMustBeGoogle
              : validation.googleMapsUrlInvalid,
        }))
        return
      }
    }

    setFieldErrors((current) => ({
      ...current,
      googleMapUrl: undefined,
    }))
    await onSaveSource({
      googleMapUrl: trimmedGoogleMapUrl || null,
    })
  }

  return (
    <div data-testid="merchant-settings-screen" className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <MerchantHubSectionHeader
          eyebrow={copy.settings.title}
          title={language.startsWith('vi') ? 'Thiết lập nhà hàng' : 'Settings that stay readable'}
          description={copy.settings.description}
          action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <MerchantHubBadge state="now">{restaurant?.name ?? (language.startsWith('vi') ? 'Nhà hàng' : 'Restaurant')}</MerchantHubBadge>
          <MerchantHubBadge state={detail?.googleMapUrl ? 'now' : 'next'}>
            {detail?.googleMapUrl
              ? language.startsWith('vi')
                ? 'Đã kết nối Google Maps'
                : 'Source connected'
              : language.startsWith('vi')
                ? 'Thiếu nguồn Google Maps'
                : 'Source missing'}
          </MerchantHubBadge>
        </div>
      </MerchantHubPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="grid gap-4">
          <SettingsBlock {...profileBlock} language={language} />
          <MerchantHubPanel className="p-5 lg:p-4">
            <MerchantHubSectionHeader
              eyebrow={copy.nowLabel}
              title={language.startsWith('vi') ? 'Cập nhật thông tin quán' : 'Update restaurant profile'}
              description={
                language.startsWith('vi')
                  ? 'Giữ tên và địa chỉ nhà hàng luôn chính xác ngay trong luồng làm việc của chủ quán.'
                  : 'Keep the merchant-visible profile current without leaving the product flow.'
              }
              action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
            />
            <form data-testid="settings-form" className="mt-5 grid gap-4" onSubmit={handleSaveProfile}>
              <label className="grid gap-2 text-[13px] font-semibold text-[#1f1c18]">
                <span>{restaurantNameLabel}</span>
                <input
                  aria-label={restaurantNameLabel}
                  data-testid="restaurant-name-input"
                  type="text"
                  maxLength={FIELD_LIMITS.restaurantName}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setFieldErrors((current) => ({ ...current, name: undefined }))
                  }}
                  className="h-11 border border-[#e7ded0] bg-[#fcfaf6] px-3 text-[13px] text-[#1f1c18] outline-none transition focus:border-[#caa55e]"
                />
                <FieldError message={fieldErrors.name} />
              </label>

              <label className="grid gap-2 text-[13px] font-semibold text-[#1f1c18]">
                <span>{restaurantAddressLabel}</span>
                <input
                  aria-label={restaurantAddressLabel}
                  data-testid="restaurant-address-input"
                  type="text"
                  maxLength={FIELD_LIMITS.restaurantAddress}
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value)
                    setFieldErrors((current) => ({ ...current, address: undefined }))
                  }}
                  className="h-11 border border-[#e7ded0] bg-[#fcfaf6] px-3 text-[13px] text-[#1f1c18] outline-none transition focus:border-[#caa55e]"
                />
                <FieldError message={fieldErrors.address} />
              </label>

              <div>
                <button
                  type="submit"
                  data-testid="save-profile"
                  disabled={pending}
                  className="inline-flex h-11 items-center justify-center border border-[#d9c29b] bg-[#ca8a04] px-4 text-[13px] font-bold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? savingLabel : saveLabel}
                </button>
              </div>
            </form>
          </MerchantHubPanel>
        </div>

        <div className="grid gap-4">
          <SettingsBlock {...sourceBlock} language={language} />
          <MerchantHubPanel className="p-5 lg:p-4">
            <MerchantHubSectionHeader
              eyebrow={copy.nowLabel}
              title={language.startsWith('vi') ? 'Cập nhật nguồn Google Maps' : 'Update source URL'}
              description={
                language.startsWith('vi')
                  ? 'Chủ quán vẫn nhìn thấy và chỉnh được URL nguồn để dữ liệu luôn đúng thực tế.'
                  : 'Source configuration stays visible and editable from the merchant side.'
              }
              action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
            />
            <form className="mt-5 grid gap-4" onSubmit={handleSaveSource}>
              <label className="grid gap-2 text-[13px] font-semibold text-[#1f1c18]">
                <span>{googleMapsUrlLabel}</span>
                <input
                  aria-label={googleMapsUrlLabel}
                  type="url"
                  placeholder={googleMapsUrlPlaceholder}
                  value={googleMapUrl}
                  onChange={(event) => {
                    setGoogleMapUrl(event.target.value)
                    setFieldErrors((current) => ({ ...current, googleMapUrl: undefined }))
                  }}
                  className="h-11 border border-[#e7ded0] bg-[#fcfaf6] px-3 text-[13px] text-[#1f1c18] outline-none transition focus:border-[#caa55e]"
                />
                <FieldError message={fieldErrors.googleMapUrl} />
              </label>

              <div>
                <button
                  type="submit"
                  data-testid="save-source"
                  disabled={pending}
                  className="inline-flex h-11 items-center justify-center border border-[#e7ded0] bg-white px-4 text-[13px] font-semibold text-[#1f1c18] transition hover:border-[#caa55e] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? savingLabel : saveLabel}
                </button>
              </div>
            </form>
          </MerchantHubPanel>
        </div>
      </div>

      <MerchantHubPanel className="p-5 lg:p-4">
        <MerchantHubSectionHeader
          eyebrow={language.startsWith('vi') ? 'Lưu ý cho chủ quán' : copy.nowLabel}
          title={language.startsWith('vi') ? 'Những gì bạn có thể chỉnh ở đây' : 'What you can change here'}
          description={
            language.startsWith('vi')
              ? 'Màn thiết lập chỉ giữ lại các mục mà chủ quán cần chỉnh trực tiếp. Điều khiển quản trị nội bộ và các lớp mở rộng sau này không hiển thị ở đây.'
              : accessBlock.description
          }
          action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
        />
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {accessBlock.items.map((item) => (
            <div key={item.label} className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{item.label}</div>
              <div className="mt-2 text-[13px] font-semibold leading-6 text-[#1f1c18]">{item.value}</div>
            </div>
          ))}
        </div>
      </MerchantHubPanel>

      <MerchantHubPanel className="p-5 lg:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
            onClick={onNavigateToReviews}
          >
            {language.startsWith('vi') ? 'Mở danh sách đánh giá' : 'Open reviews'}
          </button>
          <button
            type="button"
            className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
            onClick={onNavigateToActions}
          >
            {language.startsWith('vi') ? 'Mở việc cần làm' : 'Open actions'}
          </button>
        </div>
      </MerchantHubPanel>
    </div>
  )
}
