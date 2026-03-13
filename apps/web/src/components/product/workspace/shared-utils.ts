import type { SentimentBreakdownRow } from '../../../lib/api'

export function formatNumber(
  value: number,
  language: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(language, options).format(value)
}

export function formatPercentage(value: number, language: string) {
  return `${formatNumber(value, language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

export function formatRating(value: number, language: string) {
  return formatNumber(value, language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatReviewDate(value: string | null, language: string, fallback: string) {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string | null, language: string, fallback: string) {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatSourcePreview(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    const compactPath = url.pathname.length > 36 ? `${url.pathname.slice(0, 36)}...` : url.pathname
    return `${url.hostname}${compactPath}`
  } catch {
    return value.length > 56 ? `${value.slice(0, 56)}...` : value
  }
}

export function getReviewToneClasses(sentiment: SentimentBreakdownRow['label'] | null, rating: number) {
  if (sentiment === 'NEGATIVE' || rating <= 2) {
    return {
      badge: 'border-amber-300/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200',
      rail: 'before:bg-amber-400/75',
    }
  }

  if (sentiment === 'POSITIVE' || rating >= 4) {
    return {
      badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200',
      rail: 'before:bg-emerald-400/75',
    }
  }

  return {
    badge: 'border-border-light/70 bg-bg-light/70 text-text-charcoal dark:border-border-dark dark:bg-bg-dark/55 dark:text-white',
    rail: 'before:bg-primary/70',
  }
}
