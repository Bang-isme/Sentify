import { lazy, Suspense } from 'react'
import { StatusMessage } from '../../components/product/workspace/shared'
import {
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatReviewDate,
  formatSourcePreview,
} from '../../components/product/workspace/shared-utils'
import type { ProductUiCopy } from '../../content/productUiCopy'
import { getRoleDescriptor } from '../access/restaurantAccess'
import { getMerchantNavigation, getRouteMeta } from '../app-shell/navigation'
import { type AppRoute, type MerchantRoute } from '../app-shell/routes'
import { ShellLayout } from '../app-shell/ShellLayout'
import { useDashboardData } from '../merchant-dashboard/useDashboardData'
import { useReviewEvidence } from '../merchant-reviews/useReviewEvidence'
import type {
  MerchantHubActionCard,
  MerchantHubEvidenceItem,
  MerchantHubHomeHighlight,
  MerchantHubKpiCard,
  MerchantHubReviewFilterChip,
} from '../merchant-hub'
import { useRestaurantDetail } from '../restaurant-scope/useRestaurantDetail'
import type {
  ComplaintKeyword,
  CreateRestaurantInput,
  RestaurantDetail,
  RestaurantMembership,
  ReviewsQuery,
  TrendPeriod,
  UpdateRestaurantInput,
} from '../../lib/api'

const OnboardingPanel = lazy(() =>
  import('../../components/product/workspace/OnboardingPanel').then((module) => ({
    default: module.OnboardingPanel,
  })),
)
const MerchantHubActionsScreen = lazy(() =>
  import('../merchant-hub/MerchantHubActionsScreen').then((module) => ({
    default: module.MerchantHubActionsScreen,
  })),
)
const MerchantHubHomeScreen = lazy(() =>
  import('../merchant-hub/MerchantHubHomeScreen').then((module) => ({
    default: module.MerchantHubHomeScreen,
  })),
)
const MerchantHubReviewsScreen = lazy(() =>
  import('../merchant-hub/MerchantHubReviewsScreen').then((module) => ({
    default: module.MerchantHubReviewsScreen,
  })),
)
const MerchantHubSettingsScreen = lazy(() =>
  import('../merchant-hub/MerchantHubSettingsScreen').then((module) => ({
    default: module.MerchantHubSettingsScreen,
  })),
)

const DEFAULT_REVIEW_FILTERS: ReviewsQuery = {
  page: 1,
  limit: 10,
}

const RECENT_EVIDENCE_FILTERS: ReviewsQuery = {
  page: 1,
  limit: 4,
}

interface MerchantShellProps {
  route: MerchantRoute
  copy: ProductUiCopy['app']
  feedbackCopy: ProductUiCopy['feedback']
  language: string
  restaurants: RestaurantMembership[]
  selectedRestaurantId: string | null
  refreshKey: number
  createPending: boolean
  savePending: boolean
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: AppRoute) => void
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
  onSaveRestaurant: (input: UpdateRestaurantInput) => Promise<void>
  onSessionExpiry: (error: unknown) => boolean
}

function getCurrentRestaurant(
  restaurants: RestaurantMembership[],
  selectedRestaurantId: string | null,
) {
  if (selectedRestaurantId) {
    const selected = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)

    if (selected) {
      return selected
    }
  }

  return restaurants[0] ?? null
}

function getFreshnessState(
  lastPublishedAt: string | null | undefined,
  googleMapUrl: string | null | undefined,
) {
  if (lastPublishedAt) {
    return 'now' as const
  }

  if (googleMapUrl) {
    return 'next' as const
  }

  return 'next' as const
}

function getFreshnessLabel(
  lastPublishedAt: string | null | undefined,
  googleMapUrl: string | null | undefined,
  language: string,
) {
  if (lastPublishedAt) {
    return language.startsWith('vi')
      ? `\u0110\u00e3 c\u1eadp nh\u1eadt ${formatDateTime(lastPublishedAt, language, '\u0047\u1ea7n \u0111\u00e2y')}`
      : `Published ${formatDateTime(lastPublishedAt, language, 'Recently')}`
  }

  if (googleMapUrl) {
    return language.startsWith('vi')
      ? '\u0110\u00e3 l\u01b0u URL ngu\u1ed3n. Ch\u1edd admin \u0111\u1ed3ng b\u1ed9 v\u00e0 publish.'
      : 'Source URL saved. Awaiting admin sync and publish.'
  }

  return language.startsWith('vi') ? '\u0054hi\u1ebfu ngu\u1ed3n d\u1eef li\u1ec7u' : 'Source missing'
}
function getSourceSetupLabel(
  googleMapUrl: string | null | undefined,
  language: string,
) {
  if (googleMapUrl) {
    return language.startsWith('vi') ? '\u0110\u00e3 l\u01b0u URL Google Maps' : 'Google Maps URL on file'
  }

  return language.startsWith('vi') ? '\u0054hi\u1ebfu URL Google Maps' : 'Google Maps URL missing'
}
function getSourceSetupTone(googleMapUrl: string | null | undefined) {
  return googleMapUrl ? ('neutral' as const) : ('warning' as const)
}

