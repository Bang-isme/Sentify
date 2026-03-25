import { useEffect, useState } from 'react'
import {
  createAdminMembership,
  deleteAdminMembership,
  listAdminMemberships,
  type AdminMembershipListResponse,
} from '../../../lib/api'
import { EmptyPanel, SectionCard, StatusMessage } from '../../../components/product/workspace/shared'

interface AdminMembershipsPanelProps {
  language: string
  refreshKey: number
  onSessionExpiry: (error: unknown) => boolean
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value)
}

export function AdminMembershipsPanel({
  language,
  refreshKey,
  onSessionExpiry,
}: AdminMembershipsPanelProps) {
  const isVietnamese = language.startsWith('vi')
  const [data, setData] = useState<AdminMembershipListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [formState, setFormState] = useState({
    userId: '',
    restaurantId: '',
  })

  async function loadMemberships() {
    setLoading(true)
    setError(null)

    try {
      const nextData = await listAdminMemberships()
      setData(nextData)
      setFormState((current) => ({
        userId: current.userId || nextData.users[0]?.id || '',
        restaurantId: current.restaurantId || nextData.restaurants[0]?.id || '',
      }))
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Không thể tải dữ liệu thành viên.'
              : 'Unable to load memberships.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMemberships()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleCreateMembership() {
    if (!formState.userId || !formState.restaurantId) {
      return
    }

    setActionMessage(null)

    try {
      const result = await createAdminMembership(formState)
      setActionMessage(
        isVietnamese
          ? `Đã gắn ${result.membership.user.fullName} với ${result.membership.restaurant.name}.`
          : `${result.membership.user.fullName} linked to ${result.membership.restaurant.name}.`,
      )
      await loadMemberships()
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Không thể tạo liên kết nhà hàng.'
              : 'Unable to create membership.',
        )
      }
    }
  }

  async function handleDeleteMembership(membershipId: string) {
    setActionMessage(null)

    try {
      const result = await deleteAdminMembership(membershipId)
      setActionMessage(
        isVietnamese
          ? `Đã gỡ ${result.membership.user.fullName} khỏi ${result.membership.restaurant.name}.`
          : `${result.membership.user.fullName} removed from ${result.membership.restaurant.name}.`,
      )
      await loadMemberships()
    } catch (nextError) {
      if (!onSessionExpiry(nextError)) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : isVietnamese
              ? 'Không thể xóa liên kết.'
              : 'Unable to delete membership.',
        )
      }
    }
  }

  return (
    <div data-testid="admin-memberships-screen" className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <SectionCard
        title={isVietnamese ? 'Bản đồ liên kết nhà hàng' : 'Membership mapping'}
        description={
          isVietnamese
            ? 'Gán tài khoản USER vào nhà hàng để kiểm soát phạm vi nhìn thấy trong ứng dụng merchant.'
            : 'Manage the restaurant graph for USER accounts and verify which restaurants are visible to each merchant account.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Liên kết' : 'Memberships'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(data?.summary.totalMemberships ?? 0, language)}
            </div>
          </div>
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Tài khoản USER' : 'USER accounts'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(data?.summary.userCount ?? 0, language)}
            </div>
          </div>
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Nhà hàng' : 'Restaurants'}
            </div>
            <div className="mt-2 text-[1.2rem] font-semibold text-white">
              {formatCount(data?.summary.restaurantCount ?? 0, language)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="grid gap-2 text-sm text-slate-300">
            <span className="font-medium text-white">{isVietnamese ? 'Tài khoản USER' : 'USER account'}</span>
            <select
              value={formState.userId}
              onChange={(event) => setFormState((current) => ({ ...current, userId: event.target.value }))}
              className="h-11 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              {data?.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.restaurantCount})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            <span className="font-medium text-white">{isVietnamese ? 'Nhà hàng' : 'Restaurant'}</span>
            <select
              value={formState.restaurantId}
              onChange={(event) =>
                setFormState((current) => ({ ...current, restaurantId: event.target.value }))
              }
              className="h-11 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-sky-400/40"
            >
              {data?.restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} ({restaurant.memberCount})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleCreateMembership()}
              className="inline-flex h-11 items-center justify-center border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:border-sky-400/35 hover:bg-sky-400/15"
            >
              {isVietnamese ? 'Gán thành viên' : 'Add membership'}
            </button>
          </div>
        </div>

        {actionMessage ? <div className="mt-4"><StatusMessage>{actionMessage}</StatusMessage></div> : null}
        {error ? <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
        {loading ? (
          <div className="mt-4">
            <StatusMessage>{isVietnamese ? 'Đang tải danh sách liên kết...' : 'Loading memberships...'}</StatusMessage>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {data?.memberships.length ? (
            data.memberships.map((membership) => (
              <div
                key={membership.id}
                className="grid gap-3 border border-white/8 bg-white/[0.03] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <div>
                  <div className="text-[13px] font-semibold text-white">{membership.user.fullName}</div>
                  <div className="mt-1 text-[12px] text-slate-400">{membership.user.email}</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{membership.restaurant.name}</div>
                  <div className="mt-1 text-[12px] text-slate-400">
                    {membership.restaurant.address || membership.restaurant.slug}
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => void handleDeleteMembership(membership.id)}
                    className="inline-flex h-10 items-center justify-center border border-white/12 bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-100"
                  >
                    {isVietnamese ? 'Gỡ' : 'Remove'}
                  </button>
                </div>
              </div>
            ))
          ) : !loading ? (
            <EmptyPanel
              message={
                isVietnamese
                  ? 'Chưa có liên kết nào. Gán một tài khoản USER vào nhà hàng để bắt đầu flow merchant.'
                  : 'No memberships exist yet. Assign a USER to a restaurant to start the merchant flow.'
              }
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={isVietnamese ? 'Tổng quan phạm vi' : 'Coverage view'}
        description={
          isVietnamese
            ? 'Đối chiếu người dùng và nhà hàng để kiểm tra phạm vi hiển thị trước khi xử lý quyền.'
            : 'See both sides of the graph so admin can reason about account scope before debugging merchant-facing visibility.'
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Người dùng' : 'Users'}
            </div>
            <div className="grid gap-2">
              {data?.users.length ? (
                data.users.map((user) => (
                  <div key={user.id} className="border border-white/8 bg-white/[0.03] p-3">
                    <div className="text-[13px] font-semibold text-white">{user.fullName}</div>
                    <div className="mt-1 text-[12px] text-slate-400">{user.email}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {formatCount(user.restaurantCount, language)} {isVietnamese ? 'liên kết' : 'memberships'}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel message={isVietnamese ? 'Chưa có tài khoản USER nào.' : 'No USER accounts are available.'} />
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {isVietnamese ? 'Nhà hàng' : 'Restaurants'}
            </div>
            <div className="grid gap-2">
              {data?.restaurants.length ? (
                data.restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="border border-white/8 bg-white/[0.03] p-3">
                    <div className="text-[13px] font-semibold text-white">{restaurant.name}</div>
                    <div className="mt-1 text-[12px] text-slate-400">
                      {restaurant.address || restaurant.slug}
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {formatCount(restaurant.memberCount, language)} {isVietnamese ? 'thành viên' : 'members'}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel
                  message={
                    isVietnamese
                      ? 'Chưa có nhà hàng nào để gán thành viên.'
                      : 'No restaurants are available for membership assignment.'
                  }
                />
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
