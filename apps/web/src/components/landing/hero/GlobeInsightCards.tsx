import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLanguage } from '../../../contexts/languageContext'

export interface GlobeLayoutMetrics {
  shellWidth: number
  shellHeight: number
  sphereLeft: number
  sphereTop: number
  sphereWidth: number
  sphereHeight: number
}

interface GlobeInsightSeed {
  id: number
  latitude: number
  longitude: number
  cardOffsetX: number
  cardOffsetY: number
}

type GlobeInsight = GlobeInsightSeed & {
  avatar: string
  name: string
  location: string
  text: string
  metric?: string
  metricLabel?: string
}

type ProjectedInsight = GlobeInsight & {
  dotLeft: number
  dotTop: number
  cardLeft: number
  cardTop: number
  cardSide: 'left' | 'right'
  lineX2: number
  lineY2: number
  lineLength: number
  dotSize: number
  motionX: number
  motionY: number
  isVisible: boolean
}

type CardSize = {
  width: number
  height: number
}

interface GlobeInsightCardsProps {
  layout: GlobeLayoutMetrics | null
}

const INSIGHT_SEEDS: GlobeInsightSeed[] = [
  {
    id: 1,
    latitude: 40.7128,
    longitude: -74.006,
    cardOffsetX: -272,
    cardOffsetY: -154,
  },
  {
    id: 2,
    latitude: 51.5072,
    longitude: -0.1276,
    cardOffsetX: 22,
    cardOffsetY: -156,
  },
  {
    id: 3,
    latitude: 35.6762,
    longitude: 139.6503,
    cardOffsetX: 24,
    cardOffsetY: -110,
  },
  {
    id: 4,
    latitude: -23.5505,
    longitude: -46.6333,
    cardOffsetX: -264,
    cardOffsetY: 18,
  },
  {
    id: 5,
    latitude: 19.076,
    longitude: 72.8777,
    cardOffsetX: 34,
    cardOffsetY: 54,
  },
]

