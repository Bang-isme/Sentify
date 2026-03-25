import { createContext, useContext } from 'react'
import { landingContent, type Language, type LandingContent } from '../content/landingContent'
export type { Language } from '../content/landingContent'

export interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  copy: LandingContent
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

export const LANGUAGES: Language[] = ['vi', 'en', 'ja']
export const LANGUAGE_OPTIONS: Array<{ code: Language; label: string }> = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]
export const DEFAULT_LANGUAGE: Language = 'vi'
export const LANGUAGE_STORAGE_KEY = 'sentify-language'

export function getLanguageCopy(language: Language) {
  return landingContent[language]
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}

