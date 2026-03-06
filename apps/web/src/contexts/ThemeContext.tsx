import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
    theme: Theme
    toggleTheme: (e?: React.MouseEvent) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Spawns a brief radial flash + shockwave ring at the click origin.
 * Everything is GPU-only (transform + opacity) for buttery 120fps.
 */
function spawnClickEffects(x: number, y: number, isDark: boolean) {
    // ── 1. Radial glow flash ──
    const glow = document.createElement('div')
    Object.assign(glow.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: '0px',
        height: '0px',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100000',
        background: isDark
            ? 'radial-gradient(circle, rgba(230,184,20,0.6) 0%, rgba(230,184,20,0.15) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,230,0.3) 40%, transparent 70%)',
        transform: 'translate(-50%, -50%) scale(0)',
        opacity: '1',
        willChange: 'transform, opacity',
    })
    document.body.appendChild(glow)

    glow.animate(
        [
            { transform: 'translate(-50%, -50%) scale(0)', opacity: '1' },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: '0.7', offset: 0.3 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: '0' },
        ],
        { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    ).onfinish = () => glow.remove()

    // Set the glow diameter to cover the viewport diagonal
    const maxDim = Math.hypot(window.innerWidth, window.innerHeight) * 1.2
    glow.style.width = `${maxDim}px`
    glow.style.height = `${maxDim}px`

    // ── 2. Shockwave ring ──
    const ring = document.createElement('div')
    Object.assign(ring.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: '0px',
        height: '0px',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100001',
        border: isDark
            ? '2px solid rgba(230, 184, 20, 0.5)'
            : '2px solid rgba(180, 160, 80, 0.4)',
        boxShadow: isDark
            ? '0 0 20px 4px rgba(230,184,20,0.2), inset 0 0 20px 4px rgba(230,184,20,0.1)'
            : '0 0 20px 4px rgba(255,255,255,0.3), inset 0 0 20px 4px rgba(255,255,255,0.15)',
        transform: 'translate(-50%, -50%) scale(0)',
        opacity: '1',
        willChange: 'transform, opacity',
    })
    document.body.appendChild(ring)

    const ringSize = Math.hypot(window.innerWidth, window.innerHeight) * 1.6
    ring.style.width = `${ringSize}px`
    ring.style.height = `${ringSize}px`

    ring.animate(
        [
            { transform: 'translate(-50%, -50%) scale(0)', opacity: '1', borderWidth: '3px' },
            { transform: 'translate(-50%, -50%) scale(0.5)', opacity: '0.6', borderWidth: '2px', offset: 0.4 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: '0', borderWidth: '0.5px' },
        ],
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    ).onfinish = () => ring.remove()

    // ── 3. Micro-sparkle particles ──
    const PARTICLE_COUNT = 8
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement('div')
        const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4
        const distance = 60 + Math.random() * 100
        const size = 2 + Math.random() * 3

        Object.assign(particle.style, {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: '100002',
            background: isDark ? 'rgba(230,184,20,0.8)' : 'rgba(200,170,60,0.7)',
            boxShadow: isDark
                ? '0 0 6px 2px rgba(230,184,20,0.4)'
                : '0 0 6px 2px rgba(200,170,60,0.3)',
            transform: 'translate(-50%, -50%)',
            opacity: '1',
            willChange: 'transform, opacity',
        })
        document.body.appendChild(particle)

        const tx = Math.cos(angle) * distance
        const ty = Math.sin(angle) * distance

        particle.animate(
            [
                { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)', opacity: '1' },
                { transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(0)`, opacity: '0' },
            ],
            {
                duration: 400 + Math.random() * 200,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards',
                delay: 50 + Math.random() * 80,
            }
        ).onfinish = () => particle.remove()
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('insightflow-theme')
        if (stored === 'light' || stored === 'dark') {
            return stored
        }
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === 'dark') {
            root.classList.add('dark')
            root.classList.remove('light')
        } else {
            root.classList.remove('dark')
            root.classList.add('light')
        }
        localStorage.setItem('insightflow-theme', theme)
    }, [theme])

    const toggleTheme = useCallback((e?: React.MouseEvent) => {
        const x = e?.clientX ?? window.innerWidth / 2
        const y = e?.clientY ?? 0
        const nextIsDark = theme === 'light'

        // Spawn visual effects at the click point
        spawnClickEffects(x, y, nextIsDark)

        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        )

        if (document.startViewTransition) {
            const transition = document.startViewTransition(() => {
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
            })

            transition.ready.then(() => {
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration: 600,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        pseudoElement: '::view-transition-new(root)',
                    }
                )
            })
        } else {
            setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
    return ctx
}
