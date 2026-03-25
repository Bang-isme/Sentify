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
      userLabel: 'Không gian nhà hàng',
      userDescription: 'Theo dõi quán, đọc phản hồi khách, chọn việc nên làm và cập nhật thông tin vận hành.',
      adminLabel: 'Khu điều hành quản trị',
      adminDescription:
        'Quản lý nhà hàng, nhập liệu, tài khoản, thành viên và sức khỏe hệ thống trong control plane riêng.',
      unknownLabel: 'Không xác định quyền truy cập',
      unknownDescription: 'Hệ thống đang chặn hiển thị cho tới khi backend trả về user.role hợp lệ.',
      deniedAdminNotice: 'Tài khoản hiện tại không có quyền vào khu quản trị.',
      deniedMerchantNotice: 'Tài khoản quản trị không đi qua luồng nhà hàng.',
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