function getPriorityTone(keyword: ComplaintKeyword | null) {
  if (!keyword) {
    return 'medium' as const
  }

  if (keyword.percentage >= 22) {
    return 'high' as const
  }

  if (keyword.percentage >= 12) {
    return 'medium' as const
  }

  return 'low' as const
}

function buildKpis(
  copy: ProductUiCopy['app'],
  totalReviews: number,
  averageRating: number,
  negativePercentage: number,
  approvedDraftItemCount: number,
  language: string,
): MerchantHubKpiCard[] {
  const approvedDraftLabel = language.startsWith('vi')
    ? '\u004d\u1ee5c nh\u00e1p \u0111\u00e3 duy\u1ec7t'
    : 'Approved draft items'
  const approvedDraftHint =
    approvedDraftItemCount > 0
      ? language.startsWith('vi')
        ? 'C\u00e1c m\u1ee5c n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c admin duy\u1ec7t trong batch m\u1edf v\u00e0 s\u1ebd ch\u1ec9 xu\u1ea5t hi\u1ec7n cho ch\u1ee7 qu\u00e1n sau l\u1ea7n publish k\u1ebf ti\u1ebfp.'
        : 'These items were approved by admin in open intake batches and will only appear after the next publish.'
      : language.startsWith('vi')
        ? 'Hi\u1ec7n kh\u00f4ng c\u00f3 m\u1ee5c nh\u00e1p \u0111\u00e3 duy\u1ec7t n\u00e0o \u0111ang ch\u1edd publish.'
        : 'There are no approved draft items waiting for the next publish.'

  return [
    {
      label: copy.totalReviews,
      value: formatNumber(totalReviews, language),
      hint: language.startsWith('vi')
        ? 'S\u1ed1 \u0111\u00e1nh gi\u00e1 \u0111\u00e3 \u0111\u01b0\u1ee3c c\u00f4ng b\u1ed1 v\u00e0 \u0111ang d\u00f9ng \u0111\u1ec3 ph\u00e2n t\u00edch.'
        : 'Published evidence available for analysis.',
      tone: 'now',
    },
    {
      label: copy.averageRating,
      value: averageRating > 0 ? averageRating.toFixed(1) : '0.0',
      hint: language.startsWith('vi')
        ? '\u0110i\u1ec3m trung b\u00ecnh c\u1ee7a t\u1eadp \u0111\u00e1nh gi\u00e1 hi\u1ec7n \u0111ang hi\u1ec3n th\u1ecb cho ch\u1ee7 qu\u00e1n.'
        : 'Current average from the published review set.',
      tone: 'now',
    },
    {
      label: copy.negativeShare,
      value: formatPercentage(negativePercentage, language),
      hint: language.startsWith('vi')
        ? 'T\u1ef7 l\u1ec7 \u0111\u00e1nh gi\u00e1 ti\u00eau c\u1ef1c trong t\u1eadp \u0111\u00e1nh gi\u00e1 hi\u1ec7n t\u1ea1i.'
        : 'Share of reviews currently marked negative.',
      tone: negativePercentage >= 30 ? 'next' : 'now',
    },
    {
      label: approvedDraftLabel,
      value: formatNumber(approvedDraftItemCount, language),
      hint: approvedDraftHint,
      tone: approvedDraftItemCount > 0 ? 'next' : 'now',
    },
  ]
}
function buildHighlight(
  complaints: ComplaintKeyword[],
  recentEvidence: MerchantHubEvidenceItem[],
  language: string,
): MerchantHubHomeHighlight | null {
  const topComplaint = complaints[0] ?? null

  if (!topComplaint) {
    return null
  }

  const supportingReview =
    recentEvidence.find((item) => item.content?.toLowerCase().includes(topComplaint.keyword.toLowerCase())) ??
    recentEvidence[0] ??
    null

  return {
    title: language.startsWith('vi')
      ? `?u ti?n x? l?: ${topComplaint.keyword}`
      : `Focus on ${topComplaint.keyword}`,
    description: `${formatPercentage(
      topComplaint.percentage,
      language,
    )} ${
      language.startsWith('vi')
        ? 'ph?n h?i ti?u c?c ?ang nh?c ??n v?n ?? n?y.'
        : 'of complaint-tagged evidence mentions this issue.'
    }`,
    evidence:
      supportingReview?.content ??
      (language.startsWith('vi')
        ? `${formatNumber(topComplaint.count, language)} ??nh gi? ?ang nh?c ??n ${topComplaint.keyword}.`
        : `${formatNumber(topComplaint.count, language)} reviews currently mention ${topComplaint.keyword}.`),
    status: 'now',
    priority: getPriorityTone(topComplaint),
  }
}
function buildRecentEvidence(reviews: MerchantHubEvidenceItem[]) {
  return reviews.slice(0, 4)
}

