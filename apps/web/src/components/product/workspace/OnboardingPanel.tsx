import type { CreateRestaurantInput } from '../../../lib/api'
import type { ProductUiCopy } from '../../../content/productUiCopy'
import { RestaurantSetupForm } from './shared'

export function OnboardingPanel({
  copy,
  createPending,
  onCreateRestaurant,
}: {
  copy: ProductUiCopy['app']
  createPending: boolean
  onCreateRestaurant: (input: CreateRestaurantInput) => Promise<void>
}) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-border-light/70 bg-surface-white/88 p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.32)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/82 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          <span className="size-2 rounded-full bg-primary"></span>
          {copy.onboardingEyebrow}
        </div>
        <h1 className="mt-5 text-[2rem] font-black tracking-tight text-text-charcoal dark:text-white md:text-[2.3rem]">
          {copy.onboardingTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-silver-light dark:text-text-silver-dark">
          {copy.onboardingDescription}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {copy.onboardingSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-[1.4rem] border border-border-light/70 bg-bg-light/70 p-5 dark:border-border-dark dark:bg-bg-dark/55"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                {String(index + 1).padStart(2, '0')}
              </div>
              <p className="mt-3 text-sm leading-7 text-text-charcoal dark:text-white">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <RestaurantSetupForm
        copy={copy}
        pending={createPending}
        actionLabel={copy.createRestaurant}
        title={copy.setupTitle}
        description={copy.setupDescription}
        onSubmit={onCreateRestaurant}
      />
    </div>
  )
}
