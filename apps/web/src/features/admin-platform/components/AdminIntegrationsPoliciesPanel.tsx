import { useEffect, useState } from 'react'
import {
  getAdminIntegrationsPolicies,
  type AdminIntegrationsPoliciesResponse,
} from '../../../lib/api'
import { EmptyPanel, SectionCard, StatusMessage } from '../../../components/product/workspace/shared'

interface AdminIntegrationsPoliciesPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value)
}

export function AdminIntegrationsPoliciesPanel({
  language,
  refreshKey,
  onSessionExpiry,
}: AdminIntegrationsPoliciesPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [data, setData] = useState<AdminIntegrationsPoliciesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextData = await getAdminIntegrationsPolicies()
        if (!cancelled) {
          setData(nextData)
        }
      } catch (nextError) {
        if (!cancelled && !onSessionExpiry(nextError)) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : isVietnamese
                ? 'Không thể tải chính sách tích hợp.'
                : 'Unable to load policies.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [onSessionExpiry, refreshKey, isVietnamese])

  return (
    <div data-testid="admin-integrations-policies-screen" className="grid gap-4">
      <SectionCard
        title={isVietnamese ? 'Tích hợp và chính sách' : 'Integrations and policies'}
        description={
          isVietnamese
            ? 'Giữ các ranh giới hệ thống rõ ràng: 2 vai trò, route tách biệt, và trạng thái tích hợp có thể đối chiếu.'
            : 'Make the real contract visible to FE: two system roles, strict route boundaries, integration readiness, and crawl defaults.'
        }
      >
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {loading ? (
          <StatusMessage>{isVietnamese ? 'Đang tải chính sách và tích hợp...' : 'Loading integrations and policies...'}</StatusMessage>
        ) : null}
        {data ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Vai trò hệ thống' : 'System roles'}
                </div>
                <div className="mt-2 text-[1.1rem] font-semibold text-white">
                  {data.roleModel.systemRoles.join(' / ')}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Mô hình thành viên' : 'Membership model'}
                </div>
                <div className="mt-2 text-[1.1rem] font-semibold text-white">
                  {data.roleModel.restaurantMembershipModel}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Đường dẫn merchant' : 'Merchant base path'}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{data.routeBoundary.merchantBasePath}</div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Đường dẫn admin' : 'Admin base path'}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{data.routeBoundary.adminBasePath}</div>
              </div>
            </div>

            <div className="grid gap-2">
              {data.integrations.map((integration) => (
                <div key={integration.key} className="border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">{integration.label}</div>
                    <span className="border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase text-slate-200">
                      {integration.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-400">{integration.detail}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          title={isVietnamese ? 'Phạm vi nguồn' : 'Source coverage'}
          description={
            isVietnamese
              ? 'Kiểm tra bao nhiêu nhà hàng đã có nguồn Google Maps và nơi nào còn thiếu.'
              : 'Admin can inspect how many restaurants are linked to Google Maps sources and where intake coverage is still missing.'
          }
        >
          {data ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Nhà hàng' : 'Restaurants'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.policies.sourceCoverage.restaurantCount, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Nguồn' : 'Sources'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.policies.sourceCoverage.sourceCount, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Chưa có nguồn' : 'Without source'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.policies.sourceCoverage.restaurantsWithoutSourceCount, language)}
                </div>
              </div>
            </div>
          ) : (
            <EmptyPanel message={isVietnamese ? 'Không có dữ liệu phạm vi nguồn.' : 'Coverage data is unavailable.'} />
          )}
        </SectionCard>

        <SectionCard
          title={isVietnamese ? 'Ràng buộc môi trường' : 'Environment constraints'}
          description={
            isVietnamese
              ? 'Các giá trị này giải thích vì sao local, staging và production có thể khác nhau.'
              : 'These values explain why local, staging, and production may behave differently.'
          }
        >
          {data ? (
            <div className="grid gap-2">
              {Object.entries(data.environment).map(([key, value]) => (
                <div key={key} className="grid gap-2 border border-white/8 bg-white/[0.03] p-3 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {key}
                  </div>
                  <div className="text-sm text-white">{Array.isArray(value) ? value.join(', ') : String(value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message={isVietnamese ? 'Không có thông tin môi trường.' : 'Environment details are unavailable.'} />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={isVietnamese ? 'Mặc định crawl' : 'Crawler defaults'}
        description={
          isVietnamese
            ? 'Các mặc định này ảnh hưởng cách admin mô tả review crawl, review ops và hàng đợi.'
            : 'These defaults influence how review crawl, review ops, and queue behavior should be communicated in admin UX.'
        }
      >
        {data ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.policies.crawlDefaults).map(([key, value]) => (
              <div key={key} className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{key}</div>
                <div className="mt-2 text-sm font-semibold text-white">{String(value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel message={isVietnamese ? 'Không có mặc định crawl.' : 'Crawler defaults are unavailable.'} />
        )}
      </SectionCard>
    </div>
  )
}
