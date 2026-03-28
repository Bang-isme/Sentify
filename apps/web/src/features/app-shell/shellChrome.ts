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
      shell: 'bg-slate-50 text-slate-900 dark:bg-[#09090b] dark:text-zinc-100',
      backdropOne: 'bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.06),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_30%)]',
      backdropTwo: 'bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.06),transparent_22%)] dark:bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_22%)]',
      rail: 'border-slate-200 bg-white/95 dark:border-white/[0.08] dark:bg-[#0e0e11]/95 backdrop-blur-3xl',
      railDivider: 'border-slate-200 dark:border-white/[0.06]',
      railItemActive: 'bg-slate-100 text-slate-900 font-medium dark:bg-white/[0.08] dark:text-white',
      railItemIdle: 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-200',
      railSectionLabel: 'text-slate-400 dark:text-zinc-500 font-semibold',
      railIcon: 'text-slate-400 dark:text-zinc-500',
      hero: 'border-slate-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0e0e11]',
      heroPanel: 'border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-zinc-900/40',
      chip: 'border-slate-200 bg-white text-slate-700 dark:border-white/[0.08] dark:bg-[#27272a] dark:text-zinc-200',
      chipMuted: 'border-slate-100 bg-slate-50 text-slate-500 dark:border-white/5 dark:bg-zinc-900/50 dark:text-zinc-400',
      menuSurface: 'border-slate-200 bg-white shadow-lg dark:border-white/[0.08] dark:bg-[#18181b]',
      accent: 'text-slate-900 dark:text-white',
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
      'border-teal-600/30 bg-teal-600/[0.06] text-[#0d1e25] shadow-[0_2px_12px_-4px_rgba(15,118,110,0.15)] ring-1 ring-inset ring-teal-600/10',
    railItemIdle:
      'border-transparent text-[#55636d] hover:border-[#d7e1e7]/60 hover:bg-white/60 hover:text-[#17212a]',
    railSectionLabel: 'text-[#6f818d]',
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
      return 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
    case 'warning':
      return 'border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400'
    case 'danger':
      return 'border-red-500/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-400'
    default:
      return 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
  }
}

export function getShellStageClass(stageTone?: string) {
  return stageTone === 'next'
    ? 'border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400'
    : 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400'
}
