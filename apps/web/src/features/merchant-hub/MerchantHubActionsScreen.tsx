import type { MerchantHubActionsScreenProps } from './merchantHubTypes'
import { merchantHubCopy } from './merchantHubCopy'
import {
  MerchantHubBadge,
  MerchantHubEmptyState,
  MerchantHubPanel,
  MerchantHubPriorityPill,
  MerchantHubSectionHeader,
} from './merchantHubUi'

export function MerchantHubActionsScreen({
  restaurant,
  detail,
  topIssue,
  actionCards,
  nowSummary,
  nextSummary,
  onNavigateToReviews,
  onNavigateToSettings,
}: MerchantHubActionsScreenProps) {
  return (
    <div className="grid gap-4">
      <MerchantHubPanel className="p-5 lg:p-4">
        <MerchantHubSectionHeader
          eyebrow={merchantHubCopy.actions.title}
          title="What to fix first"
          description={merchantHubCopy.actions.description}
          action={<MerchantHubBadge state="now">{merchantHubCopy.nowLabel}</MerchantHubBadge>}
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Restaurant</div>
            <div className="mt-2 text-[18px] font-black tracking-tight text-[#1f1c18]">
              {restaurant?.name ?? 'Restaurant'}
            </div>
            <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
              {detail?.address ?? 'No address on file'}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Now</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">{nowSummary}</div>
            </div>
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Next</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">{nextSummary}</div>
            </div>
          </div>
        </div>
      </MerchantHubPanel>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow="Now"
            title="Priority board"
            description="Each card should read like a short operating instruction instead of a dashboard metric wall."
            action={<MerchantHubBadge state="now">Now</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            {topIssue ? (
              <div className="border border-[#caa55e] bg-[#faf4e4] px-4 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a5a44]">Top issue</div>
                <div className="mt-2 text-[16px] font-black tracking-tight text-[#1f1c18]">{topIssue}</div>
              </div>
            ) : (
              <MerchantHubEmptyState
                title="No dominant issue yet"
                description="The next action will appear once a review pattern is strong enough to prioritize."
              />
            )}

            {actionCards.length > 0 ? (
              actionCards.map((card) => (
                <article key={`${card.title}-${card.priority}`} className="border border-[#e7ded0] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MerchantHubBadge state={card.status}>
                          {card.status === 'now' ? merchantHubCopy.nowLabel : merchantHubCopy.nextLabel}
                        </MerchantHubBadge>
                        <MerchantHubPriorityPill priority={card.priority} />
                      </div>
                      <div className="mt-3 text-[16px] font-black tracking-tight text-[#1f1c18]">{card.title}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#5f584e]">{card.summary}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Evidence</div>
                      <div className="mt-1 text-[12px] leading-5 text-[#1f1c18]">{card.evidence}</div>
                    </div>
                    <div className="border border-[#e7ded0] bg-[#fcfaf6] px-3 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Next step</div>
                      <div className="mt-1 text-[12px] leading-5 text-[#1f1c18]">{card.nextStep}</div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <MerchantHubEmptyState
                title="No actions yet"
                description="Populate the board with review-backed priorities before adding execution tasks."
              />
            )}
          </div>
        </MerchantHubPanel>

        <MerchantHubPanel className="p-5 lg:p-4">
          <MerchantHubSectionHeader
            eyebrow="Next"
            title="Execution layer"
            description="This is the part of the product that comes after prioritization: tasks, assignments, nudges, and follow-up."
            action={<MerchantHubBadge state="next">Next</MerchantHubBadge>}
          />

          <div className="mt-5 grid gap-3">
            <div className="border border-[#e7ded0] bg-white px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Now</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">
                Use reviews to decide the first fix.
              </div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                The board already supports the question the merchant cares about most.
              </div>
            </div>
            <div className="border border-[#e7ded0] bg-[#fcfaf6] px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f877c]">Next</div>
              <div className="mt-2 text-[13px] font-semibold text-[#1f1c18]">Track owners and send reminders.</div>
              <div className="mt-1 text-[12px] leading-6 text-[#5f584e]">
                When the backend grows, this surface can host task owners, due dates, and feedback loops without changing the layout.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
                onClick={onNavigateToReviews}
              >
                Review evidence
              </button>
              <button
                type="button"
                className="border border-[#e7ded0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1c18]"
                onClick={onNavigateToSettings}
              >
                Open settings
              </button>
            </div>
          </div>
        </MerchantHubPanel>
      </div>
    </div>
  )
}
