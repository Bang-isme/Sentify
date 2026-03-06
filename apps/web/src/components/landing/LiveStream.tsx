const streams = [
    {
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFb-_R53S3gIDfbNixdrtgR93xITZuY__6YeAEA2hKYQlF9G8MMJlEcQ608lCPnjKRVErSTO_nFMk3cuD0yCtYtDZs6eX-k396yoxEDZzDufbJQ5y6rxu1et_FT3wO1hBP12Vb98qzNFndiXQHGHoq41bPUFQ1FQdBFu3J1T954q1WervDugTBoKLE2CBMo8yxlmUxLmLpTfocc2jI310heJw4oMdNEBjGYZZ_HBlrn7mYsDyeuY8mvAsrCBIPhtXsg0CzqTGm3Zah',
        imageAlt: 'Stock market volatility chart',
        badge: { text: 'CRITICAL', color: 'red' as const },
        title: 'Market Volatility Detected',
        description: 'Automated hedge recommendations generated based on APAC trading volume spike.',
        time: '2 mins ago',
    },
    {
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBk6EJJ9EStSP9-ojFY-6cESFlauxqhRkik1CDDNfg59FmmcIaTo0vVsKJId5gyjL3kU2R5d2TLdg8oeuoDCE5ULjIQj-C7jmU2ZJs0Nx2lO-kdyJtFChmTy9yz2NTlMbZ_f-LkEOWZ7LMLnI4JvUtAD9UiKxjoayoWbhRbXTta-iqVq3PNny8SlEF3BW0m7PGNkI2D9bxjYg26tzl82Ij74E5G0XTWBQWRz_IQBmgFmGFk-l5v01Uh0nTFJJjRt9QHfVq1UOF8kXnu',
        imageAlt: 'Logistics supply chain map',
        badge: { text: 'OPTIMIZED', color: 'green' as const },
        title: 'Route Efficiency +12%',
        description: 'Real-time rerouting applied to logistics fleet #42 in North American sector.',
        time: '14 mins ago',
    },
    {
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVL51QbhhMlDnntxuaWZYSl1n1eBeuLZcypVVJSyig5M-2EzY8_GsZRxyG4USV01rLAhOGYIHL9p486RLBK0PyZqv4M8xzBUOPVRaPLTqG9Eji6Up_d6Z-pnC83EompfVQDSeR66b7EUsEIfIrLgXpN-kNLkA5JBqug6HhhCZooOuve_B5g27S857IG_C2a5wX0GzMFUeja1DDu1poKH1KCynQG7coOk1LXxJdgfAzU9AVU-Mh-pyeDeo2WFWmPEUmSmsivBxcBZ9Q',
        imageAlt: 'Social media sentiment analysis',
        badge: { text: 'ANALYSIS', color: 'blue' as const },
        title: 'Brand Sentiment Shift',
        description: 'Positive correlation detected following "Project Gold" announcement.',
        time: '45 mins ago',
    },
    {
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKMomJ4yeXn_UCB0b3jD-wqd3KKydG7IHBsz7qpmm3Peo3NWAx7LliqxwVSN6lWwktR4wp27ubJSpNov0iE6icEnddieJeRAG4riZbNUnvlGohrX8pwxNf0y9-ee7GKVNIIkusxU8gJybVt3O_RVt1d6cUOJVqKwMzlnc4pF2mqeEqVn4vhAGx5F2MRfVDyFdgOZwUlc9zAWCoya92SoXqMiGp8AXjAHZBWqGqesx18-K6UfWg3hGV6O2Mxj1j0iqiJqTizLGahSdA',
        imageAlt: 'Server node connections',
        badge: null,
        title: 'Infrastructure Scale Up',
        description: 'Automatic provisioning of 50 new GPU nodes to handle increased load.',
        time: '1 hr ago',
    },
]

const badgeColors = {
    red: {
        light: 'bg-red-50 text-red-600 border-red-200',
        dark: 'dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
    },
    green: {
        light: 'bg-green-50 text-green-600 border-green-200',
        dark: 'dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
    },
    blue: {
        light: 'bg-blue-50 text-blue-600 border-blue-200',
        dark: 'dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
    },
}

export function LiveStream() {
    return (
        <section className="py-20 bg-surface-ticker-light dark:bg-surface-ticker-dark">
            <div className="max-w-[1440px] mx-auto px-6">
                <div className="flex items-center justify-between mb-8">
                    <h4 className="text-text-silver-light dark:text-text-silver-dark text-sm font-bold uppercase tracking-[0.1em] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Live Intelligence Stream
                    </h4>
                    <button className="text-primary-dark dark:text-primary text-sm font-medium hover:text-text-charcoal dark:hover:text-white transition-colors">
                        View All Streams
                    </button>
                </div>

                <div className="flex overflow-x-auto gap-6 pb-6 no-scrollbar snap-x">
                    {streams.map((stream, i) => (
                        <StreamCard key={i} {...stream} />
                    ))}
                </div>
            </div>
        </section>
    )
}

function StreamCard({
    image,
    imageAlt,
    badge,
    title,
    description,
    time,
}: {
    image: string
    imageAlt: string
    badge: { text: string; color: 'red' | 'green' | 'blue' } | null
    title: string
    description: string
    time: string
}) {
    return (
        <div className="min-w-[300px] md:min-w-[380px] snap-center bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 hover:border-primary/30 transition-colors group cursor-pointer shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none">
            <div className="w-full aspect-video rounded-lg bg-surface-ticker-light dark:bg-surface-highlight/45 mb-4 overflow-hidden relative">
                <img
                    className="w-full h-full object-cover opacity-80 dark:opacity-60 group-hover:scale-110 transition-transform duration-700 mix-blend-multiply dark:mix-blend-normal"
                    alt={imageAlt}
                    src={image}
                />
                {badge && (
                    <div className={`absolute top-2 right-2 border px-2 py-0.5 rounded text-xs font-bold ${badgeColors[badge.color].light} ${badgeColors[badge.color].dark}`}>
                        {badge.text}
                    </div>
                )}
            </div>
            <h5 className="text-text-charcoal dark:text-white text-lg font-medium mb-1 group-hover:text-primary-dark dark:group-hover:text-primary transition-colors">
                {title}
            </h5>
            <p className="text-text-silver-light dark:text-text-silver-dark text-sm">{description}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-silver-light dark:text-text-silver-dark">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {time}
            </div>
        </div>
    )
}
