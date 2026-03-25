export type ShellMode = 'merchant' | 'admin'

export interface ShellChromeCopy {
  navigation: string
  collapse: string
  expand: string
  openNavigation: string
  closeNavigation: string
  openAccountMenu: string
  languageLabel: string
  themeLabel: string
  viewLabel: string
  roleLabel: string
  restaurantLabel: string
  homeLabel: string
  merchantShellLabel: string
  adminShellLabel: string
  landingLabel: string
}

export interface ShellChromePalette {
  shell: string
  backdropOne: string
  backdropTwo: string
  rail: string
  railDivider: string
  railItemActive: string
  railItemIdle: string
  railSectionLabel: string
  railIcon: string
  hero: string
  heroPanel: string
  chip: string
  chipMuted: string
  menuSurface: string
  accent: string
}

export interface ShellChrome {
  copy: ShellChromeCopy
  palette: ShellChromePalette
}

export function isVietnamese(language: string) {
  return language.startsWith('vi')
}

export function getShellCopy(language: string): ShellChromeCopy {
  if (isVietnamese(language)) {
    return {
      navigation: 'Điều hướng',
      collapse: 'Thu gọn thanh bên',
      expand: 'Mở rộng thanh bên',
      openNavigation: 'Mở điều hướng',
      closeNavigation: 'Đóng điều hướng',
      openAccountMenu: 'Mở menu tài khoản',
      languageLabel: 'Ngôn ngữ',
      themeLabel: 'Đổi giao diện sáng tối',
      viewLabel: 'Đang xem',
      roleLabel: 'Vai trò',
      restaurantLabel: 'Nhà hàng',
      homeLabel: 'Trang chính',
      merchantShellLabel: 'Không gian nhà hàng',
      adminShellLabel: 'Khu điều hành quản trị',
      landingLabel: 'Trang giới thiệu',
    }
  }

  return {
    navigation: 'Navigation',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    openAccountMenu: 'Open account menu',
    languageLabel: 'Language',
    themeLabel: 'Toggle theme',
    viewLabel: 'Viewing',
    roleLabel: 'Role',
    restaurantLabel: 'Restaurant',
    homeLabel: 'Home',
    merchantShellLabel: 'Merchant app',
    adminShellLabel: 'Admin control app',
    landingLabel: 'Landing page',
  }
}

export function getShellPalette(mode: ShellMode): ShellChromePalette {
  if (mode === 'admin') {
    return {
      shell: 'bg-[#08131b] text-[#e0f2fe]',
      backdropOne:
        'bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%)]',
      backdropTwo:
        'bg-[radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.08),transparent_24%)]',
      rail: 'border-[#173344] bg-[#0c1821]/98',
      railDivider: 'border-[#173344]',
      railItemActive:
        'border-sky-500/25 bg-sky-400/10 text-white shadow-[0_10px_24px_-22px_rgba(14,165,233,0.6)]',
      railItemIdle:
        'border-transparent text-[#8aa4b8] hover:border-[#1f3747] hover:bg-[#102330] hover:text-[#e0f2fe]',
      railSectionLabel: 'text-[#6ea9c8]',
      railIcon: 'text-[#7dd3fc]',
      hero: 'border-[#173344] bg-[#0d1b25]/90',
      heroPanel: 'border-[#224050] bg-[#102330]/82',
      chip: 'border-[#224050] bg-[#0f2230] text-[#d7eaf7]',
      chipMuted: 'border-[#1a3444] bg-[#0c1821] text-[#8aa4b8]',
      menuSurface: 'border-[#224050] bg-[#0d1b25]/98',
      accent: 'text-[#22d3ee]',
    }
  }

  return {
    shell: 'bg-[#eef2f3] text-[#17212a]',
    backdropOne:
      'bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_30%)]',
    backdropTwo:
      'bg-[radial-gradient(circle_at_bottom_right,rgba(71,85,105,0.08),transparent_26%)]',
    rail: 'border-[#d7e1e7] bg-[#f7fafb]/96',
    railDivider: 'border-[#dde5ea]',
    railItemActive:
      'border-teal-600/25 bg-teal-600/[0.08] text-[#102229] shadow-[0_10px_24px_-22px_rgba(15,118,110,0.45)]',
    railItemIdle:
      'border-transparent text-[#55636d] hover:border-[#d7e1e7] hover:bg-white/80 hover:text-[#17212a]',
    railSectionLabel: 'text-[#667782]',
    railIcon: 'text-[#0f766e]',
    hero: 'border-[#d7e1e7] bg-white/92',
    heroPanel: 'border-[#dde5ea] bg-[#f6fafb]',
    chip: 'border-[#d7e1e7] bg-white text-[#17212a]',
    chipMuted: 'border-[#dde5ea] bg-[#f3f7f8] text-[#5f6d77]',
    menuSurface: 'border-[#dde5ea] bg-[#fcfdfd]/98',
    accent: 'text-[#0f766e]',
  }
}

export function getShellChrome(mode: ShellMode, language: string): ShellChrome {
  return {
    copy: getShellCopy(language),
    palette: getShellPalette(mode),
  }
}

export function getShellBadgeClass(tone?: 'neutral' | 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
    case 'warning':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-100'
    case 'danger':
      return 'border-red-500/25 bg-red-500/10 text-red-100'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}

export function getShellStageClass(stageTone?: string) {
  return stageTone === 'next'
    ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
}
