export type AdminHubStatus = 'Now' | 'Next'

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
    label: 'Operations',
    eyebrow: 'Live backend surfaces',
    summary:
      'Restaurant-specific command flow for discovery, intake, review operations, and crawl runtime.',
    icon: 'cases',
    screens: [
      {
        key: 'operations-restaurants',
        label: 'Restaurants',
        status: 'Now',
        summary: 'Admin-owned restaurant directory and control-room entry point.',
        proof: 'Backed by /api/admin/restaurants and /api/admin/restaurants/:id.',
        capabilities: [
          'Restaurant discovery',
          'Status summary',
          'Operational context before deeper work',
        ],
        endpointHint: 'Current backend overview endpoints already expose this domain.',
        icon: 'storefront',
      },
      {
        key: 'operations-intake',
        label: 'Intake',
        status: 'Now',
        summary: 'Batch inbox, curation table, approval, rejection, and publish summary.',
        proof: 'Backed by current admin intake endpoints.',
        capabilities: ['Batch inbox', 'Curation flow', 'Approve / reject / publish'],
        endpointHint: 'Existing intake routes and curation flow are already live.',
        icon: 'inventory_2',
      },
      {
        key: 'operations-review-ops',
        label: 'Review ops',
        status: 'Now',
        summary: 'Sync-to-draft orchestration with run readiness and publish bridge.',
        proof: 'Backed by current review ops endpoints.',
        capabilities: ['Sync orchestration', 'Draft readiness', 'Publish bridge'],
        endpointHint: 'Current review-ops API already supports the production operator flow.',
        icon: 'sync_alt',
      },
      {
        key: 'operations-crawl',
        label: 'Crawl',
        status: 'Now',
        summary: 'Source settings, run lifecycle, diagnostics, resume, cancel, and materialize.',
        proof: 'Backed by current review crawl endpoints and worker runtime.',
        capabilities: ['Source controls', 'Queue / run diagnostics', 'Resume / cancel / materialize'],
        endpointHint: 'Crawl runtime already has a live backend implementation.',
        icon: 'travel_explore',
      },
    ],
  },
  access: {
    key: 'access',
    label: 'Access',
    eyebrow: 'Live backend surfaces',
    summary:
      'User and membership administration for the control plane, backed by dedicated admin access endpoints.',
    icon: 'manage_accounts',
    screens: [
      {
        key: 'access-users',
        label: 'Users',
        status: 'Now',
        summary: 'User directory, detail, role assignment, and account reset actions.',
        proof: 'Backed by /api/admin/users, detail, role mutation, and password reset trigger.',
        capabilities: [
          'List users',
          'View user detail',
          'Assign USER / ADMIN',
          'Trigger password reset',
        ],
        endpointHint: 'Use admin access endpoints instead of merchant routes to manage identity.',
        icon: 'group',
      },
      {
        key: 'access-memberships',
        label: 'Memberships',
        status: 'Now',
        summary: 'Assign USER accounts to restaurants and inspect membership graphs.',
        proof: 'Backed by /api/admin/memberships read, create, and delete endpoints.',
        capabilities: [
          'Add or remove restaurant membership',
          'Inspect by user',
          'Inspect by restaurant',
        ],
        endpointHint: 'Treat memberships as a global admin concern, not a merchant-side mutation.',
        icon: 'badge',
      },
    ],
  },
  platform: {
    key: 'platform',
    label: 'Platform',
    eyebrow: 'Live backend surfaces',
    summary:
      'System health, policy, integrations, and audit history for the wider admin command center.',
    icon: 'hub',
    screens: [
      {
        key: 'platform-health-jobs',
        label: 'Health & jobs',
        status: 'Now',
        summary: 'Backend health, worker state, queue state, and recovery readiness.',
        proof: 'Backed by /api/admin/platform/health-jobs.',
        capabilities: ['Service health', 'Worker status', 'Queue state', 'Recovery signals'],
        endpointHint: 'Expose job posture and recovery proof directly from the admin platform service.',
        icon: 'monitor_heart',
      },
      {
        key: 'platform-integrations-policies',
        label: 'Integrations & policies',
        status: 'Now',
        summary: 'Source policy overview, integration readiness, and environment constraints.',
        proof: 'Backed by /api/admin/platform/integrations-policies.',
        capabilities: ['Policy overview', 'Integration readiness', 'Environment constraints'],
        endpointHint: 'Use the platform read model to explain route boundaries and integration defaults.',
        icon: 'policy',
      },
      {
        key: 'platform-audit',
        label: 'Audit',
        status: 'Now',
        summary: 'Operator actions, publish history, ingestion history, and rollback drills.',
        proof: 'Backed by /api/admin/platform/audit.',
        capabilities: ['Operator log', 'Publish history', 'Ingestion history', 'Recovery drill history'],
        endpointHint: 'Use the audit stream to explain which backend events already exist and how FE should surface them.',
        icon: 'history',
      },
    ],
  },
}

export const adminHubHomeStats = [
  { label: 'Now screens', value: '9' },
  { label: 'Next screens', value: '0' },
  { label: 'Domains', value: '3' },
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
