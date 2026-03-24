import { useLanguage } from '../../contexts/languageContext'

export function Footer() {
  const { copy } = useLanguage()

  return (
    <footer className="border-t border-border-light bg-surface-ticker-light pt-16 pb-8 dark:border-border-dark dark:bg-surface-footer-dark">
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="mb-16 grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-6 flex items-center gap-3">
              <div className="size-6 text-primary">
                <span className="material-symbols-outlined text-2xl">token</span>
              </div>
              <h2 className="text-lg font-bold text-text-charcoal dark:text-white">{copy.header.brand}</h2>
            </div>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-text-silver-light dark:text-text-silver-dark">
              {copy.footer.description}
            </p>
            <div className="flex gap-4">
              {[
                ['insights', '#dashboard'],
                ['restaurant', '#workflow'],
                ['monitoring', '#signals'],
              ].map(([icon, href]) => (
                <a
                  key={icon}
                  className="text-text-silver-light transition-colors hover:text-primary dark:text-text-silver-dark"
                  href={href}
                >
                  <span className="material-symbols-outlined">{icon}</span>
                </a>
              ))}
            </div>
          </div>

          {copy.footer.columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-6 font-bold text-text-charcoal dark:text-white">{col.title}</h4>
              <ul className="space-y-4 text-sm text-text-silver-light dark:text-text-silver-dark">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a className="transition-colors hover:text-primary" href={href}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-light pt-8 text-xs text-text-silver-light dark:border-border-dark dark:text-text-silver-dark md:flex-row">
          <p>{copy.footer.bottomLeft}</p>
          <p>{copy.footer.bottomRight}</p>
        </div>
      </div>
    </footer>
  )
}
