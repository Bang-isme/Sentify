import { memo, useEffect, useState } from 'react'

/**
 * Each insight is anchored to a dot on the globe surface.
 * The card floats to a fixed offset, and a line connects
 * from the dot → the card using a CSS-rotated element.
 */
interface GlobeInsight {
    id: number
    /** Dot position as % of the globe-shell container */
    dotX: number
    dotY: number
    /** Card position as % of the globe-shell container (top-left of card) */
    cardX: number
    cardY: number
    /** Which side the card is on (controls line curve direction) */
    cardSide: 'left' | 'right'
    /** Content */
    avatar: string
    name: string
    location: string
    text: string
    metric?: string
    metricLabel?: string
}

const INSIGHTS: GlobeInsight[] = [
    {
        id: 1,
        dotX: 30,
        dotY: 20,
        cardX: -8,
        cardY: 2,
        cardSide: 'left',
        avatar: '🇺🇸',
        name: 'Sarah Chen',
        location: 'New York, US',
        text: '"Predictive accuracy increased by 34% in Q3"',
        metric: '+34%',
        metricLabel: 'Accuracy',
    },
    {
        id: 2,
        dotX: 52,
        dotY: 16,
        cardX: 58,
        cardY: 4,
        cardSide: 'right',
        avatar: '🇬🇧',
        name: 'James Wright',
        location: 'London, UK',
        text: '"Real-time threat detection saved us $2.1M"',
        metric: '$2.1M',
        metricLabel: 'Saved',
    },
    {
        id: 3,
        dotX: 78,
        dotY: 38,
        cardX: 62,
        cardY: 24,
        cardSide: 'right',
        avatar: '🇯🇵',
        name: 'Yuki Tanaka',
        location: 'Tokyo, JP',
        text: '"Supply chain latency dropped to 12ms"',
        metric: '12ms',
        metricLabel: 'Latency',
    },
    {
        id: 4,
        dotX: 36,
        dotY: 62,
        cardX: -4,
        cardY: 52,
        cardSide: 'left',
        avatar: '🇧🇷',
        name: 'Ana Silva',
        location: 'São Paulo, BR',
        text: '"Market sentiment analysis is incredibly precise"',
        metric: '99.2%',
        metricLabel: 'Precision',
    },
    {
        id: 5,
        dotX: 68,
        dotY: 42,
        cardX: 66,
        cardY: 46,
        cardSide: 'right',
        avatar: '🇮🇳',
        name: 'Raj Patel',
        location: 'Mumbai, IN',
        text: '"Delivery speed up 15% across APAC region"',
        metric: '+15%',
        metricLabel: 'Speed',
    },
]

/** Only two visible at a time, cycling */
const VISIBLE_COUNT = 2
const CYCLE_DURATION = 4500

export const GlobeInsightCards = memo(function GlobeInsightCards() {
    const [activeIndices, setActiveIndices] = useState<number[]>([0, 2])

    useEffect(() => {
        let tick = 0
        const interval = window.setInterval(() => {
            tick++
            setActiveIndices((prev) => {
                const slot = tick % VISIBLE_COUNT
                const newIndices = [...prev]
                let next = (newIndices[slot] + VISIBLE_COUNT) % INSIGHTS.length
                while (newIndices.includes(next) && next !== newIndices[slot]) {
                    next = (next + 1) % INSIGHTS.length
                }
                newIndices[slot] = next
                return newIndices
            })
        }, CYCLE_DURATION / VISIBLE_COUNT)
        return () => window.clearInterval(interval)
    }, [])

    return (
        <div className="globe-insight-layer" aria-hidden>
            {INSIGHTS.map((insight, idx) => {
                const isActive = activeIndices.includes(idx)
                return (
                    <div
                        key={insight.id}
                        className={`globe-insight-group ${isActive ? 'globe-insight-active' : ''}`}
                    >
                        {/* ── Dot on the globe ── */}
                        <div
                            className="globe-insight-dot"
                            style={{ left: `${insight.dotX}%`, top: `${insight.dotY}%` }}
                        >
                            <span className="globe-insight-dot-core" />
                            <span className="globe-insight-dot-ping" />
                        </div>

                        {/* ── SVG line connecting dot ↔ card ── */}
                        <svg className="globe-insight-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <line
                                x1={insight.dotX}
                                y1={insight.dotY}
                                x2={insight.cardX + 10}
                                y2={insight.cardY + 4}
                                className="globe-insight-line"
                            />
                        </svg>

                        {/* ── Card ── */}
                        <div
                            className="globe-insight-card"
                            style={{ left: `${insight.cardX}%`, top: `${insight.cardY}%` }}
                        >
                            <div className="globe-insight-card-header">
                                <span className="globe-insight-avatar">{insight.avatar}</span>
                                <div>
                                    <div className="globe-insight-name">{insight.name}</div>
                                    <div className="globe-insight-location">{insight.location}</div>
                                </div>
                                {insight.metric && (
                                    <div className="globe-insight-metric">
                                        <span className="globe-insight-metric-value">{insight.metric}</span>
                                        <span className="globe-insight-metric-label">{insight.metricLabel}</span>
                                    </div>
                                )}
                            </div>
                            <p className="globe-insight-text">{insight.text}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
})
