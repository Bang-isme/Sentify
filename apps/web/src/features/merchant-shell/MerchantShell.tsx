import { OnboardingPanel } from '../../components/product/workspace/OnboardingPanel'
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
import {
  MerchantHubActionsScreen,
  MerchantHubHomeScreen,
  MerchantHubReviewsScreen,
  MerchantHubSettingsScreen,
  type MerchantHubActionCard,
  type MerchantHubEvidenceItem,
  type MerchantHubHomeHighlight,
  type MerchantHubKpiCard,
  type MerchantHubReviewFilterChip,
} from '../merchant-hub'
import { useRestaurantDetail } from '../restaurant-scope/useRestaurantDetail'
import type {
  ComplaintKeyword,
  CreateRestaurantInput,
  RestaurantMembership,
  ReviewsQuery,
  TrendPeriod,
  UpdateRestaurantInput,
} from '../../lib/api'

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
  if (lastPublishedAt || googleMapUrl) {
    return 'now' as const
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
      ? `Đã cập nhật ${formatDateTime(lastPublishedAt, language, 'Gần đây')}`
      : `Published ${formatDateTime(lastPublishedAt, language, 'Recently')}`
  }

  if (googleMapUrl) {
    return language.startsWith('vi') ? 'Đã kết nối nguồn' : 'Source connected'
  }

  return language.startsWith('vi') ? 'Thiếu nguồn dữ liệu' : 'Source missing'
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
  approvedItemCount: number,
  language: string,
): MerchantHubKpiCard[] {
  return [
    {
      label: copy.totalReviews,
      value: formatNumber(totalReviews, language),
      hint: language.startsWith('vi')
        ? 'Số đánh giá đã được công bố và đang dùng để phân tích.'
        : 'Published evidence available for analysis.',
      tone: 'now',
    },
    {
      label: copy.averageRating,
      value: averageRating > 0 ? averageRating.toFixed(1) : '0.0',
      hint: language.startsWith('vi')
        ? 'Điểm trung bình của tập đánh giá hiện đang hiển thị cho chủ quán.'
        : 'Current average from the published review set.',
      tone: 'now',
    },
    {
      label: copy.negativeShare,
      value: formatPercentage(negativePercentage, language),
      hint: language.startsWith('vi')
        ? 'Tỷ lệ đánh giá tiêu cực trong tập đánh giá hiện tại.'
        : 'Share of reviews currently marked negative.',
      tone: negativePercentage >= 30 ? 'next' : 'now',
    },
    {
      label: language.startsWith('vi') ? 'Mục đã duyệt' : 'Approved evidence',
      value: formatNumber(approvedItemCount, language),
      hint: language.startsWith('vi')
        ? 'Số mục đã được duyệt và hiển thị trong dữ liệu của nhà hàng.'
        : 'Items approved into the current merchant-visible dataset.',
      tone: approvedItemCount > 0 ? 'now' : 'next',
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
      ? `Ưu tiên xử lý: ${topComplaint.keyword}`
      : `Focus on ${topComplaint.keyword}`,
    description: `${formatPercentage(
      topComplaint.percentage,
      language,
    )} ${
      language.startsWith('vi')
        ? 'phản hồi tiêu cực đang nhắc đến vấn đề này.'
        : 'of complaint-tagged evidence mentions this issue.'
    }`,
    evidence:
      supportingReview?.content ??
      (language.startsWith('vi')
        ? `${formatNumber(topComplaint.count, language)} đánh giá đang nhắc đến ${topComplaint.keyword}.`
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
      ? `${index + 1}. Ổn định vấn đề ${keyword.keyword}`
      : `${index + 1}. Stabilize ${keyword.keyword}`,
    summary: `${formatPercentage(
      keyword.percentage,
      language,
    )} ${
      language.startsWith('vi')
        ? `phản hồi phàn nàn đang nhắc đến ${keyword.keyword}. Đây là tín hiệu đủ mạnh để xử lý ngay.`
        : `of complaint signals mention ${keyword.keyword}. This is strong enough to act on now.`
    }`,
    evidence: language.startsWith('vi')
      ? `${formatNumber(keyword.count, language)} đánh giá đã duyệt đang nhắc đến ${keyword.keyword}.`
      : `${formatNumber(keyword.count, language)} curated reviews reference ${keyword.keyword}.`,
    nextStep: language.startsWith('vi')
      ? `Đọc lại cụm phản hồi gần nhất về ${keyword.keyword} và chốt bước xử lý đầu tiên.`
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
      label: language.startsWith('vi') ? 'Nguồn dữ liệu' : 'Source',
      value: detailSource
        ? language.startsWith('vi')
          ? 'Đã kết nối'
          : 'Connected'
        : language.startsWith('vi')
          ? 'Thiếu nguồn'
          : 'Missing',
      status: detailSource ? 'now' : 'next',
    },
    {
      label: language.startsWith('vi') ? 'Điểm số' : 'Rating',
      value: query.rating ?? (language.startsWith('vi') ? 'Tất cả mức điểm' : 'All ratings'),
      status: 'now',
    },
    {
      label: language.startsWith('vi') ? 'Khoảng thời gian' : 'Date range',
      value:
        query.from || query.to
          ? `${query.from ?? (language.startsWith('vi') ? 'Từ đầu' : 'Start')} - ${query.to ?? (language.startsWith('vi') ? 'Hiện tại' : 'Now')}`
          : language.startsWith('vi')
            ? 'Toàn bộ thời gian'
            : 'All dates',
      status: 'now',
    },
    {
      label: language.startsWith('vi') ? 'Tra cứu' : 'Search',
      value: language.startsWith('vi') ? 'Tìm theo từ khóa sẽ có sau' : 'Keyword search planned',
      status: 'next',
    },
  ]
}

function buildSettingsBlocks(
  copy: ProductUiCopy['app'],
  currentRestaurant: RestaurantMembership | null,
  language: string,
  roleLabel: string,
) {
  const isVietnamese = language.startsWith('vi')
  const detail = currentRestaurant
  return {
    profileBlock: {
      title: isVietnamese ? 'Thông tin đang hiển thị' : 'Profile snapshot',
      description: isVietnamese
        ? 'Ảnh chụp nhanh những gì chủ quán và đội vận hành đang thấy ở nhà hàng này.'
        : 'The current merchant-visible profile for the selected restaurant.',
      status: 'now' as const,
      items: [
        { label: copy.restaurantNameLabel, value: detail?.name ?? (isVietnamese ? 'Chưa chọn nhà hàng' : 'No restaurant selected') },
        { label: 'Slug', value: detail?.slug ?? (isVietnamese ? 'Chưa gán' : 'Unassigned') },
        { label: isVietnamese ? 'Đánh giá đang hiển thị' : 'Visible reviews', value: formatNumber(detail?.totalReviews ?? 0, language) },
      ],
    },
    sourceBlock: {
      title: isVietnamese ? 'Tình trạng nguồn dữ liệu' : 'Source status',
      description: isVietnamese
        ? 'Chủ quán chỉ cần biết nguồn có hoạt động ổn không, không cần nhìn chi tiết điều hành nội bộ.'
        : 'The merchant can see source readiness without touching admin diagnostics.',
      status: 'now' as const,
      items: [
        {
          label: copy.googleMapsUrlLabel,
          value: formatSourcePreview(detail?.googleMapUrl ?? null) ?? (isVietnamese ? 'Chưa có URL Google Maps' : 'No Google Maps URL'),
        },
        {
          label: isVietnamese ? 'Trạng thái nguồn' : 'Source policy',
          value: currentRestaurant?.googleMapUrl
            ? isVietnamese
              ? 'Đã kết nối'
              : 'Connected source'
            : isVietnamese
              ? 'Cần cấu hình'
              : 'Needs configuration',
        },
        {
          label: isVietnamese ? 'Lần cập nhật gần nhất' : 'Last publish',
          value: isVietnamese ? 'Xem ở màn Tổng quan' : 'See dataset status on the home screen',
        },
      ],
    },
    accessBlock: {
      title: isVietnamese ? 'Giới hạn quyền nhìn thấy' : 'Access boundary',
      description: isVietnamese
        ? 'Màn này chỉ dành cho chủ quán, không hiển thị tác vụ điều hành nội bộ.'
        : 'Merchant settings remain product-facing and do not expose control-plane actions.',
      status: 'now' as const,
      items: [
        { label: isVietnamese ? 'Vai trò' : 'Role', value: roleLabel },
        { label: isVietnamese ? 'Phạm vi' : 'Scope', value: isVietnamese ? 'Chỉ chỉnh nhà hàng đang chọn ở đây.' : 'Only the selected restaurant is editable here.' },
        { label: isVietnamese ? 'Điều khiển quản trị' : 'Admin controls', value: isVietnamese ? 'Không hiển thị trong không gian nhà hàng.' : 'Hidden from the merchant shell.' },
      ],
    },
    nextBlock: {
      title: isVietnamese ? 'Phần sẽ mở rộng sau' : 'Planned next layer',
      description: isVietnamese
        ? 'Dành chỗ cho lớp trải nghiệm tiếp theo khi luồng vận hành của chủ quán cần sâu hơn.'
        : 'Reserved for future workflow polish once merchant execution surfaces grow.',
      status: 'next' as const,
      items: [
        { label: isVietnamese ? 'Bộ lọc đã lưu' : 'Saved views', value: isVietnamese ? 'Sẽ có sau' : 'Planned' },
        { label: isVietnamese ? 'Quy tắc cảnh báo' : 'Alert rules', value: isVietnamese ? 'Sẽ có sau' : 'Planned' },
        { label: isVietnamese ? 'Theo dõi việc xử lý' : 'Action follow-up', value: isVietnamese ? 'Sẽ có sau' : 'Planned' },
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
  const settingsBlocks = buildSettingsBlocks(copy, currentRestaurant, language, roleDescriptor.label)

  const badges = [
    {
      label: detail?.googleMapUrl
        ? language.startsWith('vi')
          ? 'Nguồn đã sẵn sàng'
          : 'Source ready'
        : language.startsWith('vi')
          ? 'Thiếu nguồn dữ liệu'
          : 'Source missing',
      tone: detail?.googleMapUrl ? ('success' as const) : ('warning' as const),
    },
    {
      label: language.startsWith('vi')
        ? `${formatNumber(totalReviews, language)} đánh giá`
        : `${formatNumber(totalReviews, language)} reviews`,
      tone: 'neutral' as const,
    },
    {
      label: language.startsWith('vi')
        ? `${formatNumber(detail?.datasetStatus.approvedItemCount ?? 0, language)} mục đã duyệt`
        : `${formatNumber(detail?.datasetStatus.approvedItemCount ?? 0, language)} approved items`,
      tone: detail?.datasetStatus.approvedItemCount ? ('success' as const) : ('neutral' as const),
    },
  ]

  const contextSlot = (
    <div className="grid gap-3 border border-white/8 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {language.startsWith('vi') ? 'Ngữ cảnh nhà hàng' : 'Merchant context'}
      </div>
      <div className="text-[18px] font-semibold text-white">
        {currentRestaurant?.name ?? (language.startsWith('vi') ? 'Tạo nhà hàng đầu tiên' : 'Create your first restaurant')}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {language.startsWith('vi') ? 'Dữ liệu' : 'Dataset'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">{freshnessLabel}</div>
        </div>
        <div className="border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {language.startsWith('vi') ? 'Việc nên làm tiếp' : 'Next action'}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">
            {topIssue
              ? language.startsWith('vi')
                ? `Xem lại phản hồi về ${topIssue}`
                : `Review ${topIssue}`
              : language.startsWith('vi')
                ? 'Kết nối nguồn và công bố đánh giá đầu tiên'
                : 'Connect a source and publish evidence'}
          </div>
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
          {detail?.address ?? (language.startsWith('vi') ? 'Chưa có địa chỉ.' : 'No address on file.')}
          </div>
          <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
          {detail?.googleMapUrl
            ? language.startsWith('vi')
              ? 'Đã kết nối nguồn'
              : 'Source connected'
            : language.startsWith('vi')
              ? 'Thiếu nguồn'
              : 'Source missing'}
          </div>
        </div>
      </div>
  ) : (
    <div className="space-y-2 text-[12px] leading-6 text-slate-400">
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {language.startsWith('vi')
          ? 'Tạo nhà hàng đầu tiên để mở khóa màn Tổng quan, Đánh giá, Việc cần làm và Thiết lập.'
          : 'Create the first restaurant to unlock reviews, actions, and settings.'}
      </div>
      <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
        {language.startsWith('vi')
          ? 'Không gian nhà hàng chỉ tập trung vào góc nhìn của chủ quán, không hiển thị chẩn đoán quản trị.'
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
        searchLabel={language.startsWith('vi') ? 'Tra cứu đánh giá' : 'Search reviews'}
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

  return (
    <ShellLayout
      mode="merchant"
      route={route}
      language={language}
      productLabel={roleDescriptor.label}
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
      {content}
    </ShellLayout>
  )
}
