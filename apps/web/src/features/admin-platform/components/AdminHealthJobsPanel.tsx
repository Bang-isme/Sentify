import { useEffect, useState } from 'react'
import { getAdminHealthJobs, type AdminHealthJobsResponse } from '../../../lib/api'
import { EmptyPanel, SectionCard, StatusMessage } from '../../../components/product/workspace/shared'

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
    return 'Unavailable'
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusTone(status: string) {
  if (status === 'HEALTHY' || status === 'UP') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
  }

  if (status === 'DEGRADED' || status === 'DOWN') {
    return 'border-red-500/20 bg-red-500/10 text-red-200'
  }

  return 'border-white/10 bg-white/[0.05] text-slate-200'
}

export function AdminHealthJobsPanel({
  language,
  refreshKey,
  onSessionExpiry,
}: AdminHealthJobsPanelProps) {
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
          setError(nextError instanceof Error ? nextError.message : 'Unable to load health.')
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
  }, [onSessionExpiry, refreshKey])

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Platform health and jobs"
        description="Inspect the backend, queue, workers, and recovery evidence before debugging admin operations or crawl runtime."
      >
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {loading ? <StatusMessage>Loading platform health...</StatusMessage> : null}
        {data ? (
          <div className="grid gap-3 lg:grid-cols-4">
            {[
              { label: 'API', value: data.services.api.status },
              { label: 'Database', value: data.services.database.status },
              { label: 'Queue', value: data.services.queue.status },
              { label: 'Workers', value: data.services.workers.status },
            ].map((item) => (
              <div key={item.label} className={`border p-3 ${statusTone(item.value)}`}>
                <div className="text-[11px] uppercase tracking-[0.16em]">{item.label}</div>
                <div className="mt-2 text-[1.15rem] font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <SectionCard
          title="Queue posture"
          description="Live job counts and runtime mode for the review crawl queue."
        >
          {data ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Queued</div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.jobs.counts.queued, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Running</div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.jobs.counts.running, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Completed</div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.jobs.counts.completed, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Concurrency</div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(data.jobs.concurrency, language)}
                </div>
              </div>
            </div>
          ) : (
            <EmptyPanel message="Health data is unavailable." />
          )}
        </SectionCard>

        <SectionCard
          title="Recent crawl jobs"
          description="Use recent runs to correlate intake issues with queue or worker state."
        >
          {data?.jobs.recentRuns.length ? (
            <div className="grid gap-2">
              {data.jobs.recentRuns.map((run) => (
                <div key={run.id} className="grid gap-2 border border-white/8 bg-white/[0.03] p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div>
                    <div className="text-[13px] font-semibold text-white">{run.restaurant.name}</div>
                    <div className="mt-1 text-[12px] text-slate-400">{run.id}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {run.status} · {run.strategy}
                  </div>
                  <div className="text-sm text-slate-400">{formatDate(run.finishedAt || run.queuedAt, language)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="No crawl runs have been recorded yet." />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recovery proof artifacts"
        description="These artifacts show that queue smoke, sync-to-draft, and recovery drills have been exercised outside the UI."
      >
        {data?.recovery.proofArtifacts.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {data.recovery.proofArtifacts.map((artifact) => (
              <div key={artifact.key} className="border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{artifact.label}</div>
                  <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${artifact.available ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.05] text-slate-300'}`}>
                    {artifact.available ? 'Available' : 'Missing'}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-slate-400">{artifact.fileName}</div>
                <div className="mt-2 text-[12px] text-slate-500">
                  Updated {formatDate(artifact.updatedAt, language)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel message="No recovery artifacts are available yet." />
        )}
      </SectionCard>
    </div>
  )
}
