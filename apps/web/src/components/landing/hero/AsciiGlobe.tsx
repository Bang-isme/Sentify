import { memo, useEffect, useMemo, useState } from 'react'
import { buildSphereLayers } from './asciiGlobeEngine'
import { GlobeInsightCards } from './GlobeInsightCards'

const REDUCED_DELAY = 260
const DEFAULT_DELAY = 110
const LOW_POWER_DELAY = 140

function getAnimationDelay(reducedMotion: boolean): number {
  if (reducedMotion) return REDUCED_DELAY
  const cores = navigator.hardwareConcurrency ?? 8
  return cores <= 4 ? LOW_POWER_DELAY : DEFAULT_DELAY
}

export const AsciiGlobe = memo(function AsciiGlobe() {
  const [sphereTick, setSphereTick] = useState(0)

  const sphere = useMemo(() => {
    return buildSphereLayers(sphereTick * 0.085, sphereTick)
  }, [sphereTick])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = mediaQuery.matches
    let intervalId: number | null = null

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const start = () => {
      stop()
      if (document.hidden) return
      intervalId = window.setInterval(() => {
        setSphereTick((prev) => prev + 1)
      }, getAnimationDelay(reducedMotion))
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        setSphereTick((prev) => prev + 1)
      }
      start()
    }

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      start()
    }

    start()
    document.addEventListener('visibilitychange', handleVisibility)
    mediaQuery.addEventListener('change', handleMotionChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
      mediaQuery.removeEventListener('change', handleMotionChange)
    }
  }, [])

  return (
    <div className="hero-globe-pane" aria-hidden>
      <div className="hero-globe-viewport">
        <div className="globe-data-stream globe-data-stream-1"></div>
        <div className="globe-data-stream globe-data-stream-2"></div>
        <div className="globe-data-stream globe-data-stream-3"></div>

        <div className="hero-globe-round">
          <div className="globe-cinema-rig">
            <div className="globe-stage globe-stage-right">
              <div className="globe-shell">
                <div className="globe-depth-halo"></div>
                <div className="globe-scan-ring globe-scan-ring-1"></div>
                <div className="globe-scan-ring globe-scan-ring-2"></div>
                <div className="globe-scan-ring globe-scan-ring-3"></div>

                <div className="ascii-sphere-wrapper">
                  <pre className="ascii-sphere-layer ascii-sphere-shadow">{sphere.shadow}</pre>
                  <pre className="ascii-sphere-layer ascii-sphere-body">{sphere.body}</pre>
                  <pre className="ascii-sphere-layer ascii-sphere-land">{sphere.land}</pre>
                  <pre className="ascii-sphere-layer ascii-sphere-cloud">{sphere.cloud}</pre>
                  <pre className="ascii-sphere-layer ascii-sphere-wire">{sphere.wire}</pre>
                  <pre className="ascii-sphere-layer ascii-sphere-rim">{sphere.rim}</pre>
                </div>

                <GlobeInsightCards />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

