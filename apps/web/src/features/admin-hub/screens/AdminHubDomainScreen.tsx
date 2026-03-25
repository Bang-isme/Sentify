import { adminHubDomains, type AdminHubDomainKey, type AdminHubViewKey } from '../adminHub.data'

interface AdminHubDomainScreenProps {
  domainKey: AdminHubDomainKey
  activeView?: AdminHubViewKey
  onNavigate?: (view: AdminHubViewKey) => void
}

function statusTone(status: string) {
  const isNow = status === 'Now' || status === 'Hiện có'

  return isNow
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
}

export function AdminHubDomainScreen({
  domainKey,
  activeView,
  onNavigate,
}: AdminHubDomainScreenProps) {
  const domain = adminHubDomains[domainKey]
  const selectedScreen = domain.screens.find((screen) => screen.key === activeView) ?? domain.screens[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="border border-white/6 bg-white/[0.03] p-5">
        <div className="inline-flex items-center gap-2 border border-white/8 bg-white/4 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9b295]">
          <span className="material-symbols-outlined text-[15px]">{domain.icon}</span>
          {domain.eyebrow}
        </div>
        <h1 className="mt-4 text-[2rem] font-semibold tracking-tight text-[#fff8e0]">{domain.label}</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#b9b295]">{domain.summary}</p>

        <div className="mt-5 grid gap-2">
          {domain.screens.map((screen) => {
            const isActive = screen.key === selectedScreen.key
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
      </section>

      <section className="grid gap-5">
        <article className="border border-white/6 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${statusTone(selectedScreen.status)}`}>
              {selectedScreen.status}
            </span>
            <span className="border border-white/8 bg-white/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9b295]">
              {domain.label}
            </span>
          </div>

          <h2 className="mt-4 text-[1.6rem] font-semibold tracking-tight text-[#fff8e0]">
            {selectedScreen.label}
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#b9b295]">{selectedScreen.summary}</p>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="border border-white/6 bg-[#15140f] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a19a81]">Khi nào dùng màn này</div>
              <div className="mt-2 text-[13px] leading-7 text-[#f4edd8]">{selectedScreen.proof}</div>
            </div>
            <div className="border border-white/6 bg-[#15140f] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a19a81]">Vai trò trong luồng admin</div>
              <div className="mt-2 text-[13px] leading-7 text-[#f4edd8]">{selectedScreen.endpointHint}</div>
            </div>
          </div>
        </article>

        <article className="border border-white/6 bg-white/[0.03] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a19a81]">Khả năng hiện có</div>
          <div className="mt-4 grid gap-2">
            {selectedScreen.capabilities.map((item) => (
              <div key={item} className="flex items-center justify-between border border-white/6 bg-[#15140f] px-3 py-3">
                <span className="text-[13px] text-[#f4edd8]">{item}</span>
                <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
              </div>
            ))}
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Hiện có</div>
            <div className="mt-2 text-[13px] leading-6">
              Backend đã có dữ liệu hoặc thao tác chính cho màn này. FE có thể bám vào contract hiện tại.
            </div>
          </article>
          <article className="border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Kế hoạch</div>
            <div className="mt-2 text-[13px] leading-6">
              IA đã chừa chỗ cho lớp mở rộng tiếp theo, nhưng chưa nên xem là luồng vận hành thật.
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
