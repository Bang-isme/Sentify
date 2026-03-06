interface MarqueeTickerProps {
    className?: string
    compact?: boolean
}

const tickerItems = [
    { icon: 'bolt', text: 'Supply Chain Optimized +15%' },
    { icon: 'trending_up', text: 'Q3 Predictions: Bullish' },
    { icon: 'language', text: 'Delivery speed up 15%' },
    { icon: 'psychology', text: 'Sentiment Analysis: Positive Shift' },
    { icon: 'security', text: 'Threat Detected & Neutralized' },
]

export function MarqueeTicker({ className = '', compact = false }: MarqueeTickerProps) {
    const verticalPadding = compact ? 'py-3 md:py-3.5' : 'py-4'
    const textSize = compact ? 'text-xs md:text-sm' : 'text-sm'
    const rootClassName =
        `marquee-ticker w-full bg-surface-ticker-light/92 dark:bg-surface-ticker-dark/88 border-y border-border-light dark:border-border-dark ${verticalPadding} overflow-hidden relative ${className}`.trim()

    return (
        <div className={rootClassName}>
            <div className="flex w-full whitespace-nowrap animate-marquee">
                <div className="flex items-center gap-10 md:gap-12 px-6">
                    {[...tickerItems, ...tickerItems].map((item, i) => (
                        <span
                            key={i}
                            className={`flex items-center gap-2 ${textSize} text-text-silver-light dark:text-text-silver-dark font-medium`}
                        >
                            <span className="material-symbols-outlined text-primary text-base md:text-lg">{item.icon}</span>
                            {item.text}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
