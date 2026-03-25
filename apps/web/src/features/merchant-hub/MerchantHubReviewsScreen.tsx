import type { MerchantHubReviewsScreenProps } from './merchantHubTypes'
import { getMerchantHubCopy } from './merchantHubCopy'
import {
  MerchantHubBadge,
  MerchantHubEmptyState,
  MerchantHubPanel,
  MerchantHubPill,
  MerchantHubSectionHeader,
} from './merchantHubUi'
import { formatNumber, formatRating, formatReviewDate, getReviewToneClasses } from '../../components/product/workspace/shared-utils'

export function MerchantHubReviewsScreen({
  language,
  restaurant,
  detail,
  query,
  reviewCount,
  filters,
  reviews,
  searchLabel,
  searchHint,
  searchStatus,
  onNavigateToActions,
  onNavigateToSettings,
}: MerchantHubReviewsScreenProps) {
  const copy = getMerchantHubCopy(language)
  const reviewTotal = reviews?.pagination.total ?? reviewCount ?? 0
  const hasQuery = Boolean(query.rating || query.from || query.to || query.page || query.limit)

  return (
    <div data-testid="merchant-reviews-screen" className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <MerchantHubSectionHeader
          eyebrow={copy.reviews.title}
          title={language.startsWith('vi') ? 'Đánh giá khách' : 'Evidence explorer'}
          description={copy.reviews.description}
          action={
            <MerchantHubBadge state={searchStatus}>
              {searchStatus === 'now' ? copy.nowLabel : copy.nextLabel}
            </MerchantHubBadge>
          }
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-[#e7ded0] bg-white px-4 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{searchLabel}</div>
            <div className="mt-2 flex items-center gap-2 border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
              <span className="material-symbols-outlined text-[18px] text-[#8a5a44]">search</span>
              <div className="min-w-0 flex-1 text-[13px] text-[#5f584e]">{searchHint}</div>
              <MerchantHubBadge state="next">{copy.nextLabel}</MerchantHubBadge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasQuery ? (
                <>
                  {query.rating ? (
                    <MerchantHubPill>{language.startsWith('vi') ? `Điểm ${query.rating}` : `Rating ${query.rating}`}</MerchantHubPill>
                  ) : null}
                  {query.from ? (
                    <MerchantHubPill>{language.startsWith('vi') ? `Từ ${query.from}` : `From ${query.from}`}</MerchantHubPill>
                  ) : null}
                  {query.to ? (
                    <MerchantHubPill>{language.startsWith('vi') ? `Đến ${query.to}` : `To ${query.to}`}</MerchantHubPill>
                  ) : null}
                  {query.limit ? <MerchantHubPill>Limit {query.limit}</MerchantHubPill> : null}
                </>
              ) : (
                <MerchantHubPill tone="warning">
                  {language.startsWith('vi') ? 'Chưa bật bộ lọc' : 'No active filter'}
                </MerchantHubPill>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filters.map((filter) => (
              <div key={filter.label} className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                  {filter.label}
                </div>
                <MerchantHubBadge state={filter.status}>
                    {filter.status === 'now' ? copy.nowLabel : copy.nextLabel}
                </MerchantHubBadge>
              </div>
              <div className="mt-2 text-[14px] font-semibold text-[#1f1c18]">{filter.value}</div>
              </div>
            ))}
          </div>
        </div>
      </MerchantHubPanel>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Danh sách phản hồi' : copy.nowLabel}
            title={language.startsWith('vi') ? 'Đánh giá đã công bố' : 'Published reviews'}
            description={
              language.startsWith('vi')
                ? 'Giữ danh sách phản hồi gần với dữ liệu gốc để chủ quán nhìn đúng vấn đề khách đang nói.'
                : 'Keep the list close to the raw evidence instead of hiding it behind extra chrome.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap gap-2">
              <MerchantHubPill tone="success">{restaurant?.name ?? 'Restaurant'}</MerchantHubPill>
              <MerchantHubPill>
                {formatNumber(reviewTotal, language)} {language.startsWith('vi') ? 'đánh giá' : 'reviews'}
              </MerchantHubPill>
              <MerchantHubPill tone={detail?.googleMapUrl ? 'success' : 'warning'}>
                {detail?.googleMapUrl
                  ? language.startsWith('vi')
                    ? 'Đã kết nối Google Maps'
                    : 'Source connected'
                  : language.startsWith('vi')
                    ? 'Thiếu nguồn Google Maps'
                    : 'Source missing'}
              </MerchantHubPill>
            </div>

            {reviews && reviews.data.length > 0 ? (
              reviews.data.map((review) => (
                <article key={review.id} className="border border-[#e7ded0] bg-white px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center border border-[#e7ded0] bg-[#fcfaf6] text-[13px] font-black text-[#1f1c18]">
                          {formatRating(review.rating, language)}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#1f1c18]">
                            {review.authorName ?? (language.startsWith('vi') ? 'Khách ẩn danh' : 'Anonymous guest')}
                          </div>
                          <div className="text-[11px] text-[#8f877c]">
                            {review.reviewDate
                              ? formatReviewDate(review.reviewDate, language, language.startsWith('vi') ? 'Không có ngày đánh giá' : 'No source date')
                              : language.startsWith('vi')
                                ? 'Không có ngày đánh giá'
                                : 'No source date'}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[#5f584e]">
                        {review.content ?? (language.startsWith('vi') ? 'Không có nội dung đánh giá.' : 'No review content available.')}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 self-start border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${getReviewToneClasses(review.sentiment, review.rating).badge}`}
                    >
                      <span>{review.sentiment ?? 'UNSPECIFIED'}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có đánh giá để xem' : 'No reviews yet'}
                description={
                  language.startsWith('vi')
                    ? 'Khi các đánh giá đầu tiên được công bố, chúng sẽ hiện tại đây theo một luồng duy nhất.'
                    : 'When published reviews arrive, they will appear here in a single evidence stream.'
                }
              />
            )}
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Cách dùng màn này' : 'Flow'}
            title={language.startsWith('vi') ? 'Màn này giúp bạn quyết định nhanh hơn' : 'What this screen should do'}
            description={
              language.startsWith('vi')
                ? 'Mục tiêu của màn đánh giá là giúp bạn đọc đúng phản hồi khách trước khi quyết định việc cần làm tiếp theo.'
                : 'The review screen is not a dashboard clone. It is the place to inspect evidence before deciding the next action.'
            }
            action={<MerchantHubBadge state="next">{copy.nextLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                {copy.nowLabel}
              </div>
              <div className="mt-2 text-[14px] font-bold text-[#1f1c18]">
                {language.startsWith('vi')
                  ? 'Bạn có thể lọc nhanh để nhìn đúng nhóm phản hồi mình cần kiểm tra.'
                  : 'Search and filter are visible in the wireframe.'}
              </div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                {language.startsWith('vi')
                  ? 'Bộ lọc điểm và thời gian nằm sát danh sách phản hồi để đường đi từ câu hỏi đến bằng chứng ngắn nhất.'
                  : 'Rating and date filtering stay close to the list so the evidence path stays short.'}
              </div>
            </div>

            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{copy.nextLabel}</div>
              <div className="mt-2 text-[14px] font-bold text-[#1f1c18]">
                {language.startsWith('vi') ? 'Tra cứu sâu và gom cụm phản hồi.' : 'Search index and richer slicing.'}
              </div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                {language.startsWith('vi')
                  ? 'Về sau có thể bổ sung tìm theo từ khóa, gom nhóm phàn nàn và lưu bộ lọc mà không cần đổi cấu trúc màn hình.'
                  : 'The product can later add keyword search, complaint clusters, and saved filter views without changing the structure.'}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
                onClick={onNavigateToActions}
              >
                {language.startsWith('vi') ? 'Mở việc cần làm' : 'Open actions'}
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
                onClick={onNavigateToSettings}
              >
                {language.startsWith('vi') ? 'Mở thiết lập' : 'Open settings'}
              </button>
            </div>
          </div>
        </MerchantHubPanel>
      </div>
    </div>
  )
}
