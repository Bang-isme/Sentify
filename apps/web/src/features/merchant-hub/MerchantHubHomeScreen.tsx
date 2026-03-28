import type { MerchantHubHomeScreenProps } from './merchantHubTypes'
import { getMerchantHubCopy } from './merchantHubCopy'
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

function getSourcePillCopy(
  hasGoogleMapUrl: boolean,
  language: string,
) {
  if (hasGoogleMapUrl) {
    return {
      label: language.startsWith('vi') ? '\u0110\u00e3 l\u01b0u URL Google Maps' : 'Google Maps URL on file',
      tone: 'neutral' as const,
    }
  }

  return {
    label: language.startsWith('vi') ? '\u0054hi\u1ebfu URL Google Maps' : 'Google Maps URL missing',
    tone: 'warning' as const,
  }
}
export function MerchantHubHomeScreen({
  language,
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
  const copy = getMerchantHubCopy(language)
  const totalReviews = detail?.insightSummary.totalReviews ?? 0
  const topSentiment = sentiment[0] ?? null
  const sourcePill = getSourcePillCopy(Boolean(detail?.googleMapUrl), language)

  return (
    <div data-testid="merchant-home-screen" className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <MerchantHubBadge state={freshnessStatus}>{copy.home.freshnessLabel}</MerchantHubBadge>
            <h1 className="mt-4 text-[1.8rem] font-black tracking-tight text-[#1f1c18] lg:text-[2.25rem]">
              {restaurant?.name ?? copy.home.title}
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-[#5f584e]">
              {detail?.address ?? (language.startsWith('vi') ? 'Chưa có địa chỉ' : 'No address on file')}. {copy.home.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MerchantHubPill tone={freshnessStatus === 'now' ? 'success' : 'warning'}>
                <span data-testid="merchant-home-freshness-pill">{freshnessLabel}</span>
              </MerchantHubPill>
              <MerchantHubPill>
                {formatNumber(totalReviews, language)} {language.startsWith('vi') ? 'đánh giá' : 'reviews'}
              </MerchantHubPill>
              <MerchantHubPill tone={sourcePill.tone}>
                <span data-testid="merchant-home-source-pill">{sourcePill.label}</span>
              </MerchantHubPill>
            </div>
          </div>
          <div className="grid gap-2 sm:min-w-[18rem]">
            <button
              type="button"
              className="border border-[#d9c29b] bg-[#ca8a04] px-4 py-3 text-[13px] font-bold text-white transition hover:translate-y-[-1px]"
              onClick={onNavigateToActions}
            >
              {language.startsWith('vi') ? 'Xem việc cần làm' : 'Open actions'}
            </button>
            <button
              type="button"
              className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18] transition hover:border-[#caa55e]"
              onClick={onNavigateToReviews}
            >
              {language.startsWith('vi') ? 'Xem đánh giá khách' : 'Review evidence'}
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
            language={language}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
            <MerchantHubPanel className="p-5 lg:p-4">
              <MerchantHubSectionHeader
                eyebrow={language.startsWith('vi') ? 'Ưu tiên hôm nay' : copy.nowLabel}
                title={highlight ? highlight.title : copy.home.highlightTitle}
            description={highlight ? highlight.description : copy.home.emptyHighlight}
            action={
              <MerchantHubBadge state={highlight?.status ?? 'next'}>
                {highlight?.status === 'now' ? copy.nowLabel : copy.nextLabel}
              </MerchantHubBadge>
            }
          />

              <div className="mt-5 grid gap-3">
                {highlight ? (
                  <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                      {language.startsWith('vi') ? 'Vì sao nên xử lý trước' : 'Why this is first'}
                    </div>
                    <div className="mt-2 text-[16px] font-black tracking-tight text-[#1f1c18]">
                      {highlight.evidence}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[#5f584e]">{highlight.description}</p>
                  </div>
                ) : (
                  <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có vấn đề nào nổi bật' : 'No dominant issue yet'}
                description={
                  language.startsWith('vi')
                    ? 'Hãy tiếp tục cập nhật và công bố đánh giá. Khi một vấn đề lặp lại đủ mạnh, nó sẽ hiện ở đây.'
                    : 'Keep publishing evidence. The next action will appear here once a pattern is strong enough to act on.'
                }
              />
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToReviews}
              >
                <MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">
                  {language.startsWith('vi') ? 'Đọc đánh giá liên quan' : 'Open reviews'}
                </div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  {language.startsWith('vi')
                    ? 'Mở danh sách phản hồi để kiểm tra kỹ bằng chứng phía sau vấn đề hiện tại.'
                    : 'Read the evidence behind the current priority.'}
                </div>
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToActions}
              >
                <MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">
                  {language.startsWith('vi') ? 'Mở danh sách việc cần làm' : 'See actions'}
                </div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  {language.startsWith('vi')
                    ? 'Biến phản hồi thành việc cần xử lý trước và bước tiếp theo rõ ràng.'
                    : 'Translate evidence into the next fix.'}
                </div>
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-22px_rgba(24,18,8,0.16)]"
                onClick={onNavigateToSettings}
              >
                <MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>
                <div className="mt-3 text-[13px] font-bold text-[#1f1c18]">
                  {language.startsWith('vi') ? 'Kiểm tra thiết lập nguồn' : 'Refine settings'}
                </div>
                <div className="mt-1 text-[12px] leading-5 text-[#5f584e]">
                  {language.startsWith('vi')
                    ? 'Đảm bảo thông tin quán và URL Google Maps vẫn đúng để dữ liệu không bị lệch.'
                    : 'Policies and readiness will sit here in the next layer.'}
                </div>
              </button>
            </div>
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={copy.home.trendTitle}
            title={language.startsWith('vi') ? 'Tín hiệu cần theo dõi' : 'Signal at a glance'}
            description={
              language.startsWith('vi')
                ? 'Tóm tắt nhanh cảm nhận chung và biến động đánh giá trong tập dữ liệu hiện tại.'
                : 'A compact summary of what the current review set says today.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            {topSentiment ? (
              <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                  {language.startsWith('vi') ? 'Cảm nhận chiếm ưu thế' : 'Leading sentiment'}
                </div>
                <div className="mt-2 text-[18px] font-black tracking-tight text-[#1f1c18]">
                  {topSentiment.label} {formatPercentage(topSentiment.percentage, language)}
                </div>
                <div className="mt-1 text-[12px] text-[#5f584e]">
                  {formatNumber(topSentiment.count, language)}{' '}
                  {language.startsWith('vi') ? 'đánh giá trong nhóm này' : 'reviews in this slice'}
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
                        {formatRating(point.averageRating, language)}{' '}
                        {language.startsWith('vi') ? 'điểm trung bình' : 'average'}
                      </div>
                    </div>
                    <div className="h-2 bg-[#eee5d7]">
                      <div
                        className="h-full bg-[#ca8a04]"
                        style={{ width: `${Math.min((point.averageRating / 5) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#5f584e]">
                      {formatTrendValue(point.reviewCount)}{' '}
                      {language.startsWith('vi') ? 'đánh giá so với mốc trước' : 'reviews vs baseline'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có xu hướng đủ rõ' : 'No trend yet'}
                description={
                  language.startsWith('vi')
                    ? 'Khi số lượng đánh giá đã công bố đủ lớn, xu hướng sẽ hiện rõ ở đây.'
                    : 'The trend strip will appear once enough reviews are published.'
                }
              />
            )}
          </div>
        </MerchantHubPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Cảm xúc khách hàng' : 'Sentiment'}
            title={language.startsWith('vi') ? 'Bức tranh chung của tập đánh giá' : 'How the current set reads'}
            description={
              language.startsWith('vi')
                ? 'Nhìn nhanh tỷ lệ tích cực, trung tính và tiêu cực để hiểu tình trạng hiện tại của quán.'
                : 'A short diagnostic that turns the current review mix into something easy to scan.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
          />
          <div className="mt-5 grid gap-3">
            {sentiment.map((row) => (
              <div key={row.label} className="border border-[#e7ded0] bg-white px-4 py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-[#1f1c18]">{row.label}</div>
                  <div className="text-[11px] font-semibold text-[#8f877c]">
                    {formatNumber(row.count, language)} {language.startsWith('vi') ? 'đánh giá' : 'reviews'}
                  </div>
                </div>
                <div className="h-2 bg-[#eee5d7]">
                    <div className="h-full bg-[#ca8a04]" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-[#5f584e]">
                  {formatNumber(row.count, language)} {language.startsWith('vi') ? 'đánh giá' : 'reviews'}
                </div>
              </div>
            ))}
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={copy.home.evidenceTitle}
            title={language.startsWith('vi') ? 'Phản hồi gần đây' : 'Recent evidence'}
            description={
              language.startsWith('vi')
                ? 'Những phản hồi mới nhất đáng để đội vận hành xem lại trước khi đưa ra quyết định.'
                : 'The freshest comments that should shape the next decision.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
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
                    <MerchantHubPill>{formatRating(item.rating, language)}</MerchantHubPill>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#5f584e]">
                    {item.content ?? 'No review content available.'}
                  </p>
                </article>
              ))
            ) : (
              <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có phản hồi mới' : 'No recent evidence'}
                description={
                  language.startsWith('vi')
                    ? 'Khi có thêm đánh giá được công bố, các phản hồi mới nhất sẽ hiện ở đây.'
                    : 'As reviews arrive, the latest comments will appear here.'
                }
              />
            )}
          </div>
        </MerchantHubPanel>
      </div>

      {complaintKeywords.length > 0 ? (
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Nhóm phàn nàn lặp lại' : 'Complaint focus'}
            title={language.startsWith('vi') ? 'Những chủ đề lặp lại nhiều nhất' : 'What repeats most'}
            description={
              language.startsWith('vi')
                ? 'Các từ khóa này giúp chủ quán nhìn ra vấn đề lặp lại nhiều nhất trong phản hồi hiện tại.'
                : 'These keywords give the merchant a sharper read on the current problem set.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {complaintKeywords.slice(0, 8).map((keyword) => (
              <MerchantHubPill key={keyword.keyword} tone={keyword.percentage >= 20 ? 'warning' : 'neutral'}>
                {keyword.keyword} {formatNumber(keyword.count, language)}
              </MerchantHubPill>
            ))}
          </div>
        </MerchantHubPanel>
      ) : null}
    </div>
  )
}
