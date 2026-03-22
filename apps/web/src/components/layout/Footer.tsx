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
    bottomNote: 'Crafted to keep review insight clear and useful.',
  },
  vi: {
    subtitle: 'The Review Signal Curator',
    auxiliaryTitle: 'Tin cậy',
    actionLabels: ['Lên đầu trang', 'Mở dashboard', 'Xem phần tin cậy'],
    bottomNote: 'Ưu tiên sự rõ ràng, không dựng một nền tảng quá đà.',
  },
  ja: {
    subtitle: 'Restaurant Review Curator',
    auxiliaryTitle: 'Trust',
    actionLabels: ['Back to top', 'Open dashboard', 'Trust section'],
    bottomNote: 'Crafted to keep review insight clear and useful.',
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
    <footer className="bg-white py-10 dark:bg-[#130e0b]">
      <div className="mx-auto max-w-[1500px] px-6 py-12 md:px-10 md:py-16">
        <div className="text-center">
          <h2 className="font-serif text-[clamp(3.2rem,7vw,5.1rem)] font-bold uppercase tracking-[-0.05em] text-[#211914] dark:text-[#fff7ef]">
            {copy.header.brand}
          </h2>

          <div className="mt-3 flex items-center justify-center gap-4 md:gap-6">
            <span className="h-px w-12 bg-[#e6d7c4] md:w-20 dark:bg-white/10" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.32em] text-primary md:text-[13px]">
              {ui.subtitle}
            </span>
            <span className="h-px w-12 bg-[#e6d7c4] md:w-20 dark:bg-white/10" />
          </div>
        </div>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 xl:mt-16 xl:grid-cols-4 xl:gap-12">
          {editorialColumns.map((column) => (
            <div key={column.title}>
              <h3 className="font-serif text-[1.7rem] leading-none text-[#241c16] dark:text-[#fff7ef]">
                {column.title}
              </h3>
              <ul className="mt-7 space-y-4">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      className="text-[15px] text-[#6f5b4b] transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-[#ccb59a] dark:hover:text-[#f3a04d]"
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

        <div className="mt-16 flex flex-col gap-6 border-t border-[#ede3d6] pt-8 md:flex-row md:items-end md:justify-between dark:border-white/10">
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
            <p className="text-[12px] uppercase tracking-[0.24em] text-[#9f866f] md:text-[13px]">
              © {currentYear} {copy.header.brand.toUpperCase()}. ALL RIGHTS RESERVED.
            </p>
            <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#b09682] md:text-[13px]">
              {ui.bottomNote}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
