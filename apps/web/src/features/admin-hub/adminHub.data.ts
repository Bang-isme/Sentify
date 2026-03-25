export type AdminHubStatus = 'Hiện có' | 'Kế hoạch'

export type AdminHubDomainKey = 'operations' | 'access' | 'platform'

export type AdminHubViewKey =
  | 'home'
  | 'operations-restaurants'
  | 'operations-intake'
  | 'operations-review-ops'
  | 'operations-crawl'
  | 'access-users'
  | 'access-memberships'
  | 'platform-health-jobs'
  | 'platform-integrations-policies'
  | 'platform-audit'

export interface AdminHubScreen {
  key: AdminHubViewKey
  label: string
  status: AdminHubStatus
  summary: string
  proof: string
  capabilities: string[]
  endpointHint: string
  icon: string
}

export interface AdminHubDomain {
  key: AdminHubDomainKey
  label: string
  eyebrow: string
  summary: string
  icon: string
  screens: AdminHubScreen[]
}

export const adminHubViewOrder: AdminHubViewKey[] = [
  'home',
  'operations-restaurants',
  'operations-intake',
  'operations-review-ops',
  'operations-crawl',
  'access-users',
  'access-memberships',
  'platform-health-jobs',
  'platform-integrations-policies',
  'platform-audit',
]

