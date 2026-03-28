import { useEffect, useRef, useState } from 'react'
import type { RestaurantMembership } from '../../../lib/api'
import type { ProductUiCopy } from '../../../content/productUiCopy'

interface RestaurantSwitcherProps {
  copy: ProductUiCopy['app']
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  onSelectRestaurant: (restaurantId: string) => void
  showLabel?: boolean
  compact?: boolean
}

export function RestaurantSwitcher({
  copy,
  restaurants,
  currentRestaurant,
  onSelectRestaurant,
  showLabel = true,
  compact = false,
}: RestaurantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!currentRestaurant) {
    return null
  }

  if (restaurants.length <= 1) {
    return (
      <div>
        {showLabel ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherLabel}
            </div>
            <div className="mt-3 text-base font-bold text-text-charcoal dark:text-white">
              {currentRestaurant.name}
            </div>
          </>
        ) : null}
        <div className="mt-2 text-sm leading-6 text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherReadonly}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {showLabel ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-silver-light dark:text-text-silver-dark">
          {copy.restaurantSwitcherLabel}
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group/switcher flex w-full min-w-0 items-center justify-start px-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          compact
            ? 'rounded-xl bg-slate-50/50 hover:bg-slate-100 dark:bg-transparent dark:hover:bg-white/[0.06] py-2.5'
            : 'rounded-[0.72rem] border border-border-light/80 bg-bg-light/75 hover:border-primary/35 hover:bg-primary/6 dark:border-border-dark dark:bg-bg-dark/55'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="material-symbols-outlined text-[20px] shrink-0 text-text-charcoal dark:text-white mr-3">
          storefront
        </span>
        <div className="min-w-0 flex-1 pr-3 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300">
          <div className="text-[14px] font-bold text-text-charcoal dark:text-white truncate">
            {currentRestaurant.name}
          </div>
          {!compact ? (
            <div className="mt-1 text-[13px] text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherHint}
            </div>
          ) : null}
        </div>
        <span
          className={`material-symbols-outlined text-base text-text-silver-light transition-all duration-300 dark:text-text-silver-dark opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      <div
        className={`grid overflow-hidden border shadow-[0_16px_36px_-24px_rgba(0,0,0,0.4)] backdrop-blur-3xl transition-all duration-200 ${
          compact
            ? 'rounded-xl border-slate-200 bg-white/95 dark:border-white/[0.08] dark:bg-[#0e0e11]/95'
            : 'rounded-xl border-slate-200 bg-white/95 dark:border-white/[0.08] dark:bg-[#0e0e11]/95'
        } ${
          isOpen
            ? 'mt-2.5 max-h-80 p-1.5 opacity-100'
            : 'pointer-events-none mt-0 max-h-0 p-0 opacity-0'
        }`}
        role="listbox"
        aria-label={copy.restaurantSwitcherLabel}
      >
        {restaurants.map((restaurant) => {
          const isActive = restaurant.id === currentRestaurant.id

          return (
            <button
              key={restaurant.id}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`flex w-full min-w-0 items-center justify-between rounded-lg px-3 py-2.5 text-left transition gap-3 ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-medium dark:bg-white/[0.08] dark:text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-100'
              }`}
              onClick={() => {
                onSelectRestaurant(restaurant.id)
                setIsOpen(false)
              }}
            >
              <span className="truncate font-semibold">{restaurant.name}</span>
              {isActive ? <span className="material-symbols-outlined text-base shrink-0">check</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
