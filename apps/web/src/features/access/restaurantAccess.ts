import type { UserRole as ApiUserRole } from '../../lib/api/types'

export type UserRole = ApiUserRole | null | undefined

export interface AccessDescriptor {
  label: string
  description: string
}

export type UserRoleDescriptor = AccessDescriptor

function getLocalizedStrings(language: string) {
  if (language.startsWith('vi')) {
    return {
      userLabel: 'User workspace',
      userDescription: 'Xem dashboard, reviews, settings va doi nha hang trong cung mot flow.',
      adminLabel: 'Admin control plane',
      adminDescription:
        'Quan ly restaurant overview, intake, review ops va crawl runtime trong mot khu dieu khien rieng.',
      unknownLabel: 'Unknown access',
      unknownDescription: 'Fail-closed: cho den khi backend tra ve user.role hop le.',
      deniedAdminNotice: 'Trang admin khong ho tro role hien tai.',
      deniedMerchantNotice: 'Trang user khong ho tro role hien tai.',
    }
  }

  return {
    userLabel: 'User workspace',
    userDescription: 'View the restaurant dashboard, reviews, settings, and switch restaurant context.',
    adminLabel: 'Admin control plane',
    adminDescription:
      'Inspect restaurant overview, intake, review ops, and crawl runtime without using merchant routes.',
    unknownLabel: 'Unknown access',
    unknownDescription: 'Fail-closed mode until the backend returns a known user.role.',
    deniedAdminNotice: 'This route is not available for the current role.',
    deniedMerchantNotice: 'This route is not available for the current role.',
  }
}

export function isAdminRole(role: UserRole) {
  return role === 'ADMIN'
}

export function isUserRole(role: UserRole) {
  return role === 'USER'
}

export function getRoleDescriptor(role: UserRole, language: string): UserRoleDescriptor {
  const strings = getLocalizedStrings(language)

  if (isAdminRole(role)) {
    return {
      label: strings.adminLabel,
      description: strings.adminDescription,
    }
  }

  if (isUserRole(role)) {
    return {
      label: strings.userLabel,
      description: strings.userDescription,
    }
  }

  return {
    label: strings.unknownLabel,
    description: strings.unknownDescription,
  }
}

export function getAdminAccessDeniedMessage(language: string) {
  return getLocalizedStrings(language).deniedAdminNotice
}

export function getMerchantAccessDeniedMessage(language: string) {
  return getLocalizedStrings(language).deniedMerchantNotice
}