export const adminHubDomains: Record<AdminHubDomainKey, AdminHubDomain> = {
  operations: {
    key: 'operations',
    label: 'Vận hành',
    eyebrow: 'Theo nhà hàng',
    summary:
      'Đi theo vòng đời dữ liệu review của từng nhà hàng: kiểm tra trạng thái, nhập liệu, đồng bộ và điều hành thu thập.',
    icon: 'cases',
    screens: [
      {
        key: 'operations-restaurants',
        label: 'Nhà hàng',
        status: 'Hiện có',
        summary: 'Danh sách nhà hàng, mức sẵn sàng và lối vào các thao tác vận hành theo từng quán.',
        proof: 'Được cấp dữ liệu bởi /api/admin/restaurants và /api/admin/restaurants/:id.',
        capabilities: ['Tìm nhà hàng', 'Xem trạng thái', 'Mở theo từng quán'],
        endpointHint: 'Đây là cửa vào chính cho mọi luồng vận hành theo nhà hàng.',
        icon: 'storefront',
      },
      {
        key: 'operations-intake',
        label: 'Nhập liệu',
        status: 'Hiện có',
        summary: 'Tạo lô review, duyệt nhanh, loại bỏ và công bố dữ liệu chuẩn.',
        proof: 'Đã nối với backend intake thật.',
        capabilities: ['Tạo lô', 'Duyệt nhanh', 'Công bố dữ liệu'],
        endpointHint: 'Phù hợp khi nguồn ngoài chưa đủ hoặc cần nhập review thủ công.',
        icon: 'inventory_2',
      },
      {
        key: 'operations-review-ops',
        label: 'Đồng bộ đánh giá',
        status: 'Hiện có',
        summary: 'Đẩy dữ liệu Google Maps sang draft, duyệt và nối sang công bố.',
        proof: 'Đã nối với review ops service và batch readiness thật.',
        capabilities: ['Sync vào draft', 'Kiểm tra readiness', 'Công bố batch'],
        endpointHint: 'Dùng khi admin muốn chuyển từ URL nguồn sang draft để duyệt.',
        icon: 'sync_alt',
      },
      {
        key: 'operations-crawl',
        label: 'Thu thập đánh giá',
        status: 'Hiện có',
        summary: 'Quản lý source, run, chẩn đoán và materialize vào draft.',
        proof: 'Đã nối với review crawl endpoints và worker runtime.',
        capabilities: ['Source', 'Run', 'Chẩn đoán', 'Materialize'],
        endpointHint: 'Dùng khi cần xem chi tiết engine thu thập phía sau review ops.',
        icon: 'travel_explore',
      },
    ],
  },
  access: {
    key: 'access',
    label: 'Quyền truy cập',
    eyebrow: 'Toàn cục',
    summary:
      'Quản trị danh tính và khả năng nhìn thấy nhà hàng. Đây là phần admin dùng để kiểm soát ai được vào đâu.',
    icon: 'manage_accounts',
    screens: [
      {
        key: 'access-users',
        label: 'Người dùng',
        status: 'Hiện có',
        summary: 'Danh sách tài khoản, vai trò USER hoặc ADMIN, khóa/mở khóa và reset mật khẩu.',
        proof: 'Đã nối với admin access endpoints và lifecycle actions.',
        capabilities: ['Tạo user', 'Đổi role', 'Khóa/mở khóa', 'Reset mật khẩu'],
        endpointHint: 'Mọi thay đổi vai trò đều đi qua admin access, không đi qua merchant UI.',
        icon: 'group',
      },
      {
        key: 'access-memberships',
        label: 'Thành viên nhà hàng',
        status: 'Hiện có',
        summary: 'Gán USER vào nhà hàng và xem phạm vi hiển thị theo cả hai chiều.',
        proof: 'Đã nối với admin memberships endpoints.',
        capabilities: ['Gán user', 'Gỡ user', 'Xem theo user', 'Xem theo nhà hàng'],
        endpointHint: 'Giải thích vì sao một USER nhìn thấy hoặc không nhìn thấy một nhà hàng.',
        icon: 'badge',
      },
    ],
  },
  platform: {
    key: 'platform',
    label: 'Nền tảng',
    eyebrow: 'Hệ thống',
    summary:
      'Theo dõi sức khỏe hệ thống, chính sách mặc định, môi trường và nhật ký kiểm toán để hiểu ứng dụng vận hành ra sao.',
    icon: 'hub',
    screens: [
      {
        key: 'platform-health-jobs',
        label: 'Sức khỏe hệ thống',
        status: 'Hiện có',
        summary: 'API, database, queue, worker và các bằng chứng recovery.',
        proof: 'Đã nối với /api/admin/platform/health-jobs.',
        capabilities: ['Health', 'Jobs', 'Recovery proof'],
        endpointHint: 'Đây là màn đầu tiên khi cần giải thích lỗi vận hành hoặc queue.',
        icon: 'monitor_heart',
      },
      {
        key: 'platform-integrations-policies',
        label: 'Tích hợp & chính sách',
        status: 'Hiện có',
        summary: 'Vai trò hệ thống, route boundary, nguồn dữ liệu, policy và ràng buộc môi trường.',
        proof: 'Đã nối với /api/admin/platform/integrations-policies.',
        capabilities: ['Role model', 'Source policy', 'Environment constraints'],
        endpointHint: 'Giải thích hợp đồng BE để FE không mô tả sai hệ thống.',
        icon: 'policy',
      },
      {
        key: 'platform-audit',
        label: 'Nhật ký kiểm toán',
        status: 'Hiện có',
        summary: 'Lịch sử publish, hành động admin, ingest và sự kiện hệ thống.',
        proof: 'Đã nối với /api/admin/platform/audit.',
        capabilities: ['Event log', 'Publish history', 'System trail'],
        endpointHint: 'Dùng để truy vết ai đã làm gì và lúc nào.',
        icon: 'history',
      },
    ],
  },
}

export const adminHubHomeStats = [
  { label: 'Màn hiện có', value: '9' },
  { label: 'Màn kế hoạch', value: '0' },
  { label: 'Miền quản trị', value: '3' },
]

export function getAdminHubDomainFromView(view: AdminHubViewKey): AdminHubDomainKey {
  if (view.startsWith('access-')) {
    return 'access'
  }

  if (view.startsWith('platform-')) {
    return 'platform'
  }

  return 'operations'
}

export function getAdminHubScreen(view: AdminHubViewKey): AdminHubScreen | null {
  if (view === 'home') {
    return null
  }

  const domainKey = getAdminHubDomainFromView(view)
  return adminHubDomains[domainKey].screens.find((screen) => screen.key === view) ?? null
}