function buildActionCards(
  complaints: ComplaintKeyword[],
  language: string,
): MerchantHubActionCard[] {
  return complaints.slice(0, 3).map((keyword, index) => ({
    title: language.startsWith('vi')
      ? `${index + 1}. ?n ??nh v?n ?? ${keyword.keyword}`
      : `${index + 1}. Stabilize ${keyword.keyword}`,
    summary: `${formatPercentage(
      keyword.percentage,
      language,
    )} ${
      language.startsWith('vi')
        ? `ph?n h?i ph?n n?n ?ang nh?c ??n ${keyword.keyword}. ??y l? t?n hi?u ?? m?nh ?? x? l? ngay.`
        : `of complaint signals mention ${keyword.keyword}. This is strong enough to act on now.`
    }`,
    evidence: language.startsWith('vi')
      ? `${formatNumber(keyword.count, language)} ??nh gi? ?? duy?t ?ang nh?c ??n ${keyword.keyword}.`
      : `${formatNumber(keyword.count, language)} curated reviews reference ${keyword.keyword}.`,
    nextStep: language.startsWith('vi')
      ? `??c l?i c?m ph?n h?i g?n nh?t v? ${keyword.keyword} v? ch?t b??c x? l? ??u ti?n.`
      : `Review the latest evidence cluster for ${keyword.keyword} and confirm the first operational fix.`,
    status: 'now',
    priority: getPriorityTone(keyword),
  }))
}
function buildReviewFilters(
  detailSource: string | null | undefined,
  query: ReviewsQuery,
  language: string,
): MerchantHubReviewFilterChip[] {
  return [
    {
      label: language.startsWith('vi') ? 'Ngu?n d? li?u' : 'Source',
      value: detailSource
        ? language.startsWith('vi')
          ? '?? l?u URL'
          : 'URL saved'
        : language.startsWith('vi')
          ? 'Thi?u ngu?n'
          : 'Missing',
      status: detailSource ? 'now' : 'next',
    },
    {
      label: language.startsWith('vi') ? '?i?m s?' : 'Rating',
      value: query.rating ?? (language.startsWith('vi') ? 'T?t c? m?c ?i?m' : 'All ratings'),
      status: 'now',
    },
    {
      label: language.startsWith('vi') ? 'Kho?ng th?i gian' : 'Date range',
      value:
        query.from || query.to
          ? `${query.from ?? (language.startsWith('vi') ? 'T? ??u' : 'Start')} - ${query.to ?? (language.startsWith('vi') ? 'Hi?n t?i' : 'Now')}`
          : language.startsWith('vi')
            ? 'To?n b? th?i gian'
            : 'All dates',
      status: 'now',
    },
    {
      label: language.startsWith('vi') ? 'Tra c?u' : 'Search',
      value: language.startsWith('vi') ? 'T?m theo t? kh?a s? c? sau' : 'Keyword search planned',
      status: 'next',
    },
  ]
}
function buildSettingsBlocks(
  copy: ProductUiCopy['app'],
  currentRestaurant: RestaurantMembership | null,
  restaurantDetail: RestaurantDetail | null,
  language: string,
  roleLabel: string,
) {
  const isVietnamese = language.startsWith('vi')
  const detail = restaurantDetail
  return {
    profileBlock: {
      title: isVietnamese ? 'Th?ng tin ?ang hi?n th?' : 'Profile snapshot',
      description: isVietnamese
        ? '?nh ch?p nhanh nh?ng g? ch? qu?n v? ??i v?n h?nh ?ang th?y ? nh? h?ng n?y.'
        : 'The current merchant-visible profile for the selected restaurant.',
      status: 'now' as const,
      items: [
        { label: copy.restaurantNameLabel, value: detail?.name ?? (isVietnamese ? 'Ch?a ch?n nh? h?ng' : 'No restaurant selected') },
        { label: 'Slug', value: detail?.slug ?? (isVietnamese ? 'Ch?a g?n' : 'Unassigned') },
        {
          label: isVietnamese ? '??nh gi? ?ang hi?n th?' : 'Visible reviews',
          value: formatNumber(detail?.insightSummary.totalReviews ?? 0, language),
        },
      ],
    },
    sourceBlock: {
      title: isVietnamese ? 'T?nh tr?ng ngu?n d? li?u' : 'Source status',
      description: isVietnamese
        ? 'Ch? qu?n ch? c?n bi?t ngu?n c? ho?t ??ng ?n kh?ng, kh?ng c?n nh?n chi ti?t ?i?u h?nh n?i b?.'
        : 'The merchant can see source readiness without touching admin diagnostics.',
      status: 'now' as const,
      items: [
        {
          label: copy.googleMapsUrlLabel,
          value: formatSourcePreview(detail?.googleMapUrl ?? null) ?? (isVietnamese ? 'Ch?a c? URL Google Maps' : 'No Google Maps URL'),
        },
        {
          label: isVietnamese ? 'Tr?ng th?i ngu?n' : 'Source policy',
          value: getSourceSetupLabel(currentRestaurant?.googleMapUrl, language),
        },
        {
          label: isVietnamese ? 'L?n c?p nh?t g?n nh?t' : 'Last publish',
          value: detail?.datasetStatus.lastPublishedAt
            ? formatDateTime(
                detail.datasetStatus.lastPublishedAt,
                language,
                isVietnamese ? 'G?n ??y' : 'Recently',
              )
            : isVietnamese
              ? 'Ch? admin publish l? ??u ti?n'
              : 'Awaiting the first admin publish',
        },
      ],
    },
    accessBlock: {
      title: isVietnamese ? 'Gi?i h?n quy?n nh?n th?y' : 'Access boundary',
      description: isVietnamese
        ? 'M?n n?y ch? d?nh cho ch? qu?n, kh?ng hi?n th? t?c v? ?i?u h?nh n?i b?.'
        : 'Merchant settings remain product-facing and do not expose control-plane actions.',
      status: 'now' as const,
      items: [
        { label: isVietnamese ? 'Vai tr?' : 'Role', value: roleLabel },
        { label: isVietnamese ? 'Ph?m vi' : 'Scope', value: isVietnamese ? 'Ch? ch?nh nh? h?ng ?ang ch?n ? ??y.' : 'Only the selected restaurant is editable here.' },
        { label: isVietnamese ? '?i?u khi?n qu?n tr?' : 'Admin controls', value: isVietnamese ? 'Kh?ng hi?n th? trong kh?ng gian nh? h?ng.' : 'Hidden from the merchant shell.' },
      ],
    },
    nextBlock: {
      title: isVietnamese ? 'Ph?n s? m? r?ng sau' : 'Planned next layer',
      description: isVietnamese
        ? 'D?nh ch? cho l?p tr?i nghi?m ti?p theo khi lu?ng v?n h?nh c?a ch? qu?n c?n s?u h?n.'
        : 'Reserved for future workflow polish once merchant execution surfaces grow.',
      status: 'next' as const,
      items: [
        { label: isVietnamese ? 'B? l?c ?? l?u' : 'Saved views', value: isVietnamese ? 'S? c? sau' : 'Planned' },
        { label: isVietnamese ? 'Quy t?c c?nh b?o' : 'Alert rules', value: isVietnamese ? 'S? c? sau' : 'Planned' },
        { label: isVietnamese ? 'Theo d?i vi?c x? l?' : 'Action follow-up', value: isVietnamese ? 'S? c? sau' : 'Planned' },
      ],
    },
  }
}

