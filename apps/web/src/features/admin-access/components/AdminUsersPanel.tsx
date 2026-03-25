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
import { EmptyPanel, SectionCard, StatusMessage } from '../../../components/product/workspace/shared'

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
  return state === 'LOCKED'
    ? 'border-red-500/20 bg-red-500/10 text-red-200'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
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
    <div data-testid="admin-users-screen" className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <SectionCard
        title={isVietnamese ? 'Quản lý người dùng' : 'User access administration'}
        description={
          isVietnamese
            ? 'Kiểm tra trạng thái tài khoản, phạm vi truy cập và hoạt động gần đây trước khi thay đổi quyền.'
            : 'Manage the internal two-role model, inspect account status, and drill into each user before changing access.'
        }
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_160px_180px_auto]">
          <label className="grid gap-2 text-sm text-slate-300">
            <span className="font-medium text-white">{isVietnamese ? 'Tìm kiếm' : 'Search'}</span>
            <input
              value={query.search}
              onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value }))}
              className="h-11 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-sky-400/40"
              placeholder={isVietnamese ? 'Tìm theo tên hoặc email' : 'Search by name or email'}
              type="text"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            <span className="font-medium text-white">{isVietnamese ? 'Vai trò' : 'Role'}</span>
            <select
              value={query.role}
              onChange={(event) => setQuery((current) => ({ ...current, role: event.target.value }))}
              className="h-11 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="">{isVietnamese ? 'Tất cả vai trò' : 'All roles'}</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            <span className="font-medium text-white">{isVietnamese ? 'Trạng thái' : 'State'}</span>
            <select
              value={query.accountState}
              onChange={(event) =>
                setQuery((current) => ({ ...current, accountState: event.target.value }))
              }
              className="h-11 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="">{isVietnamese ? 'Tất cả trạng thái' : 'All states'}</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadDirectory()}
              className="inline-flex h-11 items-center justify-center border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-400/35 hover:bg-sky-400/15"
            >
              {isVietnamese ? 'Làm mới danh sách' : 'Refresh users'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Người dùng hiển thị' : 'Visible users'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(directory?.summary.visibleUsers ?? 0, language)}
            </div>
          </div>
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Quản trị viên' : 'Admins'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(directory?.summary.adminCount ?? 0, language)}
            </div>
          </div>
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Người dùng' : 'Users'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(directory?.summary.userCount ?? 0, language)}
            </div>
          </div>
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Đang khóa' : 'Locked'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(directory?.summary.lockedUserCount ?? 0, language)}
            </div>
          </div>
        </div>

        {error ? <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
        {loading ? (
          <div className="mt-4">
            <StatusMessage>{isVietnamese ? 'Đang tải danh sách người dùng...' : 'Loading users...'}</StatusMessage>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {directory?.users.length ? (
            directory.users.map((user) => {
              const active = user.id === selectedUserId

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`grid gap-2 border px-3 py-3 text-left transition ${
                    active
                      ? 'border-sky-400/25 bg-sky-400/10'
                      : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-semibold text-white">{user.fullName}</div>
                      <div className="text-[13px] text-slate-400">{user.email}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${stateTone(user.accountState)}`}>
                        {user.accountState}
                      </span>
                      <span className="border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase text-slate-200">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>
                      {formatCount(user.restaurantCount, language)}{' '}
                      {isVietnamese ? 'liên kết nhà hàng' : 'memberships'}
                    </span>
                    <span>
                      {formatCount(user.activeSessionCount, language)}{' '}
                      {isVietnamese ? 'phiên đang hoạt động' : 'live sessions'}
                    </span>
                    <span>{formatDate(user.lastLoginAt, language)}</span>
                  </div>
                </button>
              )
            })
          ) : !loading ? (
            <EmptyPanel
              message={
                isVietnamese
                  ? 'Không có người dùng nào khớp bộ lọc hiện tại.'
                  : 'No users match the current filters.'
              }
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={selectedSummary ? selectedSummary.fullName : isVietnamese ? 'Chi tiết người dùng' : 'User detail'}
        description={
          isVietnamese
            ? 'Xem phạm vi truy cập, trạng thái bảo mật và hoạt động gần đây trước khi thay đổi tài khoản.'
            : 'Inspect memberships, security posture, and recent admin-facing activity before changing the account.'
        }
      >
        {actionMessage ? <StatusMessage>{actionMessage}</StatusMessage> : null}
        {detailLoading ? (
          <StatusMessage>{isVietnamese ? 'Đang tải chi tiết người dùng...' : 'Loading user detail...'}</StatusMessage>
        ) : detail ? (
          <div className="grid gap-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
              <div className="border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Chính sách vai trò' : 'Role policy'}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{detail.user.roleChangePolicy}</div>
              </div>
              {detail.user.canEditRole ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleRoleChange(detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                    className="inline-flex h-11 items-center justify-center border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-400/35 hover:bg-sky-400/15"
                  >
                    {isVietnamese
                      ? `Đổi vai trò sang ${detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN'}`
                      : `Set role to ${detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN'}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    className="inline-flex h-11 items-center justify-center border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    {isVietnamese ? 'Gửi yêu cầu đặt lại mật khẩu' : 'Send password reset'}
                  </button>
                </>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Phiên' : 'Sessions'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(detail.security.activeSessionCount, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Yêu cầu đặt lại đang chờ' : 'Pending resets'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(detail.security.pendingPasswordResetCount, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Đăng nhập lỗi' : 'Failed logins'}
                </div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">
                  {formatCount(detail.security.failedLoginCount, language)}
                </div>
              </div>
              <div className="border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Lần đăng nhập cuối' : 'Last login'}
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {formatDate(detail.security.lastLoginAt, language)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Liên kết nhà hàng' : 'Restaurant memberships'}
                </div>
                {detail.memberships.length ? (
                  detail.memberships.map((membership) => (
                    <div key={membership.id} className="border border-white/8 bg-white/[0.03] p-3">
                      <div className="text-sm font-semibold text-white">{membership.restaurant.name}</div>
                      <div className="mt-1 text-[12px] text-slate-400">{membership.restaurant.address || membership.restaurant.slug}</div>
                    </div>
                  ))
                ) : (
                  <EmptyPanel
                    message={
                      isVietnamese
                        ? 'Tài khoản này chưa được gắn với nhà hàng nào.'
                        : 'This account has no restaurant memberships.'
                    }
                  />
                )}
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isVietnamese ? 'Hoạt động gần đây' : 'Recent system activity'}
                </div>
                {detail.recentIntakeBatches.length || detail.recentCrawlRuns.length ? (
                  <div className="grid gap-2">
                    {detail.recentIntakeBatches.map((batch) => (
                      <div key={batch.id} className="border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
                        {isVietnamese ? 'Lô nhập liệu' : 'Intake batch'}{' '}
                        <span className="font-semibold text-white">{batch.title || batch.id}</span>{' '}
                        {isVietnamese ? 'cho' : 'for'} {batch.restaurant.name}
                      </div>
                    ))}
                    {detail.recentCrawlRuns.map((run) => (
                      <div key={run.id} className="border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
                        {isVietnamese ? 'Lần crawl' : 'Crawl run'}{' '}
                        <span className="font-semibold text-white">{run.id}</span>{' '}
                        {isVietnamese ? 'kết thúc với trạng thái' : 'finished as'} {run.status}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel
                    message={
                      isVietnamese
                        ? 'Chưa có hoạt động nhập liệu hoặc crawl nào gắn với người dùng này.'
                        : 'No recent intake or crawl activity is linked to this user.'
                    }
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyPanel
            message={
              isVietnamese
                ? 'Chọn một người dùng để xem quyền truy cập và hoạt động.'
                : 'Select a user to inspect access and activity.'
            }
          />
        )}
      </SectionCard>
    </div>
  )
}
