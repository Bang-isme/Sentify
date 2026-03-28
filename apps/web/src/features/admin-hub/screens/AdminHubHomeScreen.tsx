import {
  adminHubDomains,
  adminHubHomeStats,
  type AdminHubDomain,
  type AdminHubViewKey,
} from '../adminHub.data'

interface AdminHubHomeScreenProps {
  activeView?: AdminHubViewKey
  onNavigate?: (view: AdminHubViewKey) => void
}

function statusTone(status: 'Hiện có' | 'Kế hoạch') {
  return status === 'Hiện có'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
}

function DomainCard({
  domain,
  activeView,
  onNavigate,
}: {
  domain: AdminHubDomain
  activeView: AdminHubViewKey
  onNavigate?: (view: AdminHubViewKey) => void
}) {
  return (
    <article className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#18181b]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
            <span className="material-symbols-outlined text-[15px]">{domain.icon}</span>
            {domain.eyebrow}
          </div>
          <h2 className="mt-4 text-[16px] font-bold text-slate-900 dark:text-white">{domain.label}</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-500 dark:text-zinc-400">{domain.summary}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={() => onNavigate?.(domain.screens[0].key)}
        >
          Mở nhóm
        </button>
      </div>

      <div className="grid gap-3 mt-2">
        {domain.screens.map((screen) => {
          const isActive = activeView === screen.key

          return (
            <button
              key={screen.key}
              type="button"
              className={`grid gap-2 rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-indigo-500/30 bg-indigo-50/50 ring-1 ring-indigo-500/20 dark:border-white/20 dark:bg-white/10 dark:ring-white/10'
                  : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/5 dark:bg-[#18181b] dark:hover:bg-white/5'
              }`}
              onClick={() => onNavigate?.(screen.key)}
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white min-w-0">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-indigo-500 dark:text-indigo-400">{screen.icon}</span>
                  <span className="truncate">{screen.label}</span>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${statusTone(screen.status)}`}>
                  {screen.status}
                </span>
              </div>
              <div className="text-[13px] leading-relaxed text-slate-500 dark:text-zinc-400">{screen.summary}</div>
            </button>
          )
        })}
      </div>
    </article>
  )
}

function AttentionCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 text-[14px] leading-relaxed text-slate-900 dark:text-white">{description}</div>
    </div>
  )
}

export function AdminHubHomeScreen({ activeView = 'home', onNavigate }: AdminHubHomeScreenProps) {
  return (
    <div data-testid="admin-home-screen" className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#18181b] xl:col-span-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300">
            <span className="size-2 rounded-full bg-current" />
            Toàn cảnh quản trị
          </div>
          <h1 className="mt-4 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
            Một nơi để nắm vận hành, quyền truy cập và sức khỏe hệ thống
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-500 dark:text-zinc-400">
            Đây là màn mở đầu cho ADMIN. Thay vì nhìn theo module kỹ thuật, bạn nhìn theo ba nhóm
            việc thật: quán nào đang cần xử lý, ai đang có quyền truy cập và hệ thống phía sau đang
            vận hành ra sao.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {adminHubHomeStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{stat.label}</div>
                <div className="mt-2 text-[20px] font-bold text-slate-900 dark:text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#18181b] xl:col-span-2">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Việc cần chú ý hôm nay
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <AttentionCard
              title="Vận hành"
              description="Xem quán nào còn thiếu nguồn, còn batch chờ duyệt hoặc đã sẵn sàng công bố."
            />
            <AttentionCard
              title="Quyền truy cập"
              description="Rà soát tài khoản bị khóa, role chưa đúng hoặc USER chưa được gán vào nhà hàng cần thấy."
            />
            <AttentionCard
              title="Nền tảng"
              description="Kiểm tra API, queue, worker và policy để biết FE đang phản ánh đúng trạng thái backend hay không."
            />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {Object.values(adminHubDomains).map((domain) => (
          <DomainCard
            key={domain.key}
            activeView={activeView}
            domain={domain}
            onNavigate={onNavigate}
          />
        ))}
      </section>
    </div>
  )
}
