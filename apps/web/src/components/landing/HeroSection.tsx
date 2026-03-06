import { AsciiGlobe } from './hero/AsciiGlobe'
import { MarqueeTicker } from './MarqueeTicker'

export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-bg-light dark:bg-bg-dark">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#fdfbf7_0%,#f2efe9_100%)] dark:bg-[linear-gradient(120deg,#181711_0%,#11100c_100%)]"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-float-slow mix-blend-multiply dark:mix-blend-normal"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[80px] animate-float-medium mix-blend-multiply dark:mix-blend-normal"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(242,208,13,0.03)_0%,transparent_70%)]"></div>
        <div className="absolute bottom-0 w-full h-1/2 bg-[linear-gradient(to_bottom,transparent_0%,#f9f9f7_100%),repeating-linear-gradient(90deg,rgba(0,0,0,0.03)_0px,rgba(0,0,0,0.03)_1px,transparent_1px,transparent_100px),repeating-linear-gradient(0deg,rgba(0,0,0,0.03)_0px,rgba(0,0,0,0.03)_1px,transparent_1px,transparent_100px)] dark:bg-[linear-gradient(to_bottom,transparent_0%,#181711_100%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_100px),repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_100px)] [transform:perspective(1000px)_rotateX(60deg)_translateY(200px)] origin-bottom"></div>
      </div>
      <div className="hero-split-divider hidden lg:block" aria-hidden></div>

      <div className="relative z-10 w-full max-w-[1540px] mx-auto px-6 md:px-10 lg:px-14 pt-[3.2rem] md:pt-[3.45rem] lg:pt-[3.7rem] pb-[4.6rem] md:pb-[5.4rem]">
        <div className="hero-split-layout hero-split-canvas">
          <div className="hero-copy-pane flex flex-col items-center lg:items-start text-center lg:text-left gap-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-white dark:bg-primary/5 shadow-sm dark:shadow-none text-primary-dark dark:text-primary text-xs font-bold uppercase tracking-wider animate-fade-in-up">
              <span className="size-2 rounded-full bg-primary animate-pulse"></span>
              Variant 2.0 Live
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.05] text-text-charcoal dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-white dark:to-text-silver-dark">
              Orchestrate <br />
              <span className="font-serif italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark dark:from-primary dark:to-primary animate-text-glow pr-4">
                Intelligence
              </span>
            </h1>

            <p className="max-w-2xl text-lg md:text-xl text-text-silver-light dark:text-text-silver-dark font-light leading-relaxed">
              Elevate enterprise decision-making with cinematic data visualization and a predictive modeling engine designed for the future of business.
            </p>

            <div className="flex flex-wrap justify-center lg:justify-start gap-4 mt-2">
              <button className="group relative flex items-center gap-3 px-8 h-14 rounded-full bg-primary text-white dark:text-bg-dark text-base font-bold overflow-hidden transition-all hover:pr-6 hover:shadow-[0_10px_30px_rgba(212,175,55,0.4)] dark:hover:shadow-[0_0_30px_rgba(242,208,13,0.4)]">
                <span className="relative z-10">Request Demo</span>
                <span className="material-symbols-outlined relative z-10 text-xl transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
              <button className="flex items-center gap-3 px-8 h-14 rounded-full border border-border-light dark:border-border-dark bg-surface-white dark:bg-surface-dark/50 dark:backdrop-blur-sm text-text-charcoal dark:text-white text-base font-bold hover:bg-surface-ticker-light dark:hover:bg-surface-highlight transition-all shadow-sm dark:shadow-none">
                <span className="material-symbols-outlined text-primary">play_circle</span>
                View Showreel
              </button>
            </div>
          </div>

          <AsciiGlobe />
        </div>
      </div>

      <div className="hero-bottom-ticker relative z-30">
        <MarqueeTicker compact />
      </div>
    </section>
  )
}
