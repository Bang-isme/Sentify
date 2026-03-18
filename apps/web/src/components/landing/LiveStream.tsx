import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const badgeColors = {
  red: {
    light: 'bg-red-50 text-red-600 border-red-200',
    dark: 'dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  },
  green: {
    light: 'bg-green-50 text-green-600 border-green-200',
    dark: 'dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  },
  blue: {
    light: 'bg-blue-50 text-blue-600 border-blue-200',
    dark: 'dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  },
}

export function LiveStream() {
  const { copy } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const photos = [
    {
      src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=60',
      alt: 'Không gian nhà hàng ấm cúng vào buổi tối',
    },
    {
      src: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=60',
      alt: 'Không gian ăn uống sáng sủa với nhiều ánh sáng tự nhiên',
    },
    {
      src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=60',
      alt: 'Món ăn được bày trí tinh tế trên bàn',
    },
    {
      src: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=60',
      alt: 'Đầu bếp chuẩn bị món ăn trong bếp',
    },
  ]

  return (
    <section
      id="signals"
      className="content-visibility-auto bg-surface-ticker-light py-20 dark:bg-surface-ticker-dark"
    >
      <div className="mx-auto max-w-[1440px] px-6">
        <div className="mb-10 max-w-2xl">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-text-silver-light dark:text-text-silver-dark">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
            {copy.signals.eyebrow}
          </h4>
          <p className="mt-3 text-sm text-text-silver-light dark:text-text-silver-dark">
            {copy.signals.description}
          </p>
        </div>

        <div ref={ref} className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {copy.signals.cards.map((stream, index) => {
            const photo = photos[index % photos.length]
            return (
            <div key={stream.title} className={revealClass()} style={revealStyle(index * 120)}>
              <StreamCard {...stream} imageSrc={photo.src} imageAlt={photo.alt} />
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StreamCard({
  badge,
  icon,
  title,
  description,
  metric,
  imageSrc,
  imageAlt,
}: {
  badge: { text: string; color: 'red' | 'green' | 'blue' } | null
  icon: string
  title: string
  description: string
  metric: string
  imageSrc: string
  imageAlt: string
}) {
  return (
    <div className="group h-full rounded-2xl border border-border-light bg-surface-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-border-dark dark:bg-surface-dark dark:shadow-none dark:hover:shadow-none">
      <div className="relative mb-4 overflow-hidden rounded-xl border border-border-light dark:border-border-dark">
        <img
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          className="h-28 w-full object-cover sm:h-32"
        />
        <div className="absolute left-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm dark:bg-surface-dark/80">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div className="absolute right-3 top-3 rounded-full border border-primary/20 bg-white/90 px-3 py-1 text-sm font-semibold text-primary-dark shadow-sm dark:border-primary/30 dark:bg-surface-dark/80 dark:text-primary">
          {metric}
        </div>
      </div>
      {badge && (
        <div
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${badgeColors[badge.color].light} ${badgeColors[badge.color].dark}`}
        >
          {badge.text}
        </div>
      )}
      <h5 className="mt-3 mb-1 text-lg font-semibold text-text-charcoal transition-colors group-hover:text-primary-dark dark:text-white dark:group-hover:text-primary">
        {title}
      </h5>
      <p className="text-sm leading-relaxed text-text-silver-light dark:text-text-silver-dark">{description}</p>
    </div>
  )
}
