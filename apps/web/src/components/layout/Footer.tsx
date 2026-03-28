import { useLanguage, type Language } from '../../contexts/languageContext'

const footerUi: Record<
  Language,
  {
    subtitle: string
    auxiliaryTitle: string
    actionLabels: [string, string, string]
    bottomNote: string
  }
> = {
  en: {
    subtitle: 'Restaurant Review Curator',
    auxiliaryTitle: 'Trust',
    actionLabels: ['Back to top', 'Open dashboard', 'Trust section'],
    bottomNote: 'Crafted to keep review insights clear and useful.',
  },
  vi: {
    subtitle: 'Điều hướng tín hiệu review',
    auxiliaryTitle: 'Tin cậy',
    actionLabels: ['Lên đầu trang', 'Mở dashboard', 'Xem phần tin cậy'],
    bottomNote: 'Ưu tiên sự rõ ràng, không dựng một nền tảng quá đà.',
  },
  ja: {
    subtitle: 'レストランレビューキュレーター',
    auxiliaryTitle: '信頼',
    actionLabels: ['ページ上部へ', 'ダッシュボードへ', '信頼性セクション'],
    bottomNote: 'レビューインサイトを明確で使いやすい形に整えます。',
  },
}

export function Footer() {
  const { copy, language } = useLanguage()
  const ui = footerUi[language]
  const currentYear = new Date().getFullYear()
  const projectColumn = copy.footer.columns[2]
  const editorialColumns = [
    copy.footer.columns[0],
    {
      title: copy.footer.columns[1]?.title ?? 'Insights',
      links: copy.footer.columns[1]?.links ?? [],
    },
    {
      title: projectColumn?.title ?? 'Project',
      links: projectColumn?.links?.slice(0, 2) ?? [],
    },
    {
      title: ui.auxiliaryTitle,
      links: projectColumn?.links?.slice(2) ?? [],
    },
  ]

  const footerActions = [
    { icon: 'north_west', href: '#overview', label: ui.actionLabels[0] },
    { icon: 'grid_view', href: '#dashboard', label: ui.actionLabels[1] },
    { icon: 'shield', href: '#trust', label: ui.actionLabels[2] },
  ] as const

  return (
    <footer className="bg-white py-8 dark:bg-[#130e0b]">
      <div className="mx-auto max-w-[88rem] px-6 py-10 md:px-8 md:py-12">
        <div className="text-center">
          <h2 className="font-serif text-[clamp(2.6rem,5.2vw,4rem)] font-bold uppercase tracking-[-0.05em] text-[#211914] dark:text-[#fff7ef]">
            {copy.header.brand}
          </h2>

          <div className="mt-2.5 flex items-center justify-center gap-4 md:gap-5">
            <span className="h-px w-10 bg-[#e6d7c4] md:w-16 dark:bg-white/10" />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.28em] text-primary md:text-[0.75rem]">
              {ui.subtitle}
            </span>
            <span className="h-px w-10 bg-[#e6d7c4] md:w-16 dark:bg-white/10" />
          </div>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 xl:mt-14 xl:grid-cols-4 xl:gap-10">
          {editorialColumns.map((column) => (
            <div key={column.title}>
              <h3 className="font-serif text-[1.4rem] leading-none text-[#241c16] dark:text-[#fff7ef] md:text-[1.5rem]">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      className="text-[0.875rem] text-[#6f5b4b] transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#ccb59a] dark:hover:text-[#f3a04d] md:text-[0.9375rem]"
                      href={href}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-[#ede3d6] pt-6 md:flex-row md:items-end md:justify-between dark:border-white/10">
          <div className="flex items-center gap-5">
            {footerActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                aria-label={action.label}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#7b6555] transition-colors hover:bg-[#f7f1e8] hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#ccb59a] dark:hover:bg-white/5 dark:hover:text-[#f3a04d]"
              >
                <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
              </a>
            ))}
          </div>

          <div className="text-left md:text-right">
            <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-[#9f866f] md:text-[0.75rem]">
              © {currentYear} {copy.header.brand.toUpperCase()}. ALL RIGHTS RESERVED.
            </p>
            <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.12em] text-[#b09682] md:text-[0.75rem]">
              {ui.bottomNote}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
