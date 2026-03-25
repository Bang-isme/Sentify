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
        className={`flex w-full items-center justify-between rounded-[0.72rem] border border-border-light/80 bg-bg-light/75 px-3 text-left transition hover:border-primary/35 hover:bg-primary/6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-border-dark dark:bg-bg-dark/55 ${
          compact ? 'py-2.5' : 'py-3'
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div>
          <div className="text-[14px] font-bold text-text-charcoal dark:text-white">
            {currentRestaurant.name}
          </div>
          {!compact ? (
            <div className="mt-1 text-[13px] text-text-silver-light dark:text-text-silver-dark">
              {copy.restaurantSwitcherHint}
            </div>
          ) : null}
        </div>
        <span
          className={`material-symbols-outlined text-base text-text-silver-light transition-transform duration-200 dark:text-text-silver-dark ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      <div
        className={`grid overflow-hidden rounded-[0.72rem] border border-border-light/80 bg-surface-white/96 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-200 dark:border-border-dark dark:bg-surface-dark/96 ${
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
              className={`flex w-full items-center justify-between rounded-[0.65rem] px-3 py-2.5 text-left transition ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-charcoal hover:bg-primary/6 dark:text-white dark:hover:bg-white/5'
              }`}
              onClick={() => {
                onSelectRestaurant(restaurant.id)
                setIsOpen(false)
              }}
            >
              <span className="font-semibold">{restaurant.name}</span>
              {isActive ? <span className="material-symbols-outlined text-base">check</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
