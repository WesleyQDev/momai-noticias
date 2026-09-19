// src/services/i18n.ts
import { useState, useEffect, useCallback } from 'react'
import sdk from 'momai:sdk'

import ptBR from '../../locales/pt-BR.json'
import enUS from '../../locales/en-US.json'
import es from '../../locales/es.json'
import fr from '../../locales/fr.json'
import de from '../../locales/de.json'
import it from '../../locales/it.json'

const DICTIONARIES: Record<string, any> = {
  'pt-BR': ptBR,
  'pt': ptBR,
  'en-US': enUS,
  'en': enUS,
  'es': es,
  'fr': fr,
  'de': de,
  'it': it
}

export function getAppLocale(): string {
  try {
    const raw = sdk?.locale || (window as any)?.MomAISDK?.locale || navigator?.language || 'pt-BR'
    if (DICTIONARIES[raw]) return raw
    const prefix = raw.split('-')[0]
    if (DICTIONARIES[prefix]) return prefix
  } catch {}
  return 'pt-BR'
}

export function translate(key: string, params: Record<string, any> = {}, lang?: string): string {
  const activeLang = lang || getAppLocale()
  const dict = DICTIONARIES[activeLang] || DICTIONARIES['pt-BR']

  const parts = key.split('.')
  let current: any = dict

  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      current = current[p]
    } else {
      // Fallback to pt-BR
      let fb: any = DICTIONARIES['pt-BR']
      for (const f of parts) {
        if (fb && typeof fb === 'object' && f in fb) {
          fb = fb[f]
        } else {
          return key
        }
      }
      current = fb
      break
    }
  }

  if (typeof current !== 'string') return key

  let result = current
  for (const [param, val] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), String(val))
  }
  return result
}

export function useExtensionLocale() {
  const [locale, setLocale] = useState(getAppLocale)

  useEffect(() => {
    const handleLocaleChange = () => setLocale(getAppLocale())
    window.addEventListener('languagechange', handleLocaleChange)
    return () => window.removeEventListener('languagechange', handleLocaleChange)
  }, [])

  const t = useCallback((key: string, params?: Record<string, any>) => {
    return translate(key, params, locale)
  }, [locale])

  return {
    locale,
    t
  }
}

export function formatRelativeTime(timestamp: number, t: (k: string, p?: any) => string): string {
  if (!timestamp) return ''
  const diffMs = Math.max(0, Date.now() - timestamp)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 5) return t('time.justNow')
  if (diffMinutes < 60) return t('time.minutesAgo', { count: diffMinutes })
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
  return t('time.daysAgo', { count: diffDays })
}
