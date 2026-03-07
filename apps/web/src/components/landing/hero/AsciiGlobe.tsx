import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { buildSphereLayers } from './asciiGlobeEngine'
import { GlobeInsightCards, type GlobeLayoutMetrics } from './GlobeInsightCards'

const REDUCED_DELAY = 260
const DEFAULT_DELAY = 110
const LOW_POWER_DELAY = 140

function getAnimationDelay(reducedMotion: boolean): number {
  if (reducedMotion) return REDUCED_DELAY
  const cores = navigator.hardwareConcurrency ?? 8
  return cores <= 4 ? LOW_POWER_DELAY : DEFAULT_DELAY
}

function hasMeaningfulLayoutChange(
  previous: GlobeLayoutMetrics | null,
  next: GlobeLayoutMetrics,
): boolean {
  if (!previous) return true

  return (
    Math.abs(previous.shellWidth - next.shellWidth) > 0.5 ||
    Math.abs(previous.shellHeight - next.shellHeight) > 0.5 ||
    Math.abs(previous.sphereLeft - next.sphereLeft) > 0.5 ||
    Math.abs(previous.sphereTop - next.sphereTop) > 0.5 ||
    Math.abs(previous.sphereWidth - next.sphereWidth) > 0.5 ||
    Math.abs(previous.sphereHeight - next.sphereHeight) > 0.5
  )
}

export const AsciiGlobe = memo(function AsciiGlobe() {
  const [sphereTick, setSphereTick] = useState(0)
  const [layoutMetrics, setLayoutMetrics] = useState<GlobeLayoutMetrics | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLPreElement>(null)
  const spherePhase = sphereTick * 0.085

  const sphereState = useMemo(() => {
    try {
      return {
        hasError: false,
        layers: buildSphereLayers(spherePhase, sphereTick),
      }
    } catch {
      return {
        hasError: true,
        layers: null,
      }
    }
  }, [spherePhase, sphereTick])

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

  useEffect(() => {
    const shellNode = shellRef.current
    const bodyNode = bodyRef.current

    if (!shellNode || !bodyNode) return

    let frameId = 0

    const measure = () => {
      frameId = 0

      const shellRect = shellNode.getBoundingClientRect()
      const bodyRect = bodyNode.getBoundingClientRect()

      if (!shellRect.width || !shellRect.height || !bodyRect.width || !bodyRect.height) {
        return
      }

      const nextMetrics: GlobeLayoutMetrics = {
        shellWidth: shellRect.width,
        shellHeight: shellRect.height,
        sphereLeft: bodyRect.left - shellRect.left,
        sphereTop: bodyRect.top - shellRect.top,
        sphereWidth: bodyRect.width,
        sphereHeight: bodyRect.height,
      }

      setLayoutMetrics((previous) =>
        hasMeaningfulLayoutChange(previous, nextMetrics) ? nextMetrics : previous,
      )
    }

    const scheduleMeasure = () => {
      if (frameId !== 0) return
      frameId = window.requestAnimationFrame(measure)
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure)

    resizeObserver.observe(shellNode)
    resizeObserver.observe(bodyNode)
    window.addEventListener('resize', scheduleMeasure)
    document.fonts?.ready.then(scheduleMeasure).catch(() => undefined)

    scheduleMeasure()

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }

      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  if (sphereState.hasError || !sphereState.layers) {
    return (
      <div className="hero-globe-pane" aria-hidden>
        <div className="hero-globe-viewport">
          <div className="hero-globe-round">
            <div className="globe-cinema-rig">
              <div className="globe-stage globe-stage-right">
                <div className="globe-shell">
                  <div className="flex min-h-[24rem] items-center justify-center px-6 text-center">
                    <div className="rounded-[1.6rem] border border-border-dark/80 bg-surface-dark/70 px-6 py-5 text-sm text-text-silver-dark">
                      Live globe unavailable. Review signals remain available below.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hero-globe-pane" aria-hidden>
      <div className="hero-globe-viewport">
        <div className="globe-data-stream globe-data-stream-1"></div>
        <div className="globe-data-stream globe-data-stream-2"></div>
        <div className="globe-data-stream globe-data-stream-3"></div>

        <div className="hero-globe-round">
          <div className="globe-cinema-rig">
            <div className="globe-stage globe-stage-right">
              <div className="globe-shell" ref={shellRef}>
                <div className="globe-depth-halo"></div>
                <div className="globe-scan-ring globe-scan-ring-1"></div>
                <div className="globe-scan-ring globe-scan-ring-2"></div>
                <div className="globe-scan-ring globe-scan-ring-3"></div>

                <div className="ascii-sphere-wrapper">
                  <pre className="ascii-sphere-layer ascii-sphere-shadow">
                    {sphereState.layers.shadow}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-body" ref={bodyRef}>
                    {sphereState.layers.body}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-land">
                    {sphereState.layers.land}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-cloud">
                    {sphereState.layers.cloud}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-wire">
                    {sphereState.layers.wire}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-rim">
                    {sphereState.layers.rim}
                  </pre>
                </div>

                <GlobeInsightCards layout={layoutMetrics} phase={spherePhase} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
