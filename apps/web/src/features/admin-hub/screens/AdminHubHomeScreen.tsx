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
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-400/25 bg-amber-400/10 text-amber-100'
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
    <article className="grid gap-4 rounded-[0.95rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            <span className="material-symbols-outlined text-[15px]">{domain.icon}</span>
            {domain.eyebrow}
          </div>
          <h2 className="mt-3 text-[1.05rem] font-semibold text-white">{domain.label}</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-400">{domain.summary}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-white transition hover:border-sky-400/30 hover:bg-sky-400/10"
          onClick={() => onNavigate?.(domain.screens[0].key)}
        >
          Mở nhóm
        </button>
      </div>

      <div className="grid gap-2">
        {domain.screens.map((screen) => {
          const isActive = activeView === screen.key

          return (
            <button
              key={screen.key}
              type="button"
              className={`grid gap-2 rounded-[0.85rem] border px-3 py-3 text-left transition ${
                isActive
                  ? 'border-sky-500/25 bg-sky-400/10'
                  : 'border-white/8 bg-[#0f1d28] hover:border-white/12 hover:bg-white/[0.04]'
              }`}
              onClick={() => onNavigate?.(screen.key)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <span className="material-symbols-outlined text-[17px] text-sky-300">{screen.icon}</span>
                  <span>{screen.label}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(screen.status)}`}>
                  {screen.status}
                </span>
              </div>
              <div className="text-[12px] leading-6 text-slate-400">{screen.summary}</div>
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
    <div className="rounded-[0.8rem] border border-white/8 bg-[#0f1d28] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-2 text-[13px] font-semibold leading-6 text-white">{description}</div>
    </div>
  )
}

export function AdminHubHomeScreen({ activeView = 'home', onNavigate }: AdminHubHomeScreenProps) {
  return (
    <div data-testid="admin-home-screen" className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <article className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            <span className="size-2 rounded-full bg-current" />
            Toàn cảnh quản trị
          </div>
          <h1 className="mt-3 text-[1.8rem] font-semibold tracking-[-0.03em] text-white">
            Một nơi để nắm vận hành, quyền truy cập và sức khỏe hệ thống
          </h1>
          <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-400">
            Đây là màn mở đầu cho ADMIN. Thay vì nhìn theo module kỹ thuật, bạn nhìn theo ba nhóm
            việc thật: quán nào đang cần xử lý, ai đang có quyền truy cập và hệ thống phía sau đang
            vận hành ra sao.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {adminHubHomeStats.map((stat) => (
              <div key={stat.label} className="rounded-[0.8rem] border border-white/8 bg-[#0f1d28] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{stat.label}</div>
                <div className="mt-2 text-[1.15rem] font-semibold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Việc cần chú ý hôm nay
          </div>
          <div className="mt-4 grid gap-2">
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

      <section className="grid gap-4 xl:grid-cols-3">
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
