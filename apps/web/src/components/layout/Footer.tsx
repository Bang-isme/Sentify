export function Footer() {
    return (
        <footer className="bg-surface-ticker-light dark:bg-surface-footer-dark border-t border-border-light dark:border-border-dark pt-16 pb-8">
            <div className="max-w-[1440px] mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
                    {/* Brand */}
                    <div className="col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-6 text-primary">
                                <span className="material-symbols-outlined text-2xl">token</span>
                            </div>
                            <h2 className="text-text-charcoal dark:text-white text-lg font-bold">InsightFlow</h2>
                        </div>
                        <p className="text-text-silver-light dark:text-text-silver-dark text-sm leading-relaxed max-w-xs mb-6">
                            The world's most advanced predictive modeling engine for enterprise decision making.
                        </p>
                        <div className="flex gap-4">
                            {['rocket_launch', 'alternate_email', 'rss_feed'].map((icon) => (
                                <a key={icon} className="text-text-silver-light dark:text-text-silver-dark hover:text-primary transition-colors" href="#">
                                    <span className="material-symbols-outlined">{icon}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Link columns */}
                    {[
                        { title: 'Product', links: ['Intelligence Engine', 'Data Visualization', 'Integrations', 'Enterprise Security'] },
                        { title: 'Resources', links: ['Documentation', 'API Reference', 'Case Studies', 'Community'] },
                        { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
                    ].map((col) => (
                        <div key={col.title}>
                            <h4 className="text-text-charcoal dark:text-white font-bold mb-6">{col.title}</h4>
                            <ul className="space-y-4 text-sm text-text-silver-light dark:text-text-silver-dark">
                                {col.links.map((link) => (
                                    <li key={link}>
                                        <a className="hover:text-primary transition-colors" href="#">{link}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="pt-8 border-t border-border-light dark:border-border-dark flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-text-silver-light dark:text-text-silver-dark">
                    <p>© 2024 InsightFlow Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        {['Privacy Policy', 'Terms of Service', 'Cookies Settings'].map((text) => (
                            <a key={text} className="hover:text-text-charcoal dark:hover:text-white" href="#">{text}</a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    )
}
