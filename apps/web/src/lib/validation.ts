export interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  name?: string
  address?: string
  googleMapUrl?: string
  from?: string
  to?: string
}

export const FIELD_LIMITS = {
  fullName: 100,
  email: 254,
  passwordMin: 8,
  restaurantName: 120,
  restaurantAddress: 255,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUPPORTED_GOOGLE_MAPS_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'g.co', 'goo.gl'])

function canParseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeText(value: string) {
  return value.trim()
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value)
}

export function isGoogleMapsUrl(value: string) {
  const parsedUrl = canParseUrl(value)

  if (!parsedUrl) {
    return {
      valid: false,
      reason: 'invalid',
    } as const
  }

  const hostname = parsedUrl.hostname.toLowerCase()

  if (SUPPORTED_GOOGLE_MAPS_SHORT_HOSTS.has(hostname)) {
    return {
      valid: true,
      reason: null,
    } as const
  }

  if (
    !['google.com', 'www.google.com', 'maps.google.com'].includes(hostname) ||
    !parsedUrl.pathname.startsWith('/maps')
  ) {
    return {
      valid: false,
      reason: 'not_google',
    } as const
  }

  return {
    valid: true,
    reason: null,
  } as const
}

export function isValidDateRange(from?: string, to?: string) {
  if (!from || !to) {
    return true
  }

  return new Date(`${from}T00:00:00.000Z`) <= new Date(`${to}T23:59:59.999Z`)
}
