import { useEffect, useState } from 'react'
import { getAdminAudit, type AdminAuditResponse } from '../../../lib/api'
import { EmptyPanel, SectionCard, StatusMessage } from '../../../components/product/workspace/shared'

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
          setError(nextError instanceof Error ? nextError.message : 'Unable to load audit feed.')
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
        title="Audit trail"
        description="Trace publish events, membership assignments, crawl state changes, and system history without leaving the admin shell."
      >
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {loading ? <StatusMessage>Loading audit feed...</StatusMessage> : null}
        {data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Events</div>
              <div className="mt-2 text-[1.2rem] font-semibold text-white">{data.summary.totalEvents}</div>
            </div>
            {Object.entries(data.summary.byAction)
              .slice(0, 3)
              .map(([action, count]) => (
                <div key={action} className="border border-white/8 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{action}</div>
                  <div className="mt-2 text-[1.2rem] font-semibold text-white">{count}</div>
                </div>
              ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Recent events"
        description="A single event stream makes it easier to explain to FE which backend flows already happen and which actor triggered them."
      >
        {data?.items.length ? (
          <div className="grid gap-2">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 border border-white/8 bg-white/[0.03] p-3 lg:grid-cols-[150px_minmax(0,1fr)_minmax(0,220px)]"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.action}</div>
                  <div className="mt-1 text-[12px] text-slate-400">{formatDate(item.timestamp, language)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.summary}</div>
                  <div className="mt-1 text-[12px] text-slate-400">
                    {item.restaurant ? `${item.restaurant.name} · ${item.resourceType}` : item.resourceType}
                  </div>
                </div>
                <div className="text-[12px] text-slate-400">
                  {item.actor ? `${item.actor.fullName} (${item.actor.role})` : 'System event'}
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <EmptyPanel message="No audit events are available yet." />
        ) : null}
      </SectionCard>
    </div>
  )
}
