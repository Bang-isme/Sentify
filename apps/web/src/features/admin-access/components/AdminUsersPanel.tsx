import { useEffect, useMemo, useState } from 'react'
import {
  getAdminUserDetail,
  listAdminUsers,
  triggerAdminUserPasswordReset,
  updateAdminUserRole,
  type AccountState,
  type AdminUserDetailResponse,
  type AdminUserListResponse,
} from '../../../lib/api'
import { AdminCard, AdminBadge, AdminButton, AdminStatusMessage, AdminDataCell } from '../../admin-shell/components/AdminPrimitives'

interface AdminUsersPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value)
}

function formatDate(value: string | null, language: string) {
  if (!value) {
    return language.startsWith('vi') ? 'Chưa có' : 'Never'
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function stateTone(state: AccountState) {
  return state === 'LOCKED' ? 'danger' : 'success'
}

export function AdminUsersPanel({ language, refreshKey, onSessionExpiry }: AdminUsersPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [query, setQuery] = useState({
    search: '',
    role: '',
    accountState: '',
  })
  const [directory, setDirectory] = useState<AdminUserListResponse | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminUserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  async function loadDirectory() {
    setLoading(true)
    setError(null)

    try {
      const nextDirectory = await listAdminUsers({
        search: query.search || undefined,
        role: (query.role || undefined) as 'USER' | 'ADMIN' | undefined,
        accountState: (query.accountState || undefined) as AccountState | undefined,
      })

      setDirectory(nextDirectory)
      setSelectedUserId((current) =>
        current && nextDirectory.users.some((user) => user.id === current)
          ? current
          : nextDirectory.users[0]?.id ?? null,
      )
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(nextError instanceof Error ? nextError.message : isVietnamese ? 'Không thể tải danh sách người dùng.' : 'Unable to load users.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDirectory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null)
      return
    }

    const userId = selectedUserId
    let cancelled = false

    async function loadDetail() {
      setDetailLoading(true)

      try {
        const nextDetail = await getAdminUserDetail(userId)

        if (!cancelled) {
          setDetail(nextDetail)
        }
      } catch (nextError) {
        if (!cancelled && !onSessionExpiry(nextError)) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : isVietnamese
                ? 'Không thể tải chi tiết người dùng.'
                : 'Unable to load user detail.',
          )
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [onSessionExpiry, selectedUserId, isVietnamese])

  const selectedSummary = useMemo(
    () => directory?.users.find((user) => user.id === selectedUserId) ?? null,
    [directory, selectedUserId],
  )

  async function handleRoleChange(nextRole: 'USER' | 'ADMIN') {
    if (!selectedUserId) {
      return
    }

    setActionMessage(null)
    setDetailLoading(true)

    try {
      const nextDetail = await updateAdminUserRole(selectedUserId, {
        role: nextRole,
      })
      setDetail(nextDetail)
      setActionMessage(
        isVietnamese ? `Đã đổi vai trò sang ${nextRole}.` : `Role updated to ${nextRole}.`,
      )
      await loadDirectory()
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Không thể cập nhật vai trò.'
              : 'Unable to update role.',
        )
      }
    } finally {
      setDetailLoading(false)
    }
  }

  async function handlePasswordReset() {
    if (!selectedUserId) {
      return
    }

    setActionMessage(null)

    try {
      const result = await triggerAdminUserPasswordReset(selectedUserId)
      setActionMessage(result.message)
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Không thể gửi yêu cầu đặt lại mật khẩu.'
              : 'Unable to trigger password reset.',
        )
      }
    }
  }

  return (
    <div data-testid="admin-users-screen" className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
      <AdminCard
        title={isVietnamese ? 'Quản lý người dùng' : 'User access administration'}
        description={
          isVietnamese
            ? 'Kiểm tra trạng thái tài khoản, phạm vi truy cập và hoạt động gần đây trước khi thay đổi quyền.'
            : 'Manage the internal two-role model, inspect account status, and drill into each user before changing access.'
        }
        className="h-full"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_160px_180px_auto]">
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isVietnamese ? 'Tìm kiếm' : 'Search'}</span>
            <input
              data-testid="admin-users-search-input"
              value={query.search}
              onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
              placeholder={isVietnamese ? 'Tìm theo tên/email' : 'Name or email'}
              type="text"
            />
          </label>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isVietnamese ? 'Vai trò' : 'Role'}</span>
            <select
              value={query.role}
              onChange={(event) => setQuery((current) => ({ ...current, role: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            >
              <option value="">{isVietnamese ? 'Tất cả' : 'All roles'}</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isVietnamese ? 'Trạng thái' : 'State'}</span>
            <select
              value={query.accountState}
              onChange={(event) =>
                setQuery((current) => ({ ...current, accountState: event.target.value }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            >
              <option value="">{isVietnamese ? 'Tất cả' : 'All states'}</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </label>
          <div className="flex items-end">
            <AdminButton
              variant="secondary"
              onClick={() => void loadDirectory()}
              dataTestId="admin-users-refresh-button"
            >
              {isVietnamese ? 'Làm mới' : 'Refresh'}
            </AdminButton>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <AdminDataCell label={isVietnamese ? 'Hiển thị' : 'Visible'} value={formatCount(directory?.summary.visibleUsers ?? 0, language)} />
          <AdminDataCell label={isVietnamese ? 'Quản trị' : 'Admins'} value={formatCount(directory?.summary.adminCount ?? 0, language)} />
          <AdminDataCell label={isVietnamese ? 'Người dùng' : 'Users'} value={formatCount(directory?.summary.userCount ?? 0, language)} />
          <AdminDataCell label={isVietnamese ? 'Đang khóa' : 'Locked'} value={formatCount(directory?.summary.lockedUserCount ?? 0, language)} />
        </div>

        {error ? <div className="mt-5"><AdminStatusMessage tone="error">{error}</AdminStatusMessage></div> : null}
        {loading ? (
          <div className="mt-5 text-sm text-slate-500 dark:text-zinc-400">
            {isVietnamese ? 'Đang tải danh sách người dùng...' : 'Loading users...'}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {directory?.users.length ? (
            directory.users.map((user) => {
              const active = user.id === selectedUserId

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  data-testid={`admin-user-row-${user.id}`}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-indigo-500/30 bg-indigo-50/50 ring-1 ring-indigo-500/20 dark:border-white/20 dark:bg-white/10 dark:ring-white/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-[#18181b] dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                    <div>
                      <div className="text-[14px] font-bold text-slate-900 dark:text-white">{user.fullName}</div>
                      <div className="text-[13px] text-slate-500 dark:text-zinc-400">{user.email}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge label={user.accountState} tone={stateTone(user.accountState)} />
                      <AdminBadge label={user.role} tone="neutral" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12px] text-slate-500 dark:text-zinc-400">
                    <span>
                      {formatCount(user.restaurantCount, language)} {isVietnamese ? 'liên kết' : 'memberships'}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {formatCount(user.activeSessionCount, language)} {isVietnamese ? 'phiên' : 'sessions'}
                    </span>
                    <span>&bull;</span>
                    <span>{formatDate(user.lastLoginAt, language)}</span>
                  </div>
                </button>
              )
            })
          ) : !loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese
                ? 'Không có người dùng nào khớp bộ lọc hiện tại.'
                : 'No users match the current filters.'}
            </div>
          ) : null}
        </div>
      </AdminCard>

      <AdminCard
        className="h-full"
        title={selectedSummary ? selectedSummary.fullName : isVietnamese ? 'Chi tiết người dùng' : 'User detail'}
        description={
          isVietnamese
            ? 'Xem phạm vi truy cập, trạng thái bảo mật và hoạt động gần đây trước khi thay đổi tài khoản.'
            : 'Inspect memberships, security posture, and recent admin-facing activity before changing the account.'
        }
      >
        {actionMessage ? (
          <div data-testid="admin-user-action-message">
            <AdminStatusMessage tone="success">{actionMessage}</AdminStatusMessage>
          </div>
        ) : null}
        {detailLoading ? (
          <div className="text-sm text-slate-500 dark:text-zinc-400">
            {isVietnamese ? 'Đang tải chi tiết người dùng...' : 'Loading user detail...'}
          </div>
        ) : detail ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-4">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  {isVietnamese ? 'Chính sách vai trò' : 'Role policy'}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-zinc-300">
                  {detail.user.roleChangePolicy}
                </div>
              </div>
              {detail.user.canEditRole ? (
                <div className="flex flex-wrap gap-3">
                  <AdminButton
                    variant="primary"
                    onClick={() => void handleRoleChange(detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                    dataTestId="admin-user-toggle-role-button"
                  >
                    {isVietnamese
                      ? `Chuyển sang ${detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN'}`
                      : `Set to ${detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN'}`}
                  </AdminButton>
                  <AdminButton
                    variant="secondary"
                    onClick={() => void handlePasswordReset()}
                    dataTestId="admin-user-password-reset-button"
                  >
                    {isVietnamese ? 'Gửi yêu cầu reset mật khẩu' : 'Send password reset'}
                  </AdminButton>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminDataCell label={isVietnamese ? 'Phiên hoạt động' : 'Sessions'} value={formatCount(detail.security.activeSessionCount, language)} />
              <AdminDataCell label={isVietnamese ? 'Yêu cầu reset' : 'Pending resets'} value={formatCount(detail.security.pendingPasswordResetCount, language)} />
              <AdminDataCell label={isVietnamese ? 'Đăng nhập lỗi' : 'Failed logins'} value={formatCount(detail.security.failedLoginCount, language)} />
              <AdminDataCell label={isVietnamese ? 'Lần cuối' : 'Last login'} value={<span className="text-[14px]">{formatDate(detail.security.lastLoginAt, language)}</span>} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  {isVietnamese ? 'Liên kết nhà hàng' : 'Restaurant memberships'}
                </div>
                {detail.memberships.length ? (
                  <div className="grid gap-2">
                    {detail.memberships.map((membership) => (
                      <div key={membership.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{membership.restaurant.name}</div>
                        <div className="mt-1 text-[12px] text-slate-500 dark:text-zinc-400">{membership.restaurant.address || membership.restaurant.slug}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[13px] text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
                    {isVietnamese
                      ? 'Chưa gắn với nhà hàng nào.'
                      : 'No memberships.'}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  {isVietnamese ? 'Hoạt động hệ thống' : 'Recent activity'}
                </div>
                {detail.recentIntakeBatches.length || detail.recentCrawlRuns.length ? (
                  <div className="grid gap-2">
                    {detail.recentIntakeBatches.map((batch) => (
                      <div key={batch.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm text-sm text-slate-600 dark:border-white/10 dark:bg-[#18181b] dark:text-zinc-300">
                        {isVietnamese ? 'Lô' : 'Batch'}{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{batch.title || batch.id}</span>{' '}
                        {isVietnamese ? 'cho' : 'for'} {batch.restaurant.name}
                      </div>
                    ))}
                    {detail.recentCrawlRuns.map((run) => (
                      <div key={run.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm text-sm text-slate-600 dark:border-white/10 dark:bg-[#18181b] dark:text-zinc-300">
                        Crawl{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{run.id}</span>{' '}
                        {isVietnamese ? 'hoàn tất:' : 'finished:'} {run.status}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[13px] text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
                    {isVietnamese
                      ? 'Chưa có hoạt động.'
                      : 'No recent activity.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center">
            <div className="text-sm text-slate-500 dark:text-zinc-400">
              {isVietnamese
                ? 'Chọn một người dùng để xem quyền truy cập và hoạt động.'
                : 'Select a user to inspect access and activity.'}
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  )
}
