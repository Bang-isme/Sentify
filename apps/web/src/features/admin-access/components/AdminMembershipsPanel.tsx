import { useEffect, useState } from 'react'
import {
  createAdminMembership,
  deleteAdminMembership,
  listAdminMemberships,
  type AdminMembershipListResponse,
} from '../../../lib/api'
import { AdminCard, AdminDataCell, AdminButton, AdminStatusMessage } from '../../admin-shell/components/AdminPrimitives'

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
    <div data-testid="admin-memberships-screen" className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
      <AdminCard
        title={isVietnamese ? 'Bản đồ liên kết nhà hàng' : 'Membership mapping'}
        description={
          isVietnamese
            ? 'Gán tài khoản USER vào nhà hàng để kiểm soát phạm vi nhìn thấy trong ứng dụng merchant.'
            : 'Manage the restaurant graph for USER accounts and verify which restaurants are visible to each merchant account.'
        }
        className="h-full"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminDataCell label={isVietnamese ? 'Liên kết' : 'Memberships'} value={formatCount(data?.summary.totalMemberships ?? 0, language)} />
          <AdminDataCell label={isVietnamese ? 'Tài khoản USER' : 'USER accounts'} value={formatCount(data?.summary.userCount ?? 0, language)} />
          <AdminDataCell label={isVietnamese ? 'Nhà hàng' : 'Restaurants'} value={formatCount(data?.summary.restaurantCount ?? 0, language)} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end">
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isVietnamese ? 'Tài khoản USER' : 'USER account'}</span>
            <select
              data-testid="admin-membership-user-select"
              value={formState.userId}
              onChange={(event) => setFormState((current) => ({ ...current, userId: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            >
              {data?.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.restaurantCount})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isVietnamese ? 'Nhà hàng' : 'Restaurant'}</span>
            <select
              data-testid="admin-membership-restaurant-select"
              value={formState.restaurantId}
              onChange={(event) =>
                setFormState((current) => ({ ...current, restaurantId: event.target.value }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-[#18181b]"
            >
              {data?.restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name} ({restaurant.memberCount})
                </option>
              ))}
            </select>
          </label>
          <AdminButton
            variant="primary"
            onClick={() => void handleCreateMembership()}
            className="w-full lg:w-auto"
            dataTestId="admin-membership-add-button"
          >
            {isVietnamese ? 'Gán thành viên' : 'Add membership'}
          </AdminButton>
        </div>

        {actionMessage ? <div className="mt-5"><AdminStatusMessage tone="success">{actionMessage}</AdminStatusMessage></div> : null}
        {error ? <div className="mt-5"><AdminStatusMessage tone="error">{error}</AdminStatusMessage></div> : null}
        {loading ? (
          <div className="mt-5 text-sm text-slate-500 dark:text-zinc-400">
            {isVietnamese ? 'Đang tải danh sách liên kết...' : 'Loading memberships...'}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {data?.memberships.length ? (
            data.memberships.map((membership) => (
              <div
                key={membership.id}
                data-testid={`admin-membership-row-${membership.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#18181b] grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-slate-900 dark:text-white">{membership.user.fullName}</div>
                  <div className="mt-1 break-words text-[13px] text-slate-500 dark:text-zinc-400">{membership.user.email}</div>
                </div>
                <div className="min-w-0">
                  <div className="break-words text-[14px] font-bold text-slate-900 dark:text-white">{membership.restaurant.name}</div>
                  <div className="mt-1 break-words text-[13px] text-slate-500 dark:text-zinc-400">
                    {membership.restaurant.address || membership.restaurant.slug}
                  </div>
                </div>
                <div className="flex items-start justify-end">
                  <AdminButton
                    variant="danger"
                    onClick={() => void handleDeleteMembership(membership.id)}
                    dataTestId={`admin-membership-remove-${membership.id}`}
                  >
                    {isVietnamese ? 'Gỡ' : 'Remove'}
                  </AdminButton>
                </div>
              </div>
            ))
          ) : !loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
              {isVietnamese
                  ? 'Chưa có liên kết nào. Gán một tài khoản USER vào nhà hàng để bắt đầu flow merchant.'
                  : 'No memberships exist yet. Assign a USER to a restaurant to start the merchant flow.'}
            </div>
          ) : null}
        </div>
      </AdminCard>

      <AdminCard
        title={isVietnamese ? 'Tổng quan phạm vi' : 'Coverage view'}
        description={
          isVietnamese
            ? 'Đối chiếu người dùng và nhà hàng để kiểm tra phạm vi hiển thị trước khi xử lý quyền.'
            : 'See both sides of the graph so admin can reason about account scope before debugging merchant-facing visibility.'
        }
        className="h-full"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              {isVietnamese ? 'Người dùng' : 'Users'}
            </div>
            <div className="flex flex-col gap-2">
              {data?.users.length ? (
                data.users.map((user) => (
                  <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
                    <div className="text-[13px] font-bold text-slate-900 dark:text-white">{user.fullName}</div>
                    <div className="mt-1 break-words text-[12px] text-slate-500 dark:text-zinc-400">{user.email}</div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {formatCount(user.restaurantCount, language)} {isVietnamese ? 'liên kết' : 'memberships'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[13px] text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
                  {isVietnamese ? 'Chưa có tài khoản USER nào.' : 'No USER accounts are available.'}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              {isVietnamese ? 'Nhà hàng' : 'Restaurants'}
            </div>
            <div className="flex flex-col gap-2">
              {data?.restaurants.length ? (
                data.restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
                    <div className="break-words text-[13px] font-bold text-slate-900 dark:text-white">{restaurant.name}</div>
                    <div className="mt-1 break-words text-[12px] text-slate-500 dark:text-zinc-400">
                      {restaurant.address || restaurant.slug}
                    </div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {formatCount(restaurant.memberCount, language)} {isVietnamese ? 'thành viên' : 'members'}
                    </div>
                  </div>
                ))
              ) : (
                 <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[13px] text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-zinc-400">
                  {isVietnamese
                      ? 'Chưa có nhà hàng nào để gán thành viên.'
                      : 'No restaurants are available for membership assignment.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminCard>
    </div>
  )
}