export function MerchantShell({
  route,
  copy,
  feedbackCopy,
  language,
  restaurants,
  selectedRestaurantId,
  refreshKey,
  createPending,
  savePending,
  onSelectRestaurant,
  onNavigate,
  onCreateRestaurant,
  onSaveRestaurant,
  onSessionExpiry,
}: MerchantShellProps) {
  const trendPeriod: TrendPeriod = 'week'
  const reviewFilters: ReviewsQuery = DEFAULT_REVIEW_FILTERS
  const hasRestaurants = restaurants.length > 0
  const currentRestaurant = getCurrentRestaurant(restaurants, selectedRestaurantId)
  const selectedRestaurant = currentRestaurant?.id ?? null
  const roleDescriptor = getRoleDescriptor('USER', language)
  const routeMeta = getRouteMeta(route, language)

  const restaurantDetail = useRestaurantDetail({
    enabled: hasRestaurants,
    restaurantId: selectedRestaurant,
    refreshKey,
    fallbackMessage: feedbackCopy.errors.loadRestaurant,
    onSessionExpiry,
  })

  const dashboard = useDashboardData({
    enabled: hasRestaurants && (route === '/app' || route === '/app/actions'),
    restaurantId: selectedRestaurant,
    refreshKey,
    trendPeriod,
    fallbackMessage: feedbackCopy.errors.loadDashboard,
    onSessionExpiry,
  })

  const reviews = useReviewEvidence({
    enabled: hasRestaurants && route === '/app/reviews',
    restaurantId: selectedRestaurant,
    refreshKey,
    query: reviewFilters,
    fallbackMessage: feedbackCopy.errors.loadReviews,
    onSessionExpiry,
  })

  const recentEvidence = useReviewEvidence({
    enabled: hasRestaurants && (route === '/app' || route === '/app/actions'),
    restaurantId: selectedRestaurant,
    refreshKey,
    query: RECENT_EVIDENCE_FILTERS,
    fallbackMessage: feedbackCopy.errors.loadReviews,
    onSessionExpiry,
  })

  const detail = restaurantDetail.detail
  const kpiSummary = dashboard.dashboard.kpi ?? detail?.insightSummary ?? null
  const totalReviews = kpiSummary?.totalReviews ?? 0
  const averageRating = kpiSummary?.averageRating ?? 0
  const negativePercentage = kpiSummary?.negativePercentage ?? 0
  const freshnessStatus = getFreshnessState(detail?.datasetStatus.lastPublishedAt, detail?.googleMapUrl)
  const freshnessLabel = getFreshnessLabel(
    detail?.datasetStatus.lastPublishedAt,
    detail?.googleMapUrl,
    language,
  )

  const recentEvidenceItems: MerchantHubEvidenceItem[] = (recentEvidence.reviews?.data ?? []).map((item) => ({
    id: item.id,
    rating: item.rating,
    content: item.content,
    sentiment: item.sentiment,
    authorName: item.authorName ?? copy.anonymousGuest,
    reviewDateLabel: formatReviewDate(item.reviewDate, language, copy.noSourceDate),
  }))

  const actionCards = buildActionCards(dashboard.dashboard.complaints, language)
  const topIssue = dashboard.dashboard.complaints[0]?.keyword ?? ''
  const settingsBlocks = buildSettingsBlocks(copy, currentRestaurant, detail, language, roleDescriptor.label)
  const defaultNextAction = topIssue
    ? language.startsWith('vi')
      ? `Xem l?i ph?n h?i v? ${topIssue}`
      : `Review ${topIssue}`
    : detail?.datasetStatus.lastPublishedAt
      ? language.startsWith('vi')
        ? 'M? b?ng ch?ng m?i nh?t ?? ch?t ?u ti?n k? ti?p'
        : 'Open the latest evidence to confirm the next priority'
      : detail?.googleMapUrl
        ? language.startsWith('vi')
          ? 'Ch? admin ??ng b? v? publish l? ??u ti?n'
          : 'Wait for admin to sync and publish the first batch'
        : language.startsWith('vi')
          ? 'L?u URL Google Maps ?? kh?i ??ng pipeline'
          : 'Save a Google Maps URL to start the pipeline'

  const badges = [
    {
      label: getSourceSetupLabel(detail?.googleMapUrl, language),
      tone: getSourceSetupTone(detail?.googleMapUrl),
    },
    {
      label: language.startsWith('vi')
        ? `${formatNumber(totalReviews, language)} ??nh gi?`
        : `${formatNumber(totalReviews, language)} reviews`,
      tone: 'neutral' as const,
    },
    {
      label:
        (detail?.datasetStatus.approvedItemCount ?? 0) > 0
          ? language.startsWith('vi')
            ? `${formatNumber(detail?.datasetStatus.approvedItemCount ?? 0, language)} m?c nh?p ?? duy?t ch?a publish`
            : `${formatNumber(detail?.datasetStatus.approvedItemCount ?? 0, language)} approved draft items awaiting publish`
          : language.startsWith('vi')
            ? 'Kh?ng c? m?c nh?p ?? duy?t ?ang ch? publish'
            : 'No approved draft items awaiting publish',
      tone: detail?.datasetStatus.approvedItemCount ? ('warning' as const) : ('neutral' as const),
    },
  ]

  const contextSlot = (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {language.startsWith('vi') ? 'Ng? c?nh nh? h?ng' : 'Merchant context'}
      </div>
      <div className="text-[18px] font-semibold text-white">
        {currentRestaurant?.name ?? (language.startsWith('vi') ? 'T?o nh? h?ng ??u ti?n' : 'Create your first restaurant')}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {language.startsWith('vi') ? 'D? li?u' : 'Dataset'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">{freshnessLabel}</div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {language.startsWith('vi') ? 'Vi?c n?n l?m ti?p' : 'Next action'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">{defaultNextAction}</div>
        </div>
      </div>
    </div>
  )

  const sidebarFooter = hasRestaurants ? (
    <div className="space-y-3">
      <label className="grid gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {copy.restaurantSwitcherLabel}
        </span>
        <select
          aria-label={copy.restaurantSwitcherLabel}
          value={selectedRestaurant ?? ''}
          onChange={(event) => onSelectRestaurant(event.target.value)}
          className="h-11 border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none transition focus:border-emerald-400/30"
        >
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id} className="bg-[#10161b] text-white">
              {restaurant.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 text-[12px] text-slate-300">
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
          {detail?.address ?? (language.startsWith('vi') ? 'Ch?a c? ??a ch?.' : 'No address on file.')}
        </div>
        <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
          {getSourceSetupLabel(detail?.googleMapUrl, language)}
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-2 text-[12px] leading-6 text-slate-400">
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {language.startsWith('vi')
          ? 'T?o nh? h?ng ??u ti?n ?? m? kh?a T?ng quan, ??nh gi?, Vi?c c?n l?m v? Thi?t l?p.'
          : 'Create the first restaurant to unlock reviews, actions, and settings.'}
      </div>
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {language.startsWith('vi')
          ? 'Kh?ng gian nh? h?ng ch? t?p trung v?o g?c nh?n c?a ch? qu?n, kh?ng hi?n th? ch?n ?o?n qu?n tr?.'
          : 'The merchant shell stays focused on insight and action, not admin diagnostics.'}
      </div>
    </div>
  )

  let content

  if (!hasRestaurants) {
    content = (
      <div className="grid gap-4">
        {restaurantDetail.error ? <StatusMessage tone="error">{restaurantDetail.error}</StatusMessage> : null}
        <OnboardingPanel
          copy={copy}
          createPending={createPending}
          onCreateRestaurant={onCreateRestaurant}
        />
      </div>
    )
  } else if (route === '/app/reviews') {
    content = (
      <MerchantHubReviewsScreen
        language={language}
        restaurant={currentRestaurant}
        detail={detail}
        query={reviewFilters}
        reviewCount={detail?.insightSummary.totalReviews ?? 0}
        filters={buildReviewFilters(detail?.googleMapUrl, reviewFilters, language)}
        reviews={reviews.reviews}
        searchLabel={language.startsWith('vi') ? 'Tra c?u ??nh gi?' : 'Search reviews'}
        searchHint={
          language.startsWith('vi')
            ? 'Tìm theo từ khóa sẽ được bổ sung sau. Hiện tại hãy dùng bộ lọc điểm và thời gian.'
            : 'Keyword search is reserved as the next merchant evidence layer.'
        }
        searchStatus="next"
        onNavigateToActions={() => onNavigate('/app/actions')}
        onNavigateToSettings={() => onNavigate('/app/settings')}
      />
    )
  } else if (route === '/app/actions') {
    content = (
      <MerchantHubActionsScreen
        language={language}
        restaurant={currentRestaurant}
        detail={detail}
        topIssue={topIssue}
        actionCards={actionCards}
        nowSummary={
          actionCards.length > 0
            ? language.startsWith('vi')
              ? 'Đã có đủ bằng chứng để ưu tiên xử lý.'
              : 'Evidence-backed priorities are ready now.'
            : language.startsWith('vi')
              ? 'Chưa đủ dữ liệu để chốt ưu tiên.'
              : 'Awaiting stronger evidence.'
        }
        nextSummary={
          language.startsWith('vi')
            ? 'Giao việc, nhắc việc và theo dõi tiến độ sẽ nằm ở lớp vận hành tiếp theo.'
            : 'Assignments, reminders, and action tracking stay reserved for the next execution layer.'
        }
        onNavigateToReviews={() => onNavigate('/app/reviews')}
        onNavigateToSettings={() => onNavigate('/app/settings')}
      />
    )
  } else if (route === '/app/settings') {
    content = (
      <MerchantHubSettingsScreen
        language={language}
        restaurant={currentRestaurant}
        detail={detail}
        pending={savePending}
        profileBlock={settingsBlocks.profileBlock}
        sourceBlock={settingsBlocks.sourceBlock}
        accessBlock={settingsBlocks.accessBlock}
        nextBlock={settingsBlocks.nextBlock}
        restaurantNameLabel={copy.restaurantNameLabel}
        restaurantAddressLabel={copy.restaurantAddressLabel}
        googleMapsUrlLabel={copy.googleMapsUrlLabel}
        googleMapsUrlPlaceholder={copy.googleMapsUrlPlaceholder}
        saveLabel={copy.saveChanges}
        savingLabel={copy.saving}
        validation={copy.validation}
        onSaveProfile={(input) => onSaveRestaurant(input)}
        onSaveSource={(input) => onSaveRestaurant(input)}
        onNavigateToReviews={() => onNavigate('/app/reviews')}
        onNavigateToActions={() => onNavigate('/app/actions')}
      />
    )
  } else {
    content = (
      <MerchantHubHomeScreen
        language={language}
        restaurant={currentRestaurant}
        detail={detail}
        freshnessLabel={freshnessLabel}
        freshnessStatus={freshnessStatus}
        kpis={buildKpis(
          copy,
          totalReviews,
          averageRating,
          negativePercentage,
          detail?.datasetStatus.approvedItemCount ?? 0,
          language,
        )}
        sentiment={dashboard.dashboard.sentiment}
        complaintKeywords={dashboard.dashboard.complaints}
        trend={dashboard.dashboard.trend}
        highlight={buildHighlight(
          dashboard.dashboard.complaints,
          buildRecentEvidence(recentEvidenceItems),
          language,
        )}
        recentEvidence={buildRecentEvidence(recentEvidenceItems)}
        onNavigateToReviews={() => onNavigate('/app/reviews')}
        onNavigateToActions={() => onNavigate('/app/actions')}
        onNavigateToSettings={() => onNavigate('/app/settings')}
      />
    )
  }
  const routeScreenFallback = (
    <StatusMessage>{language.startsWith('vi') ? 'Đang tải màn làm việc...' : 'Loading workspace...'}</StatusMessage>
  )

  return (
    <ShellLayout
      mode="merchant"
      route={route}
      language={language}
      sectionLabel={routeMeta.sectionLabel}
      title={routeMeta.title}
      description={routeMeta.description}
      stage={routeMeta.stage}
      navGroups={getMerchantNavigation(language)}
      badges={badges}
      contextSlot={contextSlot}
      sidebarFooter={sidebarFooter}
      onNavigate={onNavigate}
    >
      {restaurantDetail.error ? <StatusMessage tone="error">{restaurantDetail.error}</StatusMessage> : null}
      {dashboard.error && route !== '/app/settings' ? <StatusMessage tone="error">{dashboard.error}</StatusMessage> : null}
      {reviews.error && route === '/app/reviews' ? <StatusMessage tone="error">{reviews.error}</StatusMessage> : null}
      {recentEvidence.error && route !== '/app/reviews' ? (
        <StatusMessage tone="error">{recentEvidence.error}</StatusMessage>
      ) : null}
      {(restaurantDetail.loading ||
        dashboard.loading ||
        reviews.loading ||
        recentEvidence.loading) &&
      hasRestaurants ? (
        <StatusMessage>{copy.loadingRestaurant}</StatusMessage>
      ) : null}
      <Suspense fallback={routeScreenFallback}>{content}</Suspense>
    </ShellLayout>
  )
}

