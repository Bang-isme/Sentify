import { useEffect, useState } from 'react'
import { getAdminAudit, type AdminAuditResponse } from '../../../lib/api'
import { AdminCard, AdminDataCell, AdminStatusMessage } from '../../admin-shell/components/AdminPrimitives'

interface AdminAuditPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminAuditPanel({ language, refreshKey, onSessionExpiry }: AdminAuditPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [data, setData] = useState<AdminAuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextData = await getAdminAudit(25)
        if (!cancelled) {
          setData(nextData)
        }
      } catch (nextError) {
        if (!cancelled && !onSessionExpiry(nextError)) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : isVietnamese
                ? 'Không thể tải nhật ký kiểm toán.'
                : 'Unable to load audit feed.',
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
    <div data-testid="admin-audit-screen" className="grid gap-4">
      <AdminCard
        title={isVietnamese ? 'Nhật ký kiểm toán' : 'Audit trail'}
        description={
          isVietnamese
            ? 'Theo dõi publish, gán thành viên, thay đổi trạng thái crawl và lịch sử hệ thống trong một luồng duy nhất.'
            : 'Trace publish events, membership assignments, crawl state changes, and system history without leaving the admin shell.'
        }
      >
        {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
        {loading ? <div className="text-sm text-slate-500 dark:text-zinc-400">{isVietnamese ? 'Đang tải nhật ký...' : 'Loading audit feed...'}</div> : null}
        {data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminDataCell label={isVietnamese ? 'Số sự kiện' : 'Events'} value={data.summary.totalEvents} />
            {Object.entries(data.summary.byAction)
              .slice(0, 3)
              .map(([action, count]) => (
                <AdminDataCell key={action} label={action} value={count} />
              ))}
          </div>
        ) : null}
      </AdminCard>

      <AdminCard
        title={isVietnamese ? 'Sự kiện gần đây' : 'Recent events'}
        description={
          isVietnamese
            ? 'Một luồng sự kiện duy nhất giúp FE hiểu flow nào đã chạy và ai là người kích hoạt.'
            : 'A single event stream makes it easier to explain to FE which backend flows already happen and which actor triggered them.'
        }
      >
        {data?.items.length ? (
          <div className="mt-4 flex flex-col gap-2">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b] grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,220px)] items-center"
              >
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">{item.action}</div>
                  <div className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">{formatDate(item.timestamp, language)}</div>
                </div>
                <div className="min-w-0">
                  <div className="break-words text-[14px] font-bold text-slate-900 dark:text-white">{item.summary}</div>
                  <div className="mt-1 break-words text-[13px] text-slate-500 dark:text-zinc-400">
                    {item.restaurant ? `${item.restaurant.name} · ${item.resourceType}` : item.resourceType}
                  </div>
                </div>
                <div className="min-w-0 break-words text-[13px] text-slate-500 dark:text-zinc-400">
                  {item.actor
                    ? isVietnamese
                      ? `${item.actor.fullName} (${item.actor.role})`
                      : `${item.actor.fullName} (${item.actor.role})`
                    : isVietnamese
                      ? 'Sự kiện hệ thống'
                      : 'System event'}
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
             <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
            {isVietnamese ? 'Chưa có sự kiện kiểm toán nào.' : 'No audit events are available yet.'}
          </div>
        ) : null}
      </AdminCard>
    </div>
  )
}
