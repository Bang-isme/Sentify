import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './useTheme'

/**
 * Spawns a brief radial flash + shockwave ring at the click origin.
 * All 10 elements are built off-DOM in a DocumentFragment, then
 * appended in a single reflow. Animations use only compositor-friendly
 * properties (transform + opacity).
 */
function spawnClickEffects(x: number, y: number, isDark: boolean) {
    const fragment = document.createDocumentFragment()

    // ── 1. Radial glow flash ──
    const glow = document.createElement('div')
    const maxDim = Math.hypot(window.innerWidth, window.innerHeight) * 1.2
    Object.assign(glow.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: `${maxDim}px`,
        height: `${maxDim}px`,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100000',
        contain: 'strict',
        background: isDark
            ? 'radial-gradient(circle, rgba(230,184,20,0.6) 0%, rgba(230,184,20,0.15) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,230,0.3) 40%, transparent 70%)',
        transform: 'translate(-50%, -50%) scale(0)',
        opacity: '1',
        willChange: 'transform, opacity',
    })
    fragment.appendChild(glow)

    // ── 2. Shockwave ring ──
    const ring = document.createElement('div')
    const ringSize = Math.hypot(window.innerWidth, window.innerHeight) * 1.6
    Object.assign(ring.style, {
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: `${ringSize}px`,
        height: `${ringSize}px`,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '100001',
        contain: 'strict',
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
    fragment.appendChild(ring)

    // ── 3. Micro-sparkle particles ──
    const PARTICLE_COUNT = 8
    const particles: HTMLDivElement[] = []
    const particleAngles: number[] = []
    const particleDistances: number[] = []
    const particleDelays: number[] = []
    const particleDurations: number[] = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement('div')
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
            contain: 'strict',
            background: isDark ? 'rgba(230,184,20,0.8)' : 'rgba(200,170,60,0.7)',
            boxShadow: isDark
                ? '0 0 6px 2px rgba(230,184,20,0.4)'
                : '0 0 6px 2px rgba(200,170,60,0.3)',
            transform: 'translate(-50%, -50%)',
            opacity: '1',
            willChange: 'transform, opacity',
        })
        fragment.appendChild(particle)
        particles.push(particle)
        particleAngles.push((Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4)
        particleDistances.push(60 + Math.random() * 100)
        particleDelays.push(50 + Math.random() * 80)
        particleDurations.push(400 + Math.random() * 200)
    }

    // Single DOM insertion → single reflow for all 10 elements
    document.body.appendChild(fragment)

    // Start animations in next frame so browser has time to composite
    requestAnimationFrame(() => {
        glow.animate(
            [
                { transform: 'translate(-50%, -50%) scale(0)', opacity: '1' },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: '0.7', offset: 0.3 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: '0' },
            ],
            { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
        ).onfinish = () => glow.remove()

        ring.animate(
            [
                { transform: 'translate(-50%, -50%) scale(0)', opacity: '1', borderWidth: '3px' },
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: '0.6', borderWidth: '2px', offset: 0.4 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: '0', borderWidth: '0.5px' },
            ],
            { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        ).onfinish = () => ring.remove()

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const tx = Math.cos(particleAngles[i]) * particleDistances[i]
            const ty = Math.sin(particleAngles[i]) * particleDistances[i]

            particles[i].animate(
                [
                    { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)', opacity: '1' },
                    { transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(0)`, opacity: '0' },
                ],
                {
                    duration: particleDurations[i],
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'forwards',
                    delay: particleDelays[i],
                }
            ).onfinish = () => particles[i].remove()
        }
    })
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

        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        )

        if (document.startViewTransition) {
            // Pause globe rAF loop to free main thread during transition
            window.dispatchEvent(new CustomEvent('globe:pause'))

            const transition = document.startViewTransition(() => {
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
            })

            transition.ready.then(() => {
                // Spawn click effects AFTER the old-state snapshot is captured
                // so they don't get frozen into the bitmap
                spawnClickEffects(x, y, nextIsDark)

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

            // Resume globe after transition finishes (success or failure)
            transition.finished.then(() => {
                window.dispatchEvent(new CustomEvent('globe:resume'))
            }).catch(() => {
                window.dispatchEvent(new CustomEvent('globe:resume'))
            })
        } else {
            spawnClickEffects(x, y, nextIsDark)
            setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