const DESKTOP_VISIBLE_COUNT = 2
const CYCLE_DURATION = 4500
const DEG_TO_RAD = Math.PI / 180
const BASE_SPHERE_WIDTH = 560
const FRONT_VISIBILITY_THRESHOLD = 0.16
const DEFAULT_CARD_SIZE: CardSize = {
  width: 220,
  height: 108,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function pickActiveVisibleInsights(
  visibleIndices: number[],
  projectedInsights: ProjectedInsight[],
  visibleCount: number,
  cycleStep: number,
): number[] {
  if (!visibleIndices.length) return []

  if (visibleCount === 1 || visibleIndices.length === 1) {
    return [visibleIndices[cycleStep % visibleIndices.length]]
  }

  if (visibleIndices.length <= visibleCount) {
    return visibleIndices
  }

  const orderedByX = [...visibleIndices].sort(
    (leftIndex, rightIndex) =>
      projectedInsights[leftIndex].dotLeft - projectedInsights[rightIndex].dotLeft,
  )
  const midpoint = Math.floor(orderedByX.length / 2)
  const leftPool = orderedByX.slice(0, midpoint)
  const rightPool = orderedByX.slice(midpoint)
  const nextActive = [
    leftPool[cycleStep % leftPool.length],
    rightPool[cycleStep % rightPool.length],
  ].filter((value, index, items) => items.indexOf(value) === index)

  for (const index of orderedByX) {
    if (nextActive.length >= visibleCount) break
    if (!nextActive.includes(index)) {
      nextActive.push(index)
    }
  }

  return nextActive
}

function projectInsight(
  insight: GlobeInsight,
  layout: GlobeLayoutMetrics,
  cardSize: CardSize,
  phase: number,
): ProjectedInsight {
  const latitude = insight.latitude * DEG_TO_RAD
  const longitude = insight.longitude * DEG_TO_RAD - phase
  const cosLatitude = Math.cos(latitude)
  const x = Math.sin(longitude) * cosLatitude
  const y = Math.sin(latitude)
  const z = Math.cos(longitude) * cosLatitude
  const dotLeft = layout.sphereLeft + layout.sphereWidth * 0.5 + x * layout.sphereWidth * 0.5
  const dotTop = layout.sphereTop + layout.sphereHeight * 0.5 - y * layout.sphereHeight * 0.5
  const scale = clamp(layout.sphereWidth / BASE_SPHERE_WIDTH, 0.78, 1.18)
  const horizontalPadding = Math.max(16, layout.shellWidth * 0.028)
  const verticalPadding = Math.max(34, layout.shellHeight * 0.085)
  const cardLeft = clamp(
    dotLeft + insight.cardOffsetX * scale,
    horizontalPadding,
    layout.shellWidth - cardSize.width - horizontalPadding,
  )
  const cardTop = clamp(
    dotTop + insight.cardOffsetY * scale,
    verticalPadding,
    layout.shellHeight - cardSize.height - verticalPadding,
  )
  const cardSide: 'left' | 'right' = cardLeft + cardSize.width * 0.5 >= dotLeft ? 'right' : 'left'
  const connectorInset = Math.min(24, cardSize.width * 0.18)
  const lineX2 = cardSide === 'right' ? cardLeft + connectorInset : cardLeft + cardSize.width - connectorInset
  const lineY2 = cardTop + Math.min(cardSize.height * 0.32, 34 * scale)
  const lineLength = Math.hypot(lineX2 - dotLeft, lineY2 - dotTop)
  const motionX = clamp((dotLeft - lineX2) * 0.12, -20, 20)
  const motionY = clamp((dotTop - lineY2) * 0.1, -14, 14)
  const dotSize = clamp(layout.sphereWidth / 54, 8, 12)

  return {
    ...insight,
    dotLeft,
    dotTop,
    cardLeft,
    cardTop,
    cardSide,
    lineX2,
    lineY2,
    lineLength,
    dotSize,
    motionX,
    motionY,
    isVisible: z > FRONT_VISIBILITY_THRESHOLD,
  }
}

export const GlobeInsightCards = memo(function GlobeInsightCards({
  layout,
}: GlobeInsightCardsProps) {
  const { copy } = useLanguage()
  const [cycleStep, setCycleStep] = useState(0)
  const [cardSizes, setCardSizes] = useState<Record<number, CardSize>>({})
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const groupRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const dotRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const lineRefs = useRef<Record<number, SVGLineElement | null>>({})
  const lastPhaseRef = useRef(0)
  const visibleCount = layout && layout.shellWidth < 540 ? 1 : DESKTOP_VISIBLE_COUNT

  const translatedById = new Map<number, (typeof copy.globe.insights)[number]>(
    copy.globe.insights.map((item) => [item.id, item]),
  )

  const insights: GlobeInsight[] = INSIGHT_SEEDS.map((seed) => {
    const translated = translatedById.get(seed.id)

    return {
      ...seed,
      avatar: translated?.avatar ?? 'US',
      name: translated?.name ?? 'Sentify Signal',
      location: translated?.location ?? '',
      text: translated?.text ?? '',
      metric: translated?.metric,
      metricLabel: translated?.metricLabel,
    }
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCycleStep((previous) => previous + 1)
    }, CYCLE_DURATION / visibleCount)

    return () => window.clearInterval(interval)
  }, [visibleCount])

  useEffect(() => {
    if (!layout) return

    const nodes = INSIGHT_SEEDS
      .map((insight) => cardRefs.current[insight.id])
      .filter((node): node is HTMLDivElement => node !== null)

    if (!nodes.length) return

    let frameId = 0

    const measureCardSizes = () => {
      frameId = 0

      setCardSizes((previous) => {
        const next: Record<number, CardSize> = {}
        let hasChange = false

        for (const insight of INSIGHT_SEEDS) {
          const node = cardRefs.current[insight.id]

          if (!node) {
            next[insight.id] = previous[insight.id] ?? DEFAULT_CARD_SIZE
            continue
          }

          const bounds = node.getBoundingClientRect()
          const measuredSize = {
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          }

          next[insight.id] = measuredSize

          const previousSize = previous[insight.id]

          if (
            !previousSize ||
            previousSize.width !== measuredSize.width ||
            previousSize.height !== measuredSize.height
          ) {
            hasChange = true
          }
        }

        if (!hasChange && Object.keys(previous).length === Object.keys(next).length) {
          return previous
        }

        return next
      })
    }

    const scheduleMeasurement = () => {
      if (frameId !== 0) return
      frameId = window.requestAnimationFrame(measureCardSizes)
    }

    const resizeObserver = new ResizeObserver(scheduleMeasurement)

    for (const node of nodes) {
      resizeObserver.observe(node)
    }

    scheduleMeasurement()
    window.addEventListener('resize', scheduleMeasurement)

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }

      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleMeasurement)
    }
  }, [layout])

  const projectedInsights = layout
    ? insights.map((insight) =>
        projectInsight(insight, layout, cardSizes[insight.id] ?? DEFAULT_CARD_SIZE, lastPhaseRef.current),
      )
    : []
  const visibleIndices = projectedInsights
    .map((insight, index) => (insight.isVisible ? index : -1))
    .filter((index) => index !== -1)
  const activeIndices = pickActiveVisibleInsights(
    visibleIndices,
    projectedInsights,
    visibleCount,
    cycleStep,
  )

  useEffect(() => {
    if (!layout) return

    const handlePhase = (e: Event) => {
      const currentPhase = (e as CustomEvent<number>).detail
      lastPhaseRef.current = currentPhase

      insights.forEach((insight, index) => {
        const projected = projectInsight(
          insight,
          layout,
          cardSizes[insight.id] ?? DEFAULT_CARD_SIZE,
          currentPhase,
        )

        const group = groupRefs.current[insight.id]
        if (group) {
          group.classList.toggle('globe-insight-hidden', !projected.isVisible)
          group.style.setProperty('--insight-dot-size', `${projected.dotSize}px`)
          group.style.setProperty('--card-shift-x', `${projected.motionX}px`)
          group.style.setProperty('--card-shift-y', `${projected.motionY}px`)
        }

        const dot = dotRefs.current[insight.id]
        if (dot) {
          dot.style.left = `${projected.dotLeft}px`
          dot.style.top = `${projected.dotTop}px`
        }

        const line = lineRefs.current[insight.id]
        if (line) {
          line.setAttribute('x1', projected.dotLeft.toString())
          line.setAttribute('y1', projected.dotTop.toString())
          line.setAttribute('x2', projected.lineX2.toString())
          line.setAttribute('y2', projected.lineY2.toString())
          line.style.strokeDasharray = `${projected.lineLength}px`
          line.style.strokeDashoffset = activeIndices.includes(index) ? '0px' : `${projected.lineLength}px`
        }

        const card = cardRefs.current[insight.id]
        if (card) {
          card.style.left = `${projected.cardLeft}px`
          card.style.top = `${projected.cardTop}px`
          card.classList.toggle('globe-insight-card-left', projected.cardSide === 'left')
          card.classList.toggle('globe-insight-card-right', projected.cardSide === 'right')
        }
      })
    }

    window.addEventListener('globe:updatePhase', handlePhase)
    return () => window.removeEventListener('globe:updatePhase', handlePhase)
  }, [layout, cardSizes, insights, activeIndices])

  if (!layout) return null

  return (
    <div className="globe-insight-layer" aria-hidden>
      {projectedInsights.map((insight, index) => {
        const isActive = activeIndices.includes(index)
        const groupStyle = {
          '--insight-dot-size': `${insight.dotSize}px`,
          '--card-shift-x': `${insight.motionX}px`,
          '--card-shift-y': `${insight.motionY}px`,
        } as CSSProperties

        return (
          <div
            key={insight.id}
            ref={(node) => {
              groupRefs.current[insight.id] = node
            }}
            className={[
              'globe-insight-group',
              insight.isVisible ? '' : 'globe-insight-hidden',
              isActive ? 'globe-insight-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={groupStyle}
          >
            <div
              className="globe-insight-dot"
              ref={(node) => {
                dotRefs.current[insight.id] = node
              }}
              style={{ left: `${insight.dotLeft}px`, top: `${insight.dotTop}px` }}
            >
              <span className="globe-insight-dot-core" />
              <span className="globe-insight-dot-ping" />
            </div>

            <svg
              className="globe-insight-svg"
              viewBox={`0 0 ${layout.shellWidth} ${layout.shellHeight}`}
              preserveAspectRatio="none"
            >
              <line
                ref={(node) => {
                  lineRefs.current[insight.id] = node
                }}
                x1={insight.dotLeft}
                y1={insight.dotTop}
                x2={insight.lineX2}
                y2={insight.lineY2}
                className="globe-insight-line"
                style={{
                  strokeDasharray: `${insight.lineLength}px`,
                  strokeDashoffset: isActive ? '0px' : `${insight.lineLength}px`,
                }}
              />
            </svg>

            <div
              className={`globe-insight-card globe-insight-card-${insight.cardSide}`}
              style={{ left: `${insight.cardLeft}px`, top: `${insight.cardTop}px` }}
              ref={(node) => {
                cardRefs.current[insight.id] = node
              }}
            >
              <div className="globe-insight-card-header">
                <span className="globe-insight-avatar">{insight.avatar}</span>
                <div>
                  <div className="globe-insight-name">{insight.name}</div>
                  <div className="globe-insight-location">{insight.location}</div>
                </div>
                {insight.metric ? (
                  <div className="globe-insight-metric">
                    <span className="globe-insight-metric-value">{insight.metric}</span>
                    <span className="globe-insight-metric-label">{insight.metricLabel}</span>
                  </div>
                ) : null}
              </div>
              <p className="globe-insight-text">{insight.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
})
