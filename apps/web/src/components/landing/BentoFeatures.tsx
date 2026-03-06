export function BentoFeatures() {
    return (
        <section className="py-24 px-6 md:px-12 bg-bg-light dark:bg-bg-dark relative">
            <div className="max-w-[1440px] mx-auto">
                {/* Section header */}
                <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-xl">
                        <h3 className="text-primary-dark dark:text-primary text-sm font-bold uppercase tracking-widest mb-2">System Core</h3>
                        <h2 className="text-4xl md:text-5xl font-bold text-text-charcoal dark:text-white mb-4">
                            Precision Engineered <br />
                            <span className="font-serif italic text-text-silver-light dark:text-text-silver-dark font-normal">for the Enterprise</span>
                        </h2>
                    </div>
                    <p className="text-text-silver-light dark:text-text-silver-dark max-w-sm text-sm leading-relaxed text-right md:text-left font-medium dark:font-normal">
                        Our modular architecture allows for seamless integration into existing workflows, providing immediate value through advanced AI heuristics.
                    </p>
                </div>

                {/* Bento grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 auto-rows-[minmax(180px,auto)]">
                    <NeuralHubCard />
                    <SmallFeatureCard icon="lock_person" tag="SEC_LVL_9" title="Enterprise Security" description="Bank-grade encryption for all sensitive predictive models." />
                    <SmallFeatureCard icon="speed" tag="RT_LATENCY_LOW" title="Low Latency Core" description="Decisions executed in microseconds, faster than market shifts." />
                    <GlobalCoverageCard />
                    <PredictiveForecastCard />
                </div>
            </div>
        </section>
    )
}

function NeuralHubCard() {
    return (
        <div className="group bento-card relative md:col-span-6 lg:col-span-8 row-span-2 rounded-2xl bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden transition-all duration-500 hover:border-primary/60 shadow-sm dark:shadow-none">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 dark:from-surface-highlight/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute right-0 top-0 w-2/3 h-full">
                <img
                    className="w-full h-full object-cover object-left opacity-10 dark:opacity-60 mix-blend-multiply dark:mix-blend-luminosity group-hover:opacity-20 dark:group-hover:mix-blend-normal transition-all duration-700"
                    alt="Analytics dashboard"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7IDqbn2G_W3WevFGouYYv777TSq4W0xCYFb9MdIt82GbfbypqXCQ4anGYLgIIfL_mjL4pgXTyyM1kLtu4ffNJnKSXRaxnas8yc3z-W06iOtcuv57xhpzK24APFoDHYyuD7CWfY9wNVASFof-rVHC8cST6WwDhyRArkWiy9PbEIYmhY9hglbv-Q93HkVhf5N1f71adSUbiw__VT4kXGtQOrl3gBZ-hl4TLuxq3JWcBPIcKrizdUjABhTzlyzuz8_8DPyUDnT5U9D46"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-white dark:from-surface-dark via-surface-white/60 dark:via-surface-dark/50 to-transparent"></div>
            </div>
            <div className="relative p-8 h-full flex flex-col justify-end max-w-lg z-10">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary-dark dark:text-primary group-hover:bg-primary group-hover:text-white dark:group-hover:text-black transition-colors">
                    <span className="material-symbols-outlined text-2xl">hub</span>
                </div>
                <h3 className="text-2xl font-bold text-text-charcoal dark:text-white mb-2">Centralized Neural Hub</h3>
                <p className="text-text-silver-light dark:text-text-silver-dark">
                    Connect all data streams into a single source of truth. The Neural Hub processes millions of endpoints in real-time.
                </p>
            </div>
            <div className="absolute inset-0 border border-transparent group-hover:animate-pulse-border rounded-2xl pointer-events-none"></div>
        </div>
    )
}

function SmallFeatureCard({ icon, tag, title, description }: { icon: string; tag: string; title: string; description: string }) {
    return (
        <div className="group bento-card relative md:col-span-3 lg:col-span-4 row-span-1 rounded-2xl bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden p-6 transition-all duration-300 hover:border-primary/60 hover:-translate-y-1 shadow-sm dark:shadow-none">
            <div className="flex justify-between items-start mb-8">
                <span className="material-symbols-outlined text-3xl text-text-silver-light dark:text-text-silver-dark group-hover:text-primary transition-colors">{icon}</span>
                <span className="text-xs font-mono text-text-silver-light dark:text-text-silver-dark bg-surface-ticker-light dark:bg-surface-highlight px-2 py-1 rounded">{tag}</span>
            </div>
            <h3 className="text-xl font-bold text-text-charcoal dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-text-silver-light dark:text-text-silver-dark">{description}</p>
            <div className="absolute inset-0 border border-transparent group-hover:animate-pulse-border rounded-2xl pointer-events-none"></div>
        </div>
    )
}

function GlobalCoverageCard() {
    return (
        <div className="group bento-card relative md:col-span-6 lg:col-span-5 row-span-2 rounded-2xl bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden transition-all duration-500 hover:border-primary/60 shadow-sm dark:shadow-none">
            <div
                className="absolute inset-0 bg-cover bg-center opacity-40 dark:opacity-30 group-hover:scale-105 transition-transform duration-700"
                style={{ backgroundImage: `url('https://placeholder.pics/svg/600/ffffff/f2f2f0/Abstract%20Globe%20Network')` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-surface-white dark:from-surface-dark to-transparent"></div>
            <div className="relative p-8 h-full flex flex-col justify-end z-10">
                <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-primary text-2xl animate-pulse">public</span>
                    <span className="text-primary-dark dark:text-primary text-sm font-bold uppercase">Global Coverage</span>
                </div>
                <h3 className="text-2xl font-bold text-text-charcoal dark:text-white mb-2">Macro-Economic Pulse</h3>
                <p className="text-text-silver-light dark:text-text-silver-dark">
                    Track global supply chains and geopolitical shifts as they happen. Visualize impact radius instantly.
                </p>
            </div>
            <div className="absolute inset-0 border border-transparent group-hover:animate-pulse-border rounded-2xl pointer-events-none"></div>
        </div>
    )
}

function PredictiveForecastCard() {
    const bars = [30, 50, 40, 75, 90]

    return (
        <div className="group bento-card relative md:col-span-6 lg:col-span-7 row-span-2 rounded-2xl bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden flex flex-col md:flex-row items-center transition-all duration-500 hover:border-primary/60 shadow-sm dark:shadow-none">
            <div className="w-full md:w-1/2 p-8 flex flex-col justify-center relative z-10">
                <h3 className="text-2xl font-bold text-text-charcoal dark:text-white mb-3">Predictive Forecasting</h3>
                <p className="text-text-silver-light dark:text-text-silver-dark mb-6">
                    Move beyond reactive analytics. Our AI models simulate thousands of future scenarios to find the optimal path.
                </p>
                <a className="inline-flex items-center text-primary-dark dark:text-primary font-bold text-sm hover:underline underline-offset-4" href="#">
                    Explore Models <span className="material-symbols-outlined text-base ml-1">arrow_right_alt</span>
                </a>
            </div>
            <div className="w-full md:w-1/2 h-48 md:h-full relative bg-surface-ticker-light dark:bg-surface-highlight/40">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3/4 h-3/4 flex items-end justify-between gap-1 px-4 pb-4 border-b border-l border-border-light dark:border-border-dark">
                        {bars.map((height, i) => (
                            <div
                                key={i}
                                className={`w-full rounded-t-sm transition-all duration-300 hover:bg-primary ${i === bars.length - 1
                                        ? 'bg-primary hover:bg-primary-dark dark:hover:bg-white shadow-[0_4px_10px_rgba(212,175,55,0.3)] dark:shadow-[0_0_15px_rgba(242,208,13,0.5)]'
                                        : `bg-primary/${20 + i * 10}`
                                    }`}
                                style={{ height: `${height}%` }}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="absolute inset-0 border border-transparent group-hover:animate-pulse-border rounded-2xl pointer-events-none"></div>
        </div>
    )
}
