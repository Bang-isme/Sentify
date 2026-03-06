import './index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { Header } from './components/layout/Header'
import { HeroSection } from './components/landing/HeroSection'
import { BentoFeatures } from './components/landing/BentoFeatures'
import { LiveStream } from './components/landing/LiveStream'
import { CTASection } from './components/landing/CTASection'
import { Footer } from './components/layout/Footer'

function App() {
  return (
    <ThemeProvider>
      <div className="bg-bg-light dark:bg-bg-dark text-text-charcoal dark:text-white font-display min-h-screen flex flex-col overflow-x-hidden selection:bg-primary/20 dark:selection:bg-primary/30 selection:text-primary-dark dark:selection:text-primary transition-colors duration-300">
        <Header />
        <main className="flex-grow">
          <HeroSection />
          <BentoFeatures />
          <LiveStream />
          <CTASection />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  )
}

export default App
