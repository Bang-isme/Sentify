import {
  adminHubDomains,
  adminHubHomeStats,
  adminHubViewOrder,
  type AdminHubViewKey,
} from '../adminHub.data'

interface AdminHubHomeScreenProps {
  activeView?: AdminHubViewKey
  onNavigate?: (view: AdminHubViewKey) => void
}

function statusTone(status: 'Now' | 'Next') {
  return status === 'Now'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
}

export function AdminHubHomeScreen({ activeView = 'home', onNavigate }: AdminHubHomeScreenProps) {
  return (
    <div className="grid gap-5">
      <section className="border border-white/6 bg-white/[0.03] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              <span className="size-2 bg-current" />
              Admin hub
            </div>
            <h1 className="mt-4 text-[2rem] font-semibold tracking-tight text-[#fff8e0] sm:text-[2.5rem]">
              One admin product, organized into operations, access, and platform.
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#b9b295]">
              All three domains are now wired: Operations for restaurant workflows, Access for identity and
              memberships, and Platform for health, policy, and audit visibility.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {adminHubHomeStats.map((stat) => (
              <div key={stat.label} className="min-w-[108px] border border-white/6 bg-[#15140f] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#a19a81]">{stat.label}</div>
                <div className="mt-2 text-[1.25rem] font-semibold text-[#fff8e0]">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {Object.values(adminHubDomains).map((domain) => (
          <article key={domain.key} className="border border-white/6 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 border border-white/8 bg-white/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9b295]">
                  <span className="material-symbols-outlined text-[15px]">{domain.icon}</span>
                  {domain.eyebrow}
                </div>
                <h2 className="mt-4 text-[1.45rem] font-semibold tracking-tight text-[#fff8e0]">
                  {domain.label}
                </h2>
                <p className="mt-2 text-[13px] leading-6 text-[#b9b295]">{domain.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.(domain.screens[0].key)}
                className="border border-white/8 bg-white/4 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#fff8e0] transition hover:border-primary/25 hover:text-primary"
              >
                Open
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              {domain.screens.map((screen) => {
                const isActive = activeView === screen.key
                return (
                  <button
                    key={screen.key}
                    type="button"
                    onClick={() => onNavigate?.(screen.key)}
                    className={`flex items-start justify-between gap-3 border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-primary/25 bg-primary/10'
                        : 'border-white/6 bg-[#15140f] hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-[#fff8e0]">{screen.label}</span>
                      <span className="mt-1 block text-[12px] leading-6 text-[#b9b295]">{screen.summary}</span>
                    </span>
                    <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${statusTone(screen.status)}`}>
                      {screen.status}
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="border border-white/6 bg-white/[0.03] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a19a81]">
            Route tree
          </div>
          <div className="mt-4 grid gap-3">
            {adminHubViewOrder.map((view) => {
              const isHome = view === 'home'
              const domain =
                view === 'home'
                  ? 'Home'
                  : view.startsWith('operations-')
                    ? 'Operations'
                    : view.startsWith('access-')
                      ? 'Access'
                      : 'Platform'
              return (
                <div
                  key={view}
                  className={`flex items-center justify-between gap-3 border px-3 py-3 ${
                    isHome ? 'border-primary/25 bg-primary/10' : 'border-white/6 bg-[#15140f]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#fff8e0]">{view}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#a19a81]">{domain}</div>
                  </div>
                  <div
                    className={`border px-2 py-1 text-[10px] font-semibold uppercase ${
                      isHome ? statusTone('Now') : statusTone('Now')
                    }`}
                  >
                    {isHome ? 'Entry' : 'Now'}
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="border border-white/6 bg-white/[0.03] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a19a81]">
            Flow notes
          </div>
          <div className="mt-4 grid gap-3 text-[13px] leading-7 text-[#b9b295]">
            <p>
              Login lands in a role-specific shell. `USER` never sees this navigation. `ADMIN` never sees
              merchant screens.
            </p>
            <p>
              Admin now has a full control-plane surface: restaurant operations, user access, and platform
              visibility live in one shell.
            </p>
            <p>
              The layout is intentionally dense and full-bleed, with a collapsible rail instead of oversized
              cards or empty gutters.
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}
