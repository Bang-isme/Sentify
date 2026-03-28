import { useEffect, useState } from 'react'
import {
  getAdminIntegrationsPolicies,
  updateAdminPlatformControls,
  type AdminPlatformControls,
  type AdminIntegrationsPoliciesResponse,
} from '../../../lib/api'
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDataCell,
  AdminStatusMessage,
} from '../../admin-shell/components/AdminPrimitives'

interface AdminIntegrationsPoliciesPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
  onControlsUpdated?: () => void
}

interface RuntimeControlsFormState {
  crawlQueueWritesEnabled: boolean
  crawlMaterializationEnabled: boolean
  intakePublishEnabled: boolean
  note: string
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value)
}

function buildControlsForm(controls: AdminPlatformControls | null): RuntimeControlsFormState {
  return {
    crawlQueueWritesEnabled: controls?.crawlQueueWritesEnabled ?? true,
    crawlMaterializationEnabled: controls?.crawlMaterializationEnabled ?? true,
    intakePublishEnabled: controls?.intakePublishEnabled ?? true,
    note: controls?.note ?? '',
  }
}

export function AdminIntegrationsPoliciesPanel({
  language,
  refreshKey,
  onSessionExpiry,
  onControlsUpdated,
}: AdminIntegrationsPoliciesPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [data, setData] = useState<AdminIntegrationsPoliciesResponse | null>(null)
  const [controlsForm, setControlsForm] = useState<RuntimeControlsFormState>(() =>
    buildControlsForm(null),
  )
  const [controlsPending, setControlsPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const runtimeControls = data?.policies.runtimeControls ?? null
  const controlsDirty = runtimeControls
    ? controlsForm.crawlQueueWritesEnabled !== runtimeControls.crawlQueueWritesEnabled ||
      controlsForm.crawlMaterializationEnabled !== runtimeControls.crawlMaterializationEnabled ||
      controlsForm.intakePublishEnabled !== runtimeControls.intakePublishEnabled ||
      controlsForm.note.trim() !== (runtimeControls.note ?? '')
    : false

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextData = await getAdminIntegrationsPolicies()
        if (!cancelled) {
          setData(nextData)
          setControlsForm(buildControlsForm(nextData.policies.runtimeControls))
        }
      } catch (nextError) {
        if (!cancelled && !onSessionExpiry(nextError)) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : isVietnamese
                ? 'Khong the tai chinh sach tich hop.'
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
  }, [isVietnamese, onSessionExpiry, refreshKey])

  async function handleSaveControls() {
    if (!runtimeControls) {
      return
    }

    const nextNote = controlsForm.note.trim()
    const input: {
      crawlQueueWritesEnabled?: boolean
      crawlMaterializationEnabled?: boolean
      intakePublishEnabled?: boolean
      note?: string | null
    } = {}

    if (controlsForm.crawlQueueWritesEnabled !== runtimeControls.crawlQueueWritesEnabled) {
      input.crawlQueueWritesEnabled = controlsForm.crawlQueueWritesEnabled
    }

    if (controlsForm.crawlMaterializationEnabled !== runtimeControls.crawlMaterializationEnabled) {
      input.crawlMaterializationEnabled = controlsForm.crawlMaterializationEnabled
    }

    if (controlsForm.intakePublishEnabled !== runtimeControls.intakePublishEnabled) {
      input.intakePublishEnabled = controlsForm.intakePublishEnabled
    }

    if (nextNote !== (runtimeControls.note ?? '')) {
      input.note = nextNote || null
    }

    if (Object.keys(input).length === 0) {
      setActionMessage(
        isVietnamese
          ? 'Khong co thay doi runtime control nao de luu.'
          : 'No runtime control changes to save.',
      )
      return
    }

    setControlsPending(true)
    setActionMessage(null)
    setError(null)

    try {
      const result = await updateAdminPlatformControls(input)

      setData((current) =>
        current
          ? {
              ...current,
              policies: {
                ...current.policies,
                runtimeControls: result.controls,
              },
            }
          : current,
      )
      setControlsForm(buildControlsForm(result.controls))
      setActionMessage(
        isVietnamese ? 'Da cap nhat runtime controls.' : 'Runtime controls updated.',
      )
      onControlsUpdated?.()
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Khong the cap nhat runtime controls.'
              : 'Unable to update runtime controls.',
        )
      }
    } finally {
      setControlsPending(false)
    }
  }

  function handleResetControls() {
    setControlsForm(buildControlsForm(runtimeControls))
    setActionMessage(null)
    setError(null)
  }

  return (
    <div data-testid="admin-integrations-policies-screen" className="grid gap-4">
      <AdminCard
        title={isVietnamese ? 'Tich hop va chinh sach' : 'Integrations and policies'}
        description={
          isVietnamese
            ? 'Giu cac ranh gioi he thong ro rang: 2 vai tro, route tach biet, trang thai tich hop, va runtime controls that su de van hanh.'
            : 'Make the real contract visible to FE: two system roles, strict route boundaries, integration readiness, and live runtime controls.'
        }
      >
        {error ? <AdminStatusMessage tone="error">{error}</AdminStatusMessage> : null}
        {actionMessage ? (
          <div className="mt-4">
            <AdminStatusMessage tone="success">{actionMessage}</AdminStatusMessage>
          </div>
        ) : null}
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-zinc-400">
            {isVietnamese ? 'Dang tai chinh sach va tich hop...' : 'Loading integrations and policies...'}
          </div>
        ) : null}
        {data ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminDataCell
                label={isVietnamese ? 'Vai tro he thong' : 'System roles'}
                value={data.roleModel.systemRoles.join(' / ')}
              />
              <AdminDataCell
                label={isVietnamese ? 'Mo hinh thanh vien' : 'Membership model'}
                value={data.roleModel.restaurantMembershipModel}
              />
              <AdminDataCell
                label={isVietnamese ? 'Duong dan merchant' : 'Merchant base path'}
                value={<span className="break-all">{data.routeBoundary.merchantBasePath}</span>}
              />
              <AdminDataCell
                label={isVietnamese ? 'Duong dan admin' : 'Admin base path'}
                value={<span className="break-all">{data.routeBoundary.adminBasePath}</span>}
              />
            </div>

            <div className="flex flex-col gap-2">
              {data.integrations.map((integration) => (
                <div
                  key={integration.key}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-bold text-slate-900 dark:text-white">
                      {integration.label}
                    </div>
                    <AdminBadge
                      label={integration.status}
                      tone={integration.status === 'READY' ? 'success' : 'neutral'}
                    />
                  </div>
                  <div className="mt-2 break-words text-[13px] leading-6 text-slate-500 dark:text-zinc-400">
                    {integration.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard
        title="Runtime controls"
        description={
          isVietnamese
            ? 'Day la control plane thuc su: admin co the tam dung queue write, draft materialization, hoac publish boundary truoc khi tiep tuc van hanh.'
            : 'This is the live control plane: pause queue writes, draft materialization, or the publish boundary before continuing operations.'
        }
        headerAction={
          runtimeControls ? (
            <AdminBadge
              label={runtimeControls.intakePublishEnabled ? 'Publish open' : 'Publish paused'}
              tone={runtimeControls.intakePublishEnabled ? 'success' : 'warning'}
            />
          ) : undefined
        }
      >
        {runtimeControls ? (
          <div
            data-testid="admin-platform-controls-card"
            className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminDataCell
                label="Queue writes"
                value={runtimeControls.crawlQueueWritesEnabled ? 'Enabled' : 'Paused'}
                secondaryValue={
                  isVietnamese
                    ? 'Cho phep review ops tao crawl jobs moi.'
                    : 'Allows review ops to enqueue new crawl jobs.'
                }
              />
              <AdminDataCell
                label="Materialization"
                value={runtimeControls.crawlMaterializationEnabled ? 'Enabled' : 'Paused'}
                secondaryValue={
                  isVietnamese
                    ? 'Cho phep crawl run tao draft intake batch.'
                    : 'Allows crawl runs to materialize draft intake batches.'
                }
              />
              <AdminDataCell
                label="Publish boundary"
                value={runtimeControls.intakePublishEnabled ? 'Enabled' : 'Paused'}
                secondaryValue={
                  isVietnamese
                    ? 'Cho phep admin publish draft vao dataset live.'
                    : 'Allows admins to publish draft evidence into the live dataset.'
                }
              />
            </div>

            <div className="grid gap-4">
              <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    {isVietnamese ? 'Cho phep queue writes' : 'Allow queue writes'}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-zinc-400">
                    {isVietnamese
                      ? 'Tat muc nay khi can chan review ops tao crawl run moi trong maintenance window.'
                      : 'Turn this off to stop review ops from creating new crawl runs during a maintenance window.'}
                  </p>
                </div>
                <input
                  data-testid="admin-platform-toggle-crawl-queue"
                  type="checkbox"
                  checked={controlsForm.crawlQueueWritesEnabled}
                  onChange={(event) =>
                    setControlsForm((current) => ({
                      ...current,
                      crawlQueueWritesEnabled: event.target.checked,
                    }))
                  }
                  className="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    {isVietnamese ? 'Cho phep materialization' : 'Allow materialization'}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-zinc-400">
                    {isVietnamese
                      ? 'Tat muc nay khi can crawl tiep tuc chay nhung khong duoc tao draft batch moi.'
                      : 'Turn this off to let crawl continue while preventing new draft batches from being materialized.'}
                  </p>
                </div>
                <input
                  data-testid="admin-platform-toggle-materialization"
                  type="checkbox"
                  checked={controlsForm.crawlMaterializationEnabled}
                  onChange={(event) =>
                    setControlsForm((current) => ({
                      ...current,
                      crawlMaterializationEnabled: event.target.checked,
                    }))
                  }
                  className="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                    {isVietnamese ? 'Cho phep publish' : 'Allow publish'}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-zinc-400">
                    {isVietnamese
                      ? 'Tat muc nay de khoa ranh gioi live dataset trong luc van tiep tuc review draft.'
                      : 'Turn this off to lock the live dataset boundary while admins can still review draft evidence.'}
                  </p>
                </div>
                <input
                  data-testid="admin-platform-toggle-publish"
                  type="checkbox"
                  checked={controlsForm.intakePublishEnabled}
                  onChange={(event) =>
                    setControlsForm((current) => ({
                      ...current,
                      intakePublishEnabled: event.target.checked,
                    }))
                  }
                  className="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                <span>{isVietnamese ? 'Operator note' : 'Operator note'}</span>
                <textarea
                  data-testid="admin-platform-note-input"
                  value={controlsForm.note}
                  onChange={(event) =>
                    setControlsForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={240}
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <AdminButton
                  variant="primary"
                  disabled={controlsPending || !controlsDirty}
                  onClick={() => void handleSaveControls()}
                  dataTestId="admin-platform-save-controls"
                >
                  {controlsPending
                    ? isVietnamese
                      ? 'Dang luu...'
                      : 'Saving...'
                    : isVietnamese
                      ? 'Luu runtime controls'
                      : 'Save runtime controls'}
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  disabled={controlsPending || !controlsDirty}
                  onClick={handleResetControls}
                  dataTestId="admin-platform-reset-controls"
                >
                  {isVietnamese ? 'Dat lai thay doi' : 'Reset changes'}
                </AdminButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
            {isVietnamese ? 'Khong co runtime controls de chinh sua.' : 'Runtime controls are unavailable.'}
          </div>
        )}
      </AdminCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
        <AdminCard
          className="h-full"
          title={isVietnamese ? 'Pham vi nguon' : 'Source coverage'}
          description={
            isVietnamese
              ? 'Kiem tra bao nhieu nha hang da co nguon Google Maps va noi nao con thieu.'
              : 'Admin can inspect how many restaurants are linked to Google Maps sources and where intake coverage is still missing.'
          }
        >
          {data ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AdminDataCell
                label={isVietnamese ? 'Nha hang' : 'Restaurants'}
                value={formatCount(data.policies.sourceCoverage.restaurantCount, language)}
              />
              <AdminDataCell
                label={isVietnamese ? 'Nguon' : 'Sources'}
                value={formatCount(data.policies.sourceCoverage.sourceCount, language)}
              />
              <AdminDataCell
                label={isVietnamese ? 'Chua co nguon' : 'Without source'}
                value={formatCount(
                  data.policies.sourceCoverage.restaurantsWithoutSourceCount,
                  language,
                )}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese ? 'Khong co du lieu pham vi nguon.' : 'Coverage data is unavailable.'}
            </div>
          )}
        </AdminCard>

        <AdminCard
          className="h-full"
          title={isVietnamese ? 'Rang buoc moi truong' : 'Environment constraints'}
          description={
            isVietnamese
              ? 'Cac gia tri nay giai thich vi sao local, staging va production co the khac nhau.'
              : 'These values explain why local, staging, and production may behave differently.'
          }
        >
          {data ? (
            <div className="mt-4 flex flex-col gap-2">
              {Object.entries(data.environment).map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#18181b] md:grid-cols-[180px_minmax(0,1fr)] md:items-center"
                >
                  <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                    {key}
                  </div>
                  <div className="break-words text-[13px] text-slate-900 dark:text-white">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese ? 'Khong co thong tin moi truong.' : 'Environment details are unavailable.'}
            </div>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title={isVietnamese ? 'Mac dinh crawl' : 'Crawler defaults'}
        description={
          isVietnamese
            ? 'Cac mac dinh nay anh huong cach admin mo ta review crawl, review ops va hang doi.'
            : 'These defaults influence how review crawl, review ops, and queue behavior should be communicated in admin UX.'
        }
      >
        {data ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.policies.crawlDefaults).map(([key, value]) => (
              <AdminDataCell
                key={key}
                label={key}
                value={<span className="break-words">{String(value)}</span>}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
            {isVietnamese ? 'Khong co mac dinh crawl.' : 'Crawler defaults are unavailable.'}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
