import { useTheme } from '../../contexts/ThemeContext'

export function Header() {
    const { theme, toggleTheme } = useTheme()

    return (
        <header className="fixed inset-x-0 top-2 md:top-3 z-50 flex justify-center pointer-events-none">
            <div className="w-full max-w-[1080px] mx-4 pointer-events-auto frosted-glass bg-surface-white/80 dark:bg-surface-dark/90 dark:backdrop-blur-xl border border-border-light/70 dark:border-border-dark/70 rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] px-4 md:px-6 h-14 flex items-center gap-8 transition-all duration-300 hover:border-primary/30 dark:hover:border-primary/20 hover:shadow-[0_10px_40px_-10px_rgba(212,175,55,0.15)]">

                {/* Logo */}
                <a className="flex items-center gap-2 group cursor-pointer mr-2" href="#">
                    <div className="size-6 text-primary transition-transform duration-500 group-hover:rotate-180">
                        <span className="material-symbols-outlined text-2xl">token</span>
                    </div>
                    <span className="text-text-charcoal dark:text-white text-lg font-bold tracking-tight hidden sm:block">
                        InsightFlow
                    </span>
                </a>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-6">
                    {['Solutions', 'Platform', 'Pricing', 'Resources'].map((item) => (
                        <a
                            key={item}
                            className="text-xs font-medium text-text-silver-light dark:text-text-silver-dark hover:text-primary-dark dark:hover:text-primary transition-colors uppercase tracking-wide"
                            href="#"
                        >
                            {item}
                        </a>
                    ))}
                </nav>

                {/* Right actions */}
                <div className="flex items-center gap-3 ml-auto">
                    {/* Theme toggle */}
                    <button
                        onClick={(e) => toggleTheme(e)}
                        aria-label="Toggle theme"
                        className="flex items-center justify-center size-8 rounded-full text-text-silver-light dark:text-text-silver-dark hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 hover:scale-110 active:scale-90 hover:shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                    >
                        <span className="material-symbols-outlined text-lg">
                            {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                        </span>
                    </button>

                    {/* Language selector */}
                    <div className="relative group">
                        <button className="flex items-center gap-1 text-xs font-bold text-text-silver-light dark:text-text-silver-dark hover:text-text-charcoal dark:hover:text-white transition-colors h-8 px-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                            <span className="uppercase">EN</span>
                            <span className="material-symbols-outlined text-base">expand_more</span>
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-24 bg-surface-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                            <div className="py-1">
                                <a className="block px-4 py-2 text-xs text-primary bg-primary/5 dark:bg-white/5 font-medium" href="#">EN</a>
                                <a className="block px-4 py-2 text-xs text-text-silver-light dark:text-text-silver-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-charcoal dark:hover:text-white transition-colors" href="#">VI</a>
                                <a className="block px-4 py-2 text-xs text-text-silver-light dark:text-text-silver-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-charcoal dark:hover:text-white transition-colors" href="#">JP</a>
                            </div>
                        </div>
                    </div>

                    <div className="h-4 w-px bg-border-light dark:bg-border-dark mx-1 hidden sm:block"></div>

                    <button className="hidden sm:block text-xs font-bold text-text-charcoal dark:text-white hover:text-primary-dark dark:hover:text-primary transition-colors px-2">
                        Log In
                    </button>
                    <button className="flex items-center justify-center px-4 h-9 rounded-full bg-primary text-white dark:text-bg-dark text-xs font-bold hover:bg-primary-dark dark:hover:bg-yellow-400 transition-colors shadow-[0_4px_14px_rgba(212,175,55,0.4)] dark:shadow-[0_0_10px_rgba(242,208,13,0.15)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.6)] dark:hover:shadow-[0_0_20px_rgba(242,208,13,0.3)]">
                        Get Started
                    </button>
                </div>
            </div>
        </header>
    )
}
