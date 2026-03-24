import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLanguage } from '../../contexts/languageContext'

const BASE_SCROLL_SPEED = 84
const COMPACT_SCROLL_SPEED = 92

export function MarqueeTicker({ compact = false }: { compact?: boolean }) {
  const { copy } = useLanguage()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)

  const tickerItems = useMemo(() => copy.ticker, [copy.ticker])

  useEffect(() => {
    const element = trackRef.current

    if (!element) {
      return undefined
    }

    const updateWidth = () => {
      const nextWidth = Math.ceil(element.scrollWidth)
      setTrackWidth((current) => (current === nextWidth ? current : nextWidth))
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(element)
    window.addEventListener('resize', updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [tickerItems])

  const durationSeconds = useMemo(() => {
    if (!trackWidth) {
      return compact ? 24 : 28
    }

    const speed = compact ? COMPACT_SCROLL_SPEED : BASE_SCROLL_SPEED
    return Math.max(trackWidth / speed, compact ? 18 : 22)
  }, [compact, trackWidth])

  const marqueeStyle = {
    '--marquee-track-width': `${trackWidth}px`,
    '--marquee-duration': `${durationSeconds.toFixed(2)}s`,
  } as CSSProperties

  return (
    <div
      className={`marquee-ticker overflow-hidden border-y border-border-light/70 bg-surface-ticker-light/90 dark:border-border-dark dark:bg-surface-ticker-dark/90 ${
        compact ? 'py-4' : 'py-5'
      }`}
    >
      <div className="marquee-viewport">
        <div className="marquee-lane" style={marqueeStyle}>
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              ref={copyIndex === 0 ? trackRef : undefined}
              className="marquee-track"
              aria-hidden={copyIndex === 1}
            >
              {tickerItems.map((item, index) => (
                <div
                  key={`${copyIndex}-${item}-${index}`}
                  className="inline-flex items-center gap-3 text-sm font-medium text-text-silver-light dark:text-text-silver-dark"
                >
                  <span className="material-symbols-outlined text-base text-primary">
                    radio_button_checked
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
