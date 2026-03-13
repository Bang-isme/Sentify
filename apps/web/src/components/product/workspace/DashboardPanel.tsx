import { DatasetStatusCard } from '../../../features/insights/components/DatasetStatusCard'
import { getAdminIntakeLabels } from '../../../features/admin-intake/adminIntakeLabels'
import type {
  ComplaintKeyword,
  InsightSummary,
  RestaurantDetail,
  SentimentBreakdownRow,
  TrendPeriod,
  TrendPoint,
} from '../../../lib/api'
import type { ProductUiCopy } from '../../../content/productUiCopy'
import {
  EmptyPanel,
  PageIntro,
  SectionCard,
  SidebarStatusPill,
  StatusMessage,
} from './shared'
import { formatNumber, formatPercentage, formatRating } from './shared-utils'

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'primary'
}) {
  return (
    <div
      className={`min-h-[9.5rem] rounded-[1.4rem] border p-5 ${
        tone === 'primary'
          ? 'border-primary/25 bg-primary/8'
          : 'border-border-light/70 bg-bg-light/75 dark:border-border-dark dark:bg-bg-dark/55'
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-silver-light dark:text-text-silver-dark">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-text-charcoal dark:text-white">
        {value}
      </div>
    </div>
  )
}

type DashboardData = {
  kpi: InsightSummary | null
  sentiment: SentimentBreakdownRow[]
  trend: TrendPoint[]
  complaints: ComplaintKeyword[]
}

export function DashboardPanel({
  copy,
  detail,
  dashboard,
  loading,
  error,
  trendPeriod,
  language,
  onTrendPeriodChange,
  onNavigate,
}: {
  copy: ProductUiCopy['app']
  detail: RestaurantDetail | null
  dashboard: DashboardData
  loading: boolean
  error: string | null
  trendPeriod: TrendPeriod
  language: string
  onTrendPeriodChange: (period: TrendPeriod) => void
  onNavigate: (route: '/app' | '/app/reviews' | '/app/settings' | '/app/admin') => void
}) {
  const adminLabels = getAdminIntakeLabels(language)
  const kpi = dashboard.kpi ?? detail?.insightSummary ?? null
  const hasSource = Boolean(detail?.googleMapUrl)
  const totalReviews = kpi?.totalReviews ?? 0
  const hasPublishedReviews = totalReviews > 0

  return (
    <div className="grid gap-6">
      <PageIntro
        eyebrow={copy.navDashboard}
        title={copy.dashboardTitle}
        description={copy.dashboardDescription}
        meta={[
          {
            icon: 'storefront',
            label: detail?.name ?? copy.anonymousGuest,
          },
          {
            icon: hasSource ? 'task_alt' : 'warning',
            label: hasSource ? copy.sourceStatusConnected : copy.sourceStatusNeedsConfiguration,
            tone: hasSource ? 'success' : 'warning',
          },
          {
            icon: 'rate_review',
            label: `${formatNumber(totalReviews, language)} ${copy.navReviews}`,
          },
        ]}
        actions={
          hasSource ? (
            <>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55 dark:text-bg-dark"
                onClick={() => onNavigate('/app/admin')}
              >
                {adminLabels.nav}
              </button>
              <button
                type="button"
                className="group inline-flex h-11 items-center justify-center gap-2 px-1 text-sm font-semibold text-text-silver-light transition-colors hover:text-primary dark:text-text-silver-dark dark:hover:text-primary"
                onClick={() => onNavigate('/app/reviews')}
              >
                <span>{copy.navReviews}</span>
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1"
                >
                  arrow_forward
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-dark dark:text-bg-dark"
              onClick={() => onNavigate('/app/admin')}
            >
              {adminLabels.nav}
            </button>
          )
        }
      />

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {loading ? <StatusMessage>{copy.loadingDashboard}</StatusMessage> : null}

      <DatasetStatusCard
        detail={detail}
        totalReviews={totalReviews}
        language={language}
        onOpenAdmin={() => onNavigate('/app/admin')}
      />

      {!hasPublishedReviews ? (
        <SectionCard
          title={copy.dashboardPrimaryCta}
          description={copy.noReviews}
          tone="accent"
          headerAside={
            <div className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              {hasSource ? copy.intakeReady : copy.intakeBlocked}
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SidebarStatusPill icon="leaderboard" label={copy.sentimentSplit} />
            <SidebarStatusPill icon="priority_high" label={copy.complaintKeywords} />
            <SidebarStatusPill icon="timeline" label={copy.ratingTrend} />
          </div>
        </SectionCard>
      ) : null}

      <div
        className={`grid items-start gap-4 lg:grid-cols-2 ${
          hasSource ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
        }`}
      >
        <MetricCard label={copy.totalReviews} value={formatNumber(totalReviews, language)} />
        <MetricCard label={copy.averageRating} value={formatRating(kpi?.averageRating ?? 0, language)} />
        <MetricCard
          label={copy.negativeShare}
          value={formatPercentage(kpi?.negativePercentage ?? 0, language)}
          tone={(kpi?.negativePercentage ?? 0) >= 50 ? 'primary' : 'default'}
        />
        {!hasSource ? (
          <SectionCard title={copy.sourceReadiness} tone="accent">
            <div className="grid gap-3 text-sm">
              <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
                {copy.sourceMissing}
              </div>
              <div className="rounded-2xl border border-border-light/70 bg-bg-light/70 px-4 py-3 dark:border-border-dark dark:bg-bg-dark/55">
                {copy.intakeBlocked}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title={copy.sentimentSplit}>
          {dashboard.sentiment.length === 0 ? (
            <EmptyPanel message={copy.noReviews} />
          ) : (
            <div className="grid gap-3">
              {dashboard.sentiment.map((row) => (
                <div key={row.label} className="rounded-[1.2rem] border border-border-light/70 p-4 dark:border-border-dark">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {copy.sentimentLabels[row.label]}
                    </div>
                    <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                      {formatNumber(row.count, language)} | {formatPercentage(row.percentage, language)}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-border-light dark:bg-border-dark">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(row.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={copy.complaintKeywords}>
          {dashboard.complaints.length === 0 ? (
            <EmptyPanel message={copy.noComplaints} />
          ) : (
            <div className="grid gap-3">
              {dashboard.complaints.slice(0, 6).map((keyword) => (
                <div
                  key={keyword.keyword}
                  className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-border-light/70 px-4 py-4 dark:border-border-dark"
                >
                  <div>
                    <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                      {keyword.keyword}
                    </div>
                    <div className="mt-1 text-xs text-text-silver-light dark:text-text-silver-dark">
                      {formatPercentage(keyword.percentage, language)}
                    </div>
                  </div>
                  <div className="text-lg font-black text-primary">
                    {formatNumber(keyword.count, language)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={copy.ratingTrend}>
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              trendPeriod === 'week'
                ? 'bg-primary text-white dark:text-bg-dark'
                : 'border border-border-light text-text-charcoal hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white'
            }`}
            onClick={() => onTrendPeriodChange('week')}
          >
            {copy.periodWeek}
          </button>
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              trendPeriod === 'month'
                ? 'bg-primary text-white dark:text-bg-dark'
                : 'border border-border-light text-text-charcoal hover:border-primary/60 hover:text-primary dark:border-border-dark dark:text-white'
            }`}
            onClick={() => onTrendPeriodChange('month')}
          >
            {copy.periodMonth}
          </button>
        </div>

        {dashboard.trend.length === 0 ? (
          <EmptyPanel message={copy.noTrend} />
        ) : (
          <div className="grid gap-3">
            {dashboard.trend.map((point) => (
              <div
                key={point.label}
                className="grid gap-3 rounded-[1.2rem] border border-border-light/70 p-4 dark:border-border-dark md:grid-cols-[110px_minmax(0,1fr)_112px]"
              >
                <div className="text-sm font-semibold text-text-charcoal dark:text-white">
                  {point.label}
                </div>
                <div className="self-center">
                  <div className="h-2 rounded-full bg-border-light dark:bg-border-dark">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min((point.averageRating / 5) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-text-silver-light dark:text-text-silver-dark">
                  {formatRating(point.averageRating, language)} | {formatNumber(point.reviewCount, language)}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
