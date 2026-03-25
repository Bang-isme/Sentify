import type { AppRoute, MerchantRoute, AdminRoute } from './routes'

export interface RouteStage {
  label: 'Now' | 'Next'
  tone: 'now' | 'next'
}

export interface NavItem<RouteId extends string = AppRoute> {
  route: RouteId
  label: string
  icon: string
  description: string
  stage: RouteStage
}

export interface NavGroup<RouteId extends string = AppRoute> {
  label: string
  items: NavItem<RouteId>[]
}

export interface RouteMeta {
  sectionLabel: string
  title: string
  description: string
  stage: RouteStage
}

const NOW_STAGE: RouteStage = { label: 'Now', tone: 'now' }
const NEXT_STAGE: RouteStage = { label: 'Next', tone: 'next' }

function isVietnamese(language: string) {
  return language.startsWith('vi')
}

export function getMerchantNavigation(language: string): NavGroup<MerchantRoute>[] {
  if (isVietnamese(language)) {
    return [
      {
        label: 'Ung dung merchant',
        items: [
          {
            route: '/app',
            label: 'Tong quan',
            icon: 'dashboard',
            description: 'KPI, do tuoi dataset, diem nghẽn va diem hanh dong tiep theo.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/reviews',
            label: 'Reviews',
            icon: 'reviews',
            description: 'Bang chung goc, bo loc, va xu huong phan nan.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/actions',
            label: 'Hanh dong',
            icon: 'task_alt',
            description: 'Goi y uu tien can sua dua tren bang chung da publish.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/settings',
            label: 'Cai dat',
            icon: 'settings',
            description: 'Ho so nha hang, source policy, va trang thai dataset.',
            stage: NOW_STAGE,
          },
        ],
      },
    ]
  }

  return [
    {
      label: 'Merchant app',
      items: [
        {
          route: '/app',
          label: 'Home',
          icon: 'dashboard',
          description: 'KPI summary, dataset freshness, top issue, and next action.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/reviews',
          label: 'Reviews',
          icon: 'reviews',
          description: 'Searchable evidence with filters and complaint slicing.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/actions',
          label: 'Actions',
          icon: 'task_alt',
          description: 'Prioritized operational issues backed by published evidence.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/settings',
          label: 'Settings',
          icon: 'settings',
          description: 'Restaurant profile, source policy, and dataset readiness.',
          stage: NOW_STAGE,
        },
      ],
    },
  ]
}

