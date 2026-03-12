import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Scroll-reveal hook that toggles visibility each time the target enters
 * the viewport. When `repeat` is true the animation replays on every scroll.
 */
export function useScrollReveal(options?: { threshold?: number; repeat?: boolean }) {
  const { threshold = 0.15, repeat = true } = options ?? {}
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (!repeat) observer.disconnect()
        } else if (repeat) {
          setVisible(false)
        }
      },
      { threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, repeat])

  const revealClass = useCallback(
    (delay = 0) =>
      visible
        ? 'animate-fade-in-up'
        : 'opacity-0',
    [visible],
  )

  const revealStyle = useCallback(
    (delay = 0) =>
      visible
        ? { animationDelay: `${delay}ms`, animationFillMode: 'both' as const }
        : undefined,
    [visible],
  )

  return { ref, visible, revealClass, revealStyle }
}
