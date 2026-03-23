const PLACEHOLDER_BLOCK_PATTERN = /\?{3,}|\uFF1F{3,}/u
const PLACEHOLDER_ONLY_PATTERN = /^[\s?\uFF1F]+$/u

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlaceholderText(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return false
  }

  return PLACEHOLDER_ONLY_PATTERN.test(normalized) || PLACEHOLDER_BLOCK_PATTERN.test(normalized)
}

function mergeLocaleValue<T>(fallbackValue: T, localizedValue: T | undefined): T {
  if (localizedValue === undefined) {
    return fallbackValue
  }

  if (Array.isArray(fallbackValue)) {
    if (!Array.isArray(localizedValue)) {
      return fallbackValue
    }

    const localizedArray = localizedValue as Array<unknown>
    const mergedArray = fallbackValue.map((item, index) =>
      mergeLocaleValue(item, localizedArray[index] as typeof item | undefined),
    )

    return mergedArray as T
  }

  if (isPlainObject(fallbackValue)) {
    if (!isPlainObject(localizedValue)) {
      return fallbackValue
    }

    const fallbackRecord = fallbackValue as Record<string, unknown>
    const localizedRecord = localizedValue as Record<string, unknown>
    const mergedObject: Record<string, unknown> = { ...localizedValue }

    for (const key of Object.keys(fallbackRecord)) {
      mergedObject[key] = mergeLocaleValue(fallbackRecord[key], localizedRecord[key])
    }

    return mergedObject as T
  }

  if (typeof fallbackValue === 'string') {
    if (typeof localizedValue !== 'string' || isPlaceholderText(localizedValue)) {
      return fallbackValue
    }

    return localizedValue as T
  }

  return localizedValue ?? fallbackValue
}

export function getLocaleWithFallback<
  TLocaleMap extends Record<string, unknown>,
  TLocaleKey extends keyof TLocaleMap,
>(locales: TLocaleMap, localeKey: TLocaleKey, fallbackKey: keyof TLocaleMap = 'en') {
  const fallbackLocale = locales[fallbackKey as TLocaleKey]
  const requestedLocale = locales[localeKey]

  if (localeKey === fallbackKey) {
    return fallbackLocale as TLocaleMap[TLocaleKey]
  }

  return mergeLocaleValue(fallbackLocale, requestedLocale) as TLocaleMap[TLocaleKey]
}
