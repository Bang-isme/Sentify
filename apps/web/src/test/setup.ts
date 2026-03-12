import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    value: (id: number) => window.clearTimeout(id),
  })

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(Element.prototype, 'animate', {
    writable: true,
    value: vi.fn(() => ({
      cancel: vi.fn(),
      finished: Promise.resolve(),
      onfinish: null,
      pause: vi.fn(),
      play: vi.fn(),
    })),
  })

  Object.defineProperty(document, 'fonts', {
    writable: true,
    value: {
      ready: Promise.resolve(),
    },
  })

  Object.defineProperty(document, 'startViewTransition', {
    writable: true,
    value: vi.fn((callback: () => void) => {
      callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
      }
    }),
  })

  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
  window.location.hash = ''
  vi.clearAllMocks()
})
