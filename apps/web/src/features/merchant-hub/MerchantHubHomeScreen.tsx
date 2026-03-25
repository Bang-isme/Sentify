import type { MerchantHubHomeScreenProps } from './merchantHubTypes'
import { merchantHubCopy } from './merchantHubCopy'
import {
  MerchantHubBadge,
  MerchantHubEmptyState,
  MerchantHubMetric,
  MerchantHubPanel,
  MerchantHubPill,
  MerchantHubSectionHeader,
} from './merchantHubUi'
import { formatNumber, formatPercentage, formatRating } from '../../components/product/workspace/shared-utils'

function formatTrendValue(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function MerchantHubHomeScreen({
  restaurant,
  detail,
  freshnessLabel,
  freshnessStatus,
  kpis,
  sentiment,
  complaintKeywords,
  trend,
  highlight,
  recentEvidence,
  onNavigateToReviews,
  onNavigateToActions,
  onNavigateToSettings,
}: MerchantHubHomeScreenProps) {
  const totalReviews = detail?.datasetStatus.approvedItemCount ?? detail?.insightSummary.totalReviews ?? 0
  const topSentiment = sentiment[0] ?? null

  return (
    <div className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <MerchantHubBadge state={freshnessStatus}>{merchantHubCopy.home.freshnessLabel}</MerchantHubBadge>
            <h1 className="mt-4 text-[1.8rem] font-black tracking-tight text-[#1f1c18] lg:text-[2.25rem]">
              {restaurant?.name ?? 'Restaurant home'}
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-[#5f584e]">
              {detail?.address ?? 'No address on file'}. {merchantHubCopy.home.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MerchantHubPill tone="success">{freshnessLabel}</MerchantHubPill>
              <MerchantHubPill>{formatNumber(totalReviews, 'en')} reviews</MerchantHubPill>
              {detail?.googleMapUrl ? (
                <MerchantHubPill tone="success">Source connected</MerchantHubPill>
              ) : (
                <MerchantHubPill tone="warning">Source missing</MerchantHubPill>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:min-w-[18rem]">
            <button
              type="button"
              className="border border-[#d9c29b] bg-[#ca8a04] px-4 py-3 text-[13px] font-bold text-white transition hover:translate-y-[-1px]"
              onClick={onNavigateToActions}
            >
              Open actions
            </button>
            <button
              type="button"
              className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18] transition hover:border-[#caa55e]"
              onClick={onNavigateToReviews}
            >
              Review evidence
            </button>
          </div>
        </div>
      </MerchantHubPanel>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <MerchantHubMetric
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            state={item.tone ?? 'now'}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
            <MerchantHubPanel className="p-5 lg:p-4">
              <MerchantHubSectionHeader
                eyebrow={merchantHubCopy.nowLabel}
                title={highlight ? highlight.title : merchantHubCopy.home.highlightTitle}
            description={highlight ? highlight.description : merchantHubCopy.home.emptyHighlight}
            action={
              <MerchantHubBadge state={highlight?.status ?? 'next'}>
                {highlight?.status === 'now' ? merchantHubCopy.nowLabel : merchantHubCopy.nextLabel}
              </MerchantHubBadge>
            }
          />

              <div className="mt-5 grid gap-3">
                {highlight ? (
                  <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                      Why this is first
                    </div>
                    <div className="mt-2 text-[16px] font-black tracking-tight text-[#1f1c18]">
                      {highlight.evidence}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[#5f584e]">{highlight.description}</p>
                  </div>
                ) : (
                  <MerchantHubEmptyState
                title="No dominant issue yet"
                description="Keep publishing evidence. The next action will appear here once a pattern is strong enough to act on."
              />
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToReviews}
              >
                <MerchantHubBadge state="now">Now</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">Open reviews</div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  Read the evidence behind the current priority.
                </div>
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToActions}
              >
                <MerchantHubBadge state="now">Now</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">See actions</div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  Translate evidence into the next fix.
                </div>
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToSettings}
              >
                <MerchantHubBadge state="next">Next</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">Refine settings</div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  Policies and readiness will sit here in the next layer.
                </div>
              </button>
            </div>
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={merchantHubCopy.home.trendTitle}
            title="Signal at a glance"
            description="A compact summary of what the current review set says today."
            action={<MerchantHubBadge state="now">{merchantHubCopy.nowLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            {topSentiment ? (
              <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                  Leading sentiment
                </div>
                <div className="mt-2 text-[18px] font-black tracking-tight text-[#1f1c18]">
                  {topSentiment.label} {formatPercentage(topSentiment.percentage, 'en')}
                </div>
                <div className="mt-1 text-[12px] text-[#5f584e]">
                  {formatNumber(topSentiment.count, 'en')} reviews in this slice
                </div>
              </div>
            ) : null}
            {trend.length > 0 ? (
              <div className="grid gap-2">
                {trend.slice(0, 4).map((point) => (
                  <div key={point.label} className="grid gap-2 border border-[#e7ded0] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-[#1f1c18]">{point.label}</div>
                      <div className="text-[11px] font-semibold text-[#8f877c]">
                        {formatRating(point.averageRating, 'en')} average
                      </div>
                    </div>
                    <div className="h-2 bg-[#eee5d7]">
                      <div
                        className="h-full bg-[#ca8a04]"
                        style={{ width: `${Math.min((point.averageRating / 5) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#5f584e]">
                      {formatTrendValue(point.reviewCount)} reviews vs baseline
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MerchantHubEmptyState
                title="No trend yet"
                description="The trend strip will appear once enough reviews are published."
              />
            )}
          </div>
        </MerchantHubPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow="Sentiment"
            title="How the current set reads"
            description="A short diagnostic that turns the current review mix into something easy to scan."
            action={<MerchantHubBadge state="now">{merchantHubCopy.nowLabel}</MerchantHubBadge>}
          />
          <div className="mt-5 grid gap-3">
            {sentiment.map((row) => (
              <div key={row.label} className="border border-[#e7ded0] bg-white px-4 py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-[#1f1c18]">{row.label}</div>
                  <div className="text-[11px] font-semibold text-[#8f877c]">
                    {formatNumber(row.count, 'en')} reviews
                  </div>
                </div>
                <div className="h-2 bg-[#eee5d7]">
                  <div className="h-full bg-[#ca8a04]" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={merchantHubCopy.home.evidenceTitle}
            title="Recent evidence"
            description="The freshest comments that should shape the next decision."
            action={<MerchantHubBadge state="now">{merchantHubCopy.nowLabel}</MerchantHubBadge>}
          />
          <div className="mt-5 grid gap-3">
            {recentEvidence.length > 0 ? (
              recentEvidence.map((item) => (
                <article key={item.id} className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-[#1f1c18]">{item.authorName}</div>
                    <div className="text-[11px] font-semibold text-[#8f877c]">{item.reviewDateLabel}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <MerchantHubPill tone={item.sentiment === 'NEGATIVE' ? 'warning' : 'success'}>
                      {item.sentiment ?? 'UNSPECIFIED'}
                    </MerchantHubPill>
                    <MerchantHubPill>{formatRating(item.rating, 'en')}</MerchantHubPill>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#5f584e]">
                    {item.content ?? 'No review content available.'}
                  </p>
                </article>
              ))
            ) : (
              <MerchantHubEmptyState
                title="No recent evidence"
                description="As reviews arrive, the latest comments will appear here."
              />
            )}
          </div>
        </MerchantHubPanel>
      </div>

      {complaintKeywords.length > 0 ? (
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow="Complaint focus"
            title="What repeats most"
            description="These keywords give the merchant a sharper read on the current problem set."
            action={<MerchantHubBadge state="now">{merchantHubCopy.nowLabel}</MerchantHubBadge>}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {complaintKeywords.slice(0, 8).map((keyword) => (
              <MerchantHubPill key={keyword.keyword} tone={keyword.percentage >= 20 ? 'warning' : 'neutral'}>
                {keyword.keyword} {formatNumber(keyword.count, 'en')}
              </MerchantHubPill>
            ))}
          </div>
        </MerchantHubPanel>
      ) : null}
    </div>
  )
}
