import type { AdminRoute, AppRoute, MerchantRoute } from './routes'

export interface RouteStage {
  label: string
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

const NOW_STAGE: RouteStage = { label: 'Hiện có', tone: 'now' }
const NEXT_STAGE: RouteStage = { label: 'Kế hoạch', tone: 'next' }

function isVietnamese(language: string) {
  return language.startsWith('vi')
}

export function getMerchantNavigation(language: string): NavGroup<MerchantRoute>[] {
  if (isVietnamese(language)) {
    return [
      {
        label: 'Nhà hàng',
        items: [
          {
            route: '/app',
            label: 'Tổng quan',
            icon: 'space_dashboard',
            description: 'Tình hình hôm nay, tín hiệu chính và dữ liệu đang dùng để nhìn quán.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/reviews',
            label: 'Đánh giá',
            icon: 'reviews',
            description: 'Đọc phản hồi khách, lọc nhanh và xem cụm vấn đề đang lặp lại.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/actions',
            label: 'Việc cần làm',
            icon: 'task_alt',
            description: 'Ưu tiên vận hành nên xử lý trước, dựa trên phản hồi đã công bố.',
            stage: NOW_STAGE,
          },
          {
            route: '/app/settings',
            label: 'Thiết lập',
            icon: 'settings',
            description: 'Thông tin quán và cấu hình nguồn hiển thị trong không gian nhà hàng.',
            stage: NOW_STAGE,
          },
        ],
      },
    ]
  }

  return [
    {
      label: 'Merchant',
      items: [
        {
          route: '/app',
          label: 'Home',
          icon: 'space_dashboard',
          description: 'Daily restaurant overview and current data health.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/reviews',
          label: 'Reviews',
          icon: 'reviews',
          description: 'Customer feedback and search filters.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/actions',
          label: 'Actions',
          icon: 'task_alt',
          description: 'Operational priorities backed by feedback.',
          stage: NOW_STAGE,
        },
        {
          route: '/app/settings',
          label: 'Settings',
          icon: 'settings',
          description: 'Restaurant profile and connected source settings.',
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
        label: 'Vận hành',
        items: [
          {
            route: '/admin/operations/restaurants',
            label: 'Nhà hàng',
            icon: 'storefront',
            description: 'Danh sách nhà hàng, mức sẵn sàng và điểm vào vận hành theo từng quán.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/intake',
            label: 'Nhập liệu',
            icon: 'inventory_2',
            description: 'Tạo lô review, duyệt nhanh và công bố dữ liệu chuẩn.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/review-ops',
            label: 'Đồng bộ đánh giá',
            icon: 'sync_alt',
            description: 'Kéo dữ liệu từ Google Maps vào draft và nối sang công bố.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/operations/crawl',
            label: 'Thu thập đánh giá',
            icon: 'travel_explore',
            description: 'Quản lý source, run, chẩn đoán và đưa dữ liệu vào draft.',
            stage: NOW_STAGE,
          },
        ],
      },
      {
        label: 'Quyền truy cập',
        items: [
          {
            route: '/admin/access/users',
            label: 'Người dùng',
            icon: 'group',
            description: 'Tạo, khóa, đổi role và theo dõi trạng thái tài khoản.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/access/memberships',
            label: 'Thành viên nhà hàng',
            icon: 'badge',
            description: 'Gán user vào nhà hàng và kiểm tra phạm vi hiển thị hai chiều.',
            stage: NOW_STAGE,
          },
        ],
      },
      {
        label: 'Nền tảng',
        items: [
          {
            route: '/admin/platform/health-jobs',
            label: 'Sức khỏe hệ thống',
            icon: 'monitor_heart',
            description: 'Theo dõi API, database, queue, worker và recovery proof.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/platform/integrations-policies',
            label: 'Tích hợp & chính sách',
            icon: 'settings_input_component',
            description: 'Nguồn dữ liệu, chính sách hệ thống và ràng buộc môi trường.',
            stage: NOW_STAGE,
          },
          {
            route: '/admin/platform/audit',
            label: 'Nhật ký kiểm toán',
            icon: 'history',
            description: 'Lịch sử publish, hành động admin và dấu vết hệ thống.',
            stage: NOW_STAGE,
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
          description: 'Restaurant readiness and entry into restaurant-scoped operations.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/intake',
          label: 'Intake',
          icon: 'inventory_2',
          description: 'Batch inbox, curation, and publish flow.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/review-ops',
          label: 'Review sync',
          icon: 'sync_alt',
          description: 'Sync-to-draft and publish bridge.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/operations/crawl',
          label: 'Crawl',
          icon: 'travel_explore',
          description: 'Sources, runs, diagnostics, and materialization.',
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
          description: 'User lifecycle and role administration.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/access/memberships',
          label: 'Memberships',
          icon: 'badge',
          description: 'Restaurant visibility mapping.',
          stage: NOW_STAGE,
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
          description: 'API, worker, queue, and recovery posture.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/platform/integrations-policies',
          label: 'Integrations & policies',
          icon: 'settings_input_component',
          description: 'Runtime constraints and source policy.',
          stage: NOW_STAGE,
        },
        {
          route: '/admin/platform/audit',
          label: 'Audit',
          icon: 'history',
          description: 'System event and publish history.',
          stage: NOW_STAGE,
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
    return isVietnamese(language)
      ? {
          sectionLabel: 'Đăng nhập',
          title: 'Vào đúng không gian theo vai trò',
          description: 'USER vào không gian nhà hàng, ADMIN vào khu điều hành quản trị.',
          stage: NOW_STAGE,
        }
      : {
          sectionLabel: 'Login',
          title: 'Enter the correct workspace for the active role',
          description: 'USER lands in the merchant app. ADMIN lands in the control app.',
          stage: NOW_STAGE,
        }
  }

  if (route === '/signup') {
    return isVietnamese(language)
      ? {
          sectionLabel: 'Đăng ký',
          title: 'Tạo tài khoản Sentify',
          description: 'Bắt đầu với không gian nhà hàng và phạm vi được gán cho tài khoản.',
          stage: NOW_STAGE,
        }
      : {
          sectionLabel: 'Sign up',
          title: 'Create a Sentify account',
          description: 'Start inside the merchant product and assigned scope.',
          stage: NOW_STAGE,
        }
  }

  if (route === '/admin') {
    return isVietnamese(language)
      ? {
          sectionLabel: 'Trung tâm điều hành',
          title: 'Toàn cảnh vận hành, quyền truy cập và hệ thống',
          description: 'ADMIN nhìn ba miền quản trị từ một shell duy nhất: vận hành, quyền truy cập và nền tảng.',
          stage: NOW_STAGE,
        }
      : {
          sectionLabel: 'Command center',
          title: 'Operations, access, and platform in one admin app',
          description: 'ADMIN gets one control product with three domains.',
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

  return isVietnamese(language)
    ? {
        sectionLabel: 'Sentify',
        title: 'Sentify',
        description: 'Không gian sản phẩm theo vai trò.',
        stage: NEXT_STAGE,
      }
    : {
        sectionLabel: 'Sentify',
        title: 'Sentify',
        description: 'Role-based product surface.',
        stage: NEXT_STAGE,
      }
}
