import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { getDefaultLanguage, isSupportedLanguage } from './lib/i18n-routing'

void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(async (language: string) => {
      const normalizedLanguage = isSupportedLanguage(language)
        ? language
        : getDefaultLanguage()

      return import(`./locales/${normalizedLanguage}/translation.json`)
    }),
  )
  .init({
    lng: getDefaultLanguage(),
    fallbackLng: getDefaultLanguage(),
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
