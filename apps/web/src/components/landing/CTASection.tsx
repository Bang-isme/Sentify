export function CTASection() {
    return (
        <section className="py-24 relative overflow-hidden bg-bg-light dark:bg-bg-dark">
            {/* Background glow */}
            <div className="absolute inset-0 dark:bg-bg-dark">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,208,13,0.15)_0%,rgba(0,0,0,0)_60%)]"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                <h2 className="text-4xl md:text-6xl font-bold text-text-charcoal dark:text-white mb-6 tracking-tight">
                    Ready to see{' '}
                    <span className="text-primary italic font-serif pr-2">further?</span>
                </h2>
                <p className="text-text-silver-light dark:text-text-silver-dark text-lg mb-10 max-w-2xl mx-auto">
                    Join the Fortune 500 companies already using InsightFlow to predict, adapt, and conquer their markets.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <input
                        className="w-full sm:w-80 h-14 px-6 rounded-full bg-surface-ticker-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-charcoal dark:text-white placeholder-text-silver-light dark:placeholder-text-silver-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner dark:shadow-none"
                        placeholder="Enter your work email"
                        type="email"
                    />
                    <button className="w-full sm:w-auto px-8 h-14 rounded-full bg-primary text-white dark:text-bg-dark font-bold hover:bg-primary-dark dark:hover:bg-yellow-400 transition-colors shadow-[0_10px_20px_rgba(212,175,55,0.3)] dark:shadow-[0_0_20px_rgba(242,208,13,0.3)] whitespace-nowrap">
                        Start Free Trial
                    </button>
                </div>
                <p className="mt-4 text-xs text-text-silver-light dark:text-text-silver-dark">No credit card required for 14-day trial.</p>
            </div>
        </section>
    )
}
