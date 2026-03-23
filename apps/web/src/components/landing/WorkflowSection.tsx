import { useLanguage } from '../../contexts/languageContext'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import {
  LANDING_EYEBROW_CLASS,
  LANDING_PANEL_CLASS,
  LANDING_SECTION_ACCENT_CLASS,
  LANDING_SECTION_TITLE_CLASS,
} from './landingVisualSystem'

const workflowPhotos = [
  {
    src: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    alt: 'Warm restaurant interior',
    frameClassName: 'bg-[#20140d]',
    imageClassName: 'object-cover',
  },
  {
    src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    alt: 'Digital dashboard interface',
    frameClassName: 'bg-[#f6efe6]',
    imageClassName: 'object-cover',
  },
  {
    src: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
    alt: 'Artistic plated dish',
    frameClassName: 'bg-[#111111]',
    imageClassName: 'object-cover',
  },
  {
    src: '/images/Review.png',
    alt: 'Analytics dashboard preview',
    frameClassName: 'bg-[#5ea3a5] p-5',
    imageClassName: 'object-contain scale-[0.92]',
  },
] as const

const workflowOffsets = ['xl:pt-[10.5rem]', 'xl:pt-[8rem]', 'xl:pt-[5rem]', 'xl:pt-[2rem]'] as const
const workflowNumberOffsets = [
  '-top-[5.95rem] xl:-top-[6.5rem]',
  '-top-[6.35rem] xl:-top-[6.9rem]',
  '-top-[6.75rem] xl:-top-[7.3rem]',
  '-top-[7.15rem] xl:-top-[7.7rem]',
] as const

export function WorkflowSection() {
  const { copy, language } = useLanguage()
  const { ref, revealClass, revealStyle } = useScrollReveal()
  const isEnglish = language === 'en'

  return (
    <section
      id="workflow"
      className="content-visibility-auto relative overflow-hidden bg-transparent px-5 py-24 md:px-8 lg:px-12 xl:px-16 xl:py-28"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[84rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(243,160,77,0)_0%,rgba(243,160,77,0)_38%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(235,122,28,0.12)_0%,rgba(242,176,77,0.06)_38%,transparent_72%)]" />
      </div>

      <div className="relative mx-auto max-w-[1520px]">
        <div className={`max-w-[64rem] ${revealClass()}`} style={revealStyle(0)}>
          <p className={LANDING_EYEBROW_CLASS}>
            {copy.workflow.eyebrow}
          </p>
          <h2 className={LANDING_SECTION_TITLE_CLASS}>
            <span className="block xl:whitespace-nowrap">{copy.workflow.titleLine1}</span>
            <span className={`${LANDING_SECTION_ACCENT_CLASS} pl-5 sm:pl-7 xl:pl-14 xl:whitespace-nowrap`}>
              {copy.workflow.titleLine2}
            </span>
          </h2>
        </div>

        <div
          ref={ref}
          className="relative mt-14 grid items-start gap-10 md:grid-cols-2 xl:grid-cols-4 xl:gap-5"
        >
          {copy.workflow.steps.map((step, index) => {
            const photo = workflowPhotos[index % workflowPhotos.length]

            return (
              <article
                key={step.step}
                className={`relative ${workflowOffsets[index]} ${revealClass()}`}
                style={revealStyle(index * 110)}
              >
                <div className="relative z-10 px-3 pt-10 xl:px-3">
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute -left-1 z-0 tabular-nums text-[5.1rem] font-bold leading-none tracking-[0.015em] text-primary/11 dark:text-primary/18 sm:text-[5.8rem] xl:-left-2 xl:text-[6.4rem] ${workflowNumberOffsets[index]}`}
                      style={{
                        fontFamily:
                          '"Baskerville", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
                      }}
                    >
                      {step.step}
                    </span>

                    <figure
                      className={`group relative z-10 overflow-hidden ${LANDING_PANEL_CLASS} ${photo.frameClassName} dark:border-border-dark/70`}
                    >
                      <div className="aspect-[4/5] overflow-hidden">
                        <img
                          src={photo.src}
                          alt={photo.alt}
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full transition-transform duration-700 group-hover:scale-[1.03] ${photo.imageClassName}`}
                        />
                      </div>
                    </figure>
                  </div>

                  <div className="mt-4">
                    <h3
                      className={`font-body font-semibold leading-[1.08] tracking-[-0.03em] text-[#2e1d14] dark:text-[#fff7ef] ${
                        isEnglish ? 'max-w-[14ch] text-[1.16rem] xl:text-[1.22rem]' : 'text-[1.22rem] xl:text-[1.3rem]'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`mt-3 max-w-[18rem] leading-6 text-[#7c6a59] dark:text-[#ccb59a] ${
                        isEnglish ? 'text-[0.9rem]' : 'text-[0.93rem]'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}

        </div>
      </div>
    </section>
  )
}
