import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  LanguageContext,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  getLanguageCopy,
  type Language,
} from './languageContext'

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)

  if (stored === 'en' || stored === 'vi' || stored === 'ja') {
    return stored
  }

  const browserLanguage = navigator.language.toLowerCase()

  if (browserLanguage.startsWith('vi')) {
    return 'vi'
  }

  if (browserLanguage.startsWith('ja')) {
    return 'ja'
  }

  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectInitialLanguage)

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  const copy = useMemo(() => getLanguageCopy(language), [language])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = copy.meta.title

    const description = document.querySelector('meta[name="description"]')
    if (description) {
      description.setAttribute('content', copy.meta.description)
    }
  }, [copy.meta.description, copy.meta.title, language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () =>
        setLanguage((current: Language) => {
          const currentIndex = LANGUAGES.indexOf(current)
          const nextIndex = (currentIndex + 1) % LANGUAGES.length
          return LANGUAGES[nextIndex]
        }),
      copy,
    }),
    [copy, language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

