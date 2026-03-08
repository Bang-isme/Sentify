import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { buildSphereLayers, type SphereLayers } from './asciiGlobeEngine'
import { GlobeInsightCards, type GlobeLayoutMetrics } from './GlobeInsightCards'

/*
 * Animation is driven by requestAnimationFrame + direct DOM writes.
 * React only renders the skeleton once; after mount the rAF loop
 * updates <pre> textContent directly, bypassing VDOM diff entirely.
 *
 * TICK_INTERVAL controls how often the globe *computation* runs.
 * rAF itself runs at monitor refresh rate (60/120 Hz) so the
 * visual transitions between ticks are perfectly vsync-aligned.
 */

const TICK_INTERVAL_DEFAULT = 40   // 25 ticks/s — smooth & light
const TICK_INTERVAL_REDUCED = 260  // reduced-motion preference
const TICK_INTERVAL_LOW = 55       // low-power devices (≤4 cores)

function getTickInterval(reducedMotion: boolean): number {
  if (reducedMotion) return TICK_INTERVAL_REDUCED
  const cores = navigator.hardwareConcurrency ?? 8
  return cores <= 4 ? TICK_INTERVAL_LOW : TICK_INTERVAL_DEFAULT
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
  const [layoutMetrics, setLayoutMetrics] = useState<GlobeLayoutMetrics | null>(null)

  // Refs for direct DOM manipulation — no React re-render per frame
  const shellRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLPreElement>(null)
  const shadowRef = useRef<HTMLPreElement>(null)
  const landRef = useRef<HTMLPreElement>(null)
  const cloudRef = useRef<HTMLPreElement>(null)
  const wireRef = useRef<HTMLPreElement>(null)
  const rimRef = useRef<HTMLPreElement>(null)

  // Phase exposed to GlobeInsightCards (updated via setState at a slower rate)
  const [cardPhase, setCardPhase] = useState(0)

  // Store initial render layers so React can do the first paint
  const [initialLayers] = useState<SphereLayers | null>(() => {
    try {
      return buildSphereLayers(0, 0)
    } catch {
      return null
    }
  })

  // ── rAF animation loop ──
  useEffect(() => {
    const shadow = shadowRef.current
    const body = bodyRef.current
    const land = landRef.current
    const cloud = cloudRef.current
    const wire = wireRef.current
    const rim = rimRef.current

    // If any ref is missing the DOM isn't ready yet
    if (!shadow || !body || !land || !cloud || !wire || !rim) return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = mediaQuery.matches
    let tickInterval = getTickInterval(reducedMotion)
    let rafId = 0
    let startTime = 0
    let lastTickTime = 0
    let running = true

    /*
     * Time-based rotation: phase = elapsed_seconds × PHASE_SPEED
     * Original speed was: 1 tick per 110ms × 0.085 rad/tick ≈ 0.773 rad/s
     * We match that exact speed so globe rotates identically to before.
     * Tick (for scanline/flicker effects) derived from elapsed time too.
     */
    const PHASE_SPEED = 0.773         // rad/s — matches original rotation speed
    const TICK_RATE = 1000 / 110      // virtual ticks/s — matches original tick timing

    const frame = (now: number) => {
      if (!running) return

      if (startTime === 0) startTime = now

      const elapsed = now - lastTickTime
      if (elapsed >= tickInterval) {
        lastTickTime = now - (elapsed % tickInterval)

        // Time-based phase — rotation speed independent of tick rate
        const elapsedSeconds = (now - startTime) / 1000
        const phase = elapsedSeconds * PHASE_SPEED
        const tick = (elapsedSeconds * TICK_RATE) | 0

        try {
          const layers = buildSphereLayers(phase, tick)

          // Direct DOM writes — completely bypass React VDOM
          shadow.textContent = layers.shadow
          body.textContent = layers.body
          land.textContent = layers.land
          cloud.textContent = layers.cloud
          wire.textContent = layers.wire
          rim.textContent = layers.rim
        } catch {
          // silently skip broken frames
        }

        // Update card phase every computation frame for smooth dot/card tracking
        setCardPhase(phase)
      }

      rafId = requestAnimationFrame(frame)
    }

    const start = () => {
      if (!running || document.hidden) return
      lastTickTime = 0
      rafId = requestAnimationFrame(frame)
    }

    const stop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      tickInterval = getTickInterval(reducedMotion)
    }

    // Pause globe during view-transition to avoid layout contention
    const handlePause = () => stop()
    const handleResume = () => start()

    start()
    document.addEventListener('visibilitychange', handleVisibility)
    mediaQuery.addEventListener('change', handleMotionChange)
    window.addEventListener('globe:pause', handlePause)
    window.addEventListener('globe:resume', handleResume)

    return () => {
      running = false
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
      mediaQuery.removeEventListener('change', handleMotionChange)
      window.removeEventListener('globe:pause', handlePause)
      window.removeEventListener('globe:resume', handleResume)
    }
  }, [])

  // ── Layout measurement (unchanged logic, cleaned up) ──
  const measureLayout = useCallback(() => {
    const shellNode = shellRef.current
    const bodyNode = bodyRef.current
    if (!shellNode || !bodyNode) return

    const shellRect = shellNode.getBoundingClientRect()
    const bodyRect = bodyNode.getBoundingClientRect()

    if (!shellRect.width || !shellRect.height || !bodyRect.width || !bodyRect.height) return

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
  }, [])

  useEffect(() => {
    const shellNode = shellRef.current
    const bodyNode = bodyRef.current
    if (!shellNode || !bodyNode) return

    let frameId = 0

    const scheduleMeasure = () => {
      if (frameId !== 0) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        measureLayout()
      })
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(shellNode)
    resizeObserver.observe(bodyNode)
    window.addEventListener('resize', scheduleMeasure)
    document.fonts?.ready.then(scheduleMeasure).catch(() => undefined)

    scheduleMeasure()

    return () => {
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [measureLayout])

  if (!initialLayers) {
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
                  <pre className="ascii-sphere-layer ascii-sphere-shadow" ref={shadowRef}>
                    {initialLayers.shadow}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-body" ref={bodyRef}>
                    {initialLayers.body}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-land" ref={landRef}>
                    {initialLayers.land}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-cloud" ref={cloudRef}>
                    {initialLayers.cloud}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-wire" ref={wireRef}>
                    {initialLayers.wire}
                  </pre>
                  <pre className="ascii-sphere-layer ascii-sphere-rim" ref={rimRef}>
                    {initialLayers.rim}
                  </pre>
                </div>

                <GlobeInsightCards layout={layoutMetrics} phase={cardPhase} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
