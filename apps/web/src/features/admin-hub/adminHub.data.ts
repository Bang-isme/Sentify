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
    eyebrow: 'Planned backend surfaces',
    summary:
      'User and membership administration for the control plane. These screens are part of the target-state wireframe and need backend expansion.',
    icon: 'manage_accounts',
    screens: [
      {
        key: 'access-users',
        label: 'Users',
        status: 'Next',
        summary: 'User directory, detail, role assignment, and account reset actions.',
        proof: 'Requires new admin user endpoints.',
        capabilities: [
          'List users',
          'View user detail',
          'Assign USER / ADMIN',
          'Deactivate or reset access',
        ],
        endpointHint: 'Add /api/admin/users and related detail and mutation endpoints.',
        icon: 'group',
      },
      {
        key: 'access-memberships',
        label: 'Memberships',
        status: 'Next',
        summary: 'Assign USER accounts to restaurants and inspect membership graphs.',
        proof: 'Requires membership management endpoints.',
        capabilities: [
          'Add or remove restaurant membership',
          'Inspect by user',
          'Inspect by restaurant',
        ],
        endpointHint: 'Add /api/admin/memberships read/write endpoints.',
        icon: 'badge',
      },
    ],
  },
  platform: {
    key: 'platform',
    label: 'Platform',
    eyebrow: 'Planned system surfaces',
    summary:
      'System health, policies, integrations, and audit history. These screens define the wider admin command center.',
    icon: 'hub',
    screens: [
      {
        key: 'platform-health-jobs',
        label: 'Health & jobs',
        status: 'Next',
        summary: 'Backend health, worker state, queue state, and recovery readiness.',
        proof: 'Requires aggregated platform health endpoints.',
        capabilities: ['Service health', 'Worker status', 'Queue state', 'Recovery signals'],
        endpointHint: 'Add platform health summary endpoints and job visibility.',
        icon: 'monitor_heart',
      },
      {
        key: 'platform-integrations-policies',
        label: 'Integrations & policies',
        status: 'Next',
        summary: 'Source policy overview, integration readiness, and environment constraints.',
        proof: 'Requires read models for policies and integrations.',
        capabilities: ['Policy overview', 'Integration readiness', 'Environment constraints'],
        endpointHint: 'Expose policy and config read models before enabling edits.',
        icon: 'policy',
      },
      {
        key: 'platform-audit',
        label: 'Audit',
        status: 'Next',
        summary: 'Operator actions, publish history, ingestion history, and rollback drills.',
        proof: 'Requires an admin audit feed.',
        capabilities: ['Operator log', 'Publish history', 'Ingestion history', 'Recovery drill history'],
        endpointHint: 'Add a platform audit stream before this screen becomes live.',
        icon: 'history',
      },
    ],
  },
}

export const adminHubHomeStats = [
  { label: 'Now screens', value: '4' },
  { label: 'Next screens', value: '5' },
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
