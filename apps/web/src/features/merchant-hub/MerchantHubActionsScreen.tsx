import type { MerchantHubActionsScreenProps } from './merchantHubTypes'
import { getMerchantHubCopy } from './merchantHubCopy'
import {
  MerchantHubBadge,
  MerchantHubEmptyState,
  MerchantHubPanel,
  MerchantHubPriorityPill,
  MerchantHubSectionHeader,
} from './merchantHubUi'

export function MerchantHubActionsScreen({
  language,
  restaurant,
  detail,
  topIssue,
  actionCards,
  nowSummary,
  nextSummary,
  onNavigateToReviews,
  onNavigateToSettings,
}: MerchantHubActionsScreenProps) {
  const copy = getMerchantHubCopy(language)

  return (
    <div data-testid="merchant-actions-screen" className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <MerchantHubSectionHeader
          eyebrow={copy.actions.title}
          title={language.startsWith('vi') ? 'Ưu tiên xử lý hôm nay' : 'What to fix first'}
          description={copy.actions.description}
          action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
              {language.startsWith('vi') ? 'Nhà hàng' : 'Restaurant'}
            </div>
            <div className="mt-2 text-[18px] font-black tracking-tight text-[#1f1c18]">
              {restaurant?.name ?? (language.startsWith('vi') ? 'Nhà hàng' : 'Restaurant')}
            </div>
            <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
              {detail?.address ?? (language.startsWith('vi') ? 'Chưa có địa chỉ' : 'No address on file')}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{copy.nowLabel}</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">{nowSummary}</div>
            </div>
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{copy.nextLabel}</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">{nextSummary}</div>
            </div>
          </div>
        </div>
      </MerchantHubPanel>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Danh sách ưu tiên' : copy.nowLabel}
            title={language.startsWith('vi') ? 'Việc nên xử lý trước' : 'Priority board'}
            description={
              language.startsWith('vi')
                ? 'Mỗi thẻ nên giúp chủ quán hiểu rõ vấn đề, bằng chứng đi kèm và bước xử lý đầu tiên.'
                : 'Each card should read like a short operating instruction instead of a dashboard metric wall.'
            }
            action={<MerchantHubBadge state="now">{copy.nowLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            {topIssue ? (
                <div className="border border-[#caa55e] bg-[#faf4e4] px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a5a44]">
                  {language.startsWith('vi') ? 'Vấn đề nổi bật' : 'Top issue'}
                </div>
                <div className="mt-2 text-[16px] font-black tracking-tight text-[#1f1c18]">{topIssue}</div>
              </div>
            ) : (
              <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có vấn đề nổi bật' : 'No dominant issue yet'}
                description={
                  language.startsWith('vi')
                    ? 'Khi một nhóm phản hồi lặp lại đủ nhiều, việc cần làm sẽ hiện tại đây.'
                    : 'The next action will appear once a review pattern is strong enough to prioritize.'
                }
              />
            )}

            {actionCards.length > 0 ? (
              actionCards.map((card) => (
                <article key={`${card.title}-${card.priority}`} className="border border-[#e7ded0] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MerchantHubBadge state={card.status}>
                          {card.status === 'now' ? copy.nowLabel : copy.nextLabel}
                        </MerchantHubBadge>
                        <MerchantHubPriorityPill priority={card.priority} language={language} />
                      </div>
                      <div className="mt-3 text-[16px] font-black tracking-tight text-[#1f1c18]">{card.title}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#5f584e]">{card.summary}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                        {language.startsWith('vi') ? 'Bằng chứng' : 'Evidence'}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-[#1f1c18]">{card.evidence}</div>
                    </div>
                    <div className="border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">
                        {language.startsWith('vi') ? 'Bước tiếp theo' : 'Next step'}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-[#1f1c18]">{card.nextStep}</div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <MerchantHubEmptyState
                title={language.startsWith('vi') ? 'Chưa có việc ưu tiên' : 'No actions yet'}
                description={
                  language.startsWith('vi')
                    ? 'Khi dữ liệu phản hồi đủ rõ, các việc nên xử lý trước sẽ xuất hiện tại đây.'
                    : 'Populate the board with review-backed priorities before adding execution tasks.'
                }
              />
            )}
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow={language.startsWith('vi') ? 'Lớp vận hành tiếp theo' : copy.nextLabel}
            title={language.startsWith('vi') ? 'Những gì sẽ đến sau' : 'Execution layer'}
            description={
              language.startsWith('vi')
                ? 'Sau khi đã biết nên xử lý gì trước, hệ thống có thể mở rộng sang giao việc, nhắc việc và theo dõi tiến độ.'
                : 'This is the part of the product that comes after prioritization: tasks, assignments, nudges, and follow-up.'
            }
            action={<MerchantHubBadge state="next">{copy.nextLabel}</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{copy.nowLabel}</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">
                {language.startsWith('vi') ? 'Dùng phản hồi để chốt việc nên xử lý đầu tiên.' : 'Use reviews to decide the first fix.'}
              </div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                {language.startsWith('vi')
                  ? 'Hiện tại, màn này tập trung trả lời đúng câu hỏi quan trọng nhất của chủ quán.'
                  : 'The board already supports the question the merchant cares about most.'}
              </div>
            </div>
            <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">{copy.nextLabel}</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">
                {language.startsWith('vi') ? 'Theo dõi người phụ trách và nhắc việc.' : 'Track owners and send reminders.'}
              </div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                {language.startsWith('vi')
                  ? 'Khi backend mở rộng hơn, màn này có thể chứa người phụ trách, hạn xử lý và vòng phản hồi mà không cần đổi lại bố cục.'
                  : 'When the backend grows, this surface can host task owners, due dates, and feedback loops without changing the layout.'}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
                onClick={onNavigateToReviews}
              >
                {language.startsWith('vi') ? 'Xem lại đánh giá' : 'Review evidence'}
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