export function getAdminNavigation(language: string): NavGroup<AdminRoute>[] {
  if (isVietnamese(language)) {
    return [
      {
        label: 'Operations',
        items: [
          {
            route: '/admin/operations/restaurants',
            label: 'Restaurants',
            icon: 'storefront',
            description: 'Danh sach nha hang va muc do san sang van hanh.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/intake',
            label: 'Intake',
            icon: 'inventory_2',
            description: 'Batch inbox, review queue, va publish loop.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/review-ops',
            label: 'Review ops',
            icon: 'sync_alt',
            description: 'Sync tu Google Maps vao draft batch.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/crawl',
            label: 'Crawl',
            icon: 'travel_explore',
            description: 'Source, run, diagnostics, va queue runtime.',
            stage: NOW_STAGE,
          },
        ],
      },
      {
        label: 'Access',
        items: [
          {
            route: '/admin/access/users',
            label: 'Users',
            icon: 'group',
            description: 'Quan ly user, role, va trang thai tai khoan.',
            stage: NEXT_STAGE,
          },
          {
            route: '/admin/access/memberships',
            label: 'Memberships',
            icon: 'badge',
            description: 'Gan user vao nha hang va xem mapping hai chieu.',
            stage: NEXT_STAGE,
          },
        ],
      },
      {
        label: 'Platform',
        items: [
          {
            route: '/admin/platform/health-jobs',
            label: 'Health & jobs',
            icon: 'monitor_heart',
            description: 'Backend health, worker, queue, va recovery.',
            stage: NEXT_STAGE,
          },
          {
            route: '/admin/platform/integrations-policies',
            label: 'Integrations',
            icon: 'settings_input_component',
            description: 'Source policy, crawler policy, va readiness.',
            stage: NEXT_STAGE,
          },
          {
            route: '/admin/platform/audit',
            label: 'Audit',
            icon: 'history',
            description: 'Log publish, operator action, va lich su ingest.',
            stage: NEXT_STAGE,
          },
        ],
      },
    ]
  }

  return [
    {
      label: 'Operations',
      items: [
        {
          route: '/admin/operations/restaurants',
          label: 'Restaurants',
          icon: 'storefront',
          description: 'Restaurant discovery, readiness, and entry into restaurant-scoped operations.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/intake',
          label: 'Intake',
          icon: 'inventory_2',
          description: 'Batch inbox, curation, approval, and publish flow.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/review-ops',
          label: 'Review ops',
          icon: 'sync_alt',
          description: 'Sync-to-draft orchestration and draft/publish bridge.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/crawl',
          label: 'Crawl',
          icon: 'travel_explore',
          description: 'Source management, runs, coverage diagnostics, and runtime health.',
          stage: NOW_STAGE,
        },
      ],
    },
    {
      label: 'Access',
      items: [
        {
          route: '/admin/access/users',
          label: 'Users',
          icon: 'group',
          description: 'User directory, role assignment, status, and reset actions.',
          stage: NEXT_STAGE,
        },
        {
          route: '/admin/access/memberships',
          label: 'Memberships',
          icon: 'badge',
          description: 'Assign users to restaurants and inspect both sides of the mapping.',
          stage: NEXT_STAGE,
        },
      ],
    },
    {
      label: 'Platform',
      items: [
        {
          route: '/admin/platform/health-jobs',
          label: 'Health & jobs',
          icon: 'monitor_heart',
          description: 'Backend health, worker state, queue visibility, and recovery posture.',
          stage: NEXT_STAGE,
        },
        {
          route: '/admin/platform/integrations-policies',
          label: 'Integrations',
          icon: 'settings_input_component',
          description: 'Integration readiness and environment-level policy surfaces.',
          stage: NEXT_STAGE,
        },
        {
          route: '/admin/platform/audit',
          label: 'Audit',
          icon: 'history',
          description: 'Publish history, operator activity, and system event trail.',
          stage: NEXT_STAGE,
        },
      ],
    },
  ]
}

export function getRouteMeta(route: AppRoute, language: string): RouteMeta {
  const merchantItems = getMerchantNavigation(language).flatMap((group) => group.items)
  const adminItems = getAdminNavigation(language).flatMap((group) => group.items)
  const routeItem = [...merchantItems, ...adminItems].find((item) => item.route === route)

  if (route === '/login') {
    return {
      sectionLabel: isVietnamese(language) ? 'Dang nhap' : 'Login',
      title: isVietnamese(language) ? 'Dang nhap vao Sentify' : 'Log into Sentify',
      description: isVietnamese(language)
        ? 'Truy cap dung shell theo role cua user.'
        : 'Authenticate into the correct product shell for the active role.',
      stage: NOW_STAGE,
    }
  }

  if (route === '/signup') {
    return {
      sectionLabel: isVietnamese(language) ? 'Dang ky' : 'Sign up',
      title: isVietnamese(language) ? 'Tao tai khoan Sentify' : 'Create a Sentify account',
      description: isVietnamese(language)
        ? 'Bat dau voi flow merchant duoc bao ve bang role.'
        : 'Start with the merchant flow under the simplified role model.',
      stage: NOW_STAGE,
    }
  }

  if (route === '/admin') {
    return {
      sectionLabel: isVietnamese(language) ? 'Admin hub' : 'Admin hub',
      title: isVietnamese(language)
        ? 'Command center cho operations, access va platform'
        : 'Command center across operations, access, and platform',
      description: isVietnamese(language)
        ? 'Tong quan cap he thong, gom ca surface da co backend va surface tiep theo.'
        : 'A global control-plane overview across the backed operations surfaces and the planned expansion areas.',
      stage: NOW_STAGE,
    }
  }

  if (routeItem) {
    return {
      sectionLabel: routeItem.label,
      title: routeItem.label,
      description: routeItem.description,
      stage: routeItem.stage,
    }
  }

  return {
    sectionLabel: 'Sentify',
    title: 'Sentify',
    description: 'Role-based product surface.',
    stage: NOW_STAGE,
  }
}
