import { useEffect, useState } from 'react'
import { getAdminHealthJobs, type AdminHealthJobsResponse } from '../../../lib/api'
import { AdminCard, AdminDataCell, AdminBadge, AdminStatusMessage } from '../../admin-shell/components/AdminPrimitives'

interface AdminHealthJobsPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value)
}

function formatDate(value: string | null, language: string) {
  if (!value) {
    return language.startsWith('vi') ? 'Chưa có' : 'Unavailable'
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusTone(status: string) {
  if (status === 'HEALTHY' || status === 'UP') {
    return 'success'
  }

  if (status === 'DEGRADED' || status === 'DOWN') {
    return 'danger'
  }

  return 'neutral'
}

export function AdminHealthJobsPanel({
  language,
  refreshKey,
  onSessionExpiry,
}: AdminHealthJobsPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [data, setData] = useState<AdminHealthJobsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextData = await getAdminHealthJobs()
        if (!cancelled) {
          setData(nextData)
        }
      } catch (nextError) {
        if (!cancelled && !onSessionExpiry(nextError)) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : isVietnamese
                ? 'Không thể tải dữ liệu sức khỏe hệ thống.'
                : 'Unable to load health.',
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
    <div data-testid="admin-health-jobs-screen" className="grid gap-4">
      <AdminCard
        title={isVietnamese ? 'Sức khỏe hệ thống và hàng đợi' : 'Platform health and jobs'}
        description={
          isVietnamese
            ? 'Kiểm tra API, cơ sở dữ liệu, hàng đợi, worker và bằng chứng khôi phục trước khi xử lý vận hành.'
            : 'Inspect the backend, queue, workers, and recovery evidence before debugging admin operations or crawl runtime.'
        }
      >
        {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-zinc-400">{isVietnamese ? 'Đang tải trạng thái hệ thống...' : 'Loading platform health...'}</div>
        ) : null}
        {data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: isVietnamese ? 'API' : 'API', value: data.services.api.status },
              { label: isVietnamese ? 'CSDL' : 'Database', value: data.services.database.status },
              { label: isVietnamese ? 'Hàng đợi' : 'Queue', value: data.services.queue.status },
              { label: isVietnamese ? 'Worker' : 'Workers', value: data.services.workers.status },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b] flex flex-col justify-between items-start">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">{item.label}</div>
                <div className="mt-4">
                  <AdminBadge label={item.value} tone={statusTone(item.value) as any} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </AdminCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start">
        <AdminCard
          title={isVietnamese ? 'Trạng thái hàng đợi' : 'Queue posture'}
          description={
            isVietnamese
              ? 'Số job đang chờ và chế độ chạy hiện tại của hàng đợi crawl.'
              : 'Live job counts and runtime mode for the review crawl queue.'
          }
          className="h-full"
        >
          {data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminDataCell label={isVietnamese ? 'Đang chờ' : 'Queued'} value={formatCount(data.jobs.counts.queued, language)} />
              <AdminDataCell label={isVietnamese ? 'Đang chạy' : 'Running'} value={formatCount(data.jobs.counts.running, language)} />
              <AdminDataCell label={isVietnamese ? 'Hoàn tất' : 'Completed'} value={formatCount(data.jobs.counts.completed, language)} />
              <AdminDataCell label={isVietnamese ? 'Độ song song' : 'Concurrency'} value={formatCount(data.jobs.concurrency, language)} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese ? 'Không có dữ liệu sức khỏe.' : 'Health data is unavailable.'}
            </div>
          )}
        </AdminCard>

        <AdminCard
          title={isVietnamese ? 'Các job crawl gần đây' : 'Recent crawl jobs'}
          description={
            isVietnamese
              ? 'Dùng các job gần đây để đối chiếu vấn đề nhập liệu với trạng thái hàng đợi hoặc worker.'
              : 'Use recent runs to correlate intake issues with queue or worker state.'
          }
          className="h-full"
        >
          {data?.jobs.recentRuns.length ? (
            <div className="flex flex-col gap-2">
              {data.jobs.recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b] grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] items-center"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-900 dark:text-white">{run.restaurant.name}</div>
                    <div className="mt-1 break-words text-[13px] text-slate-500 dark:text-zinc-400">{run.id}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge label={run.status} tone={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral'} />
                    <AdminBadge label={run.strategy} tone="neutral" />
                  </div>
                  <div className="text-[12px] text-slate-500 dark:text-zinc-400 text-right">{formatDate(run.finishedAt || run.queuedAt, language)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese ? 'Chưa có crawl run nào.' : 'No crawl runs have been recorded yet.'}
            </div>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title={isVietnamese ? 'Bằng chứng khôi phục' : 'Recovery proof artifacts'}
        description={
          isVietnamese
            ? 'Các báo cáo này cho thấy queue smoke, sync-to-draft và recovery drill đã được chạy ngoài giao diện.'
            : 'These artifacts show that queue smoke, sync-to-draft, and recovery drills have been exercised outside the UI.'
        }
      >
        {data?.recovery.proofArtifacts.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.recovery.proofArtifacts.map((artifact) => (
              <div key={artifact.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-bold text-slate-900 dark:text-white">{artifact.label}</div>
                  <AdminBadge label={artifact.available ? (isVietnamese ? 'Có sẵn' : 'Available') : isVietnamese ? 'Thiếu' : 'Missing'} tone={artifact.available ? 'success' : 'neutral'} />
                </div>
                <div className="mt-2 text-[13px] text-slate-500 dark:text-zinc-400">{artifact.fileName}</div>
                <div className="mt-2 text-[12px] text-slate-400 dark:text-zinc-500">
                  {isVietnamese ? 'Cập nhật' : 'Updated'} {formatDate(artifact.updatedAt, language)}
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
            {isVietnamese ? 'Chưa có artifact khôi phục.' : 'No recovery artifacts are available yet.'}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
