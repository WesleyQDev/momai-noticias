// src/services/onboarding-options.ts
// Single source of truth for the language and topic choices shown by the
// onboarding flow and the settings view.
import type { CanonicalTopic } from './types'

export interface LanguageOption {
  code: string
  labelKey: string
  flag: string
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'pt-BR', labelKey: 'languages.ptBR', flag: '🇧🇷' },
  { code: 'en-US', labelKey: 'languages.enUS', flag: '🇺🇸' },
  { code: 'es', labelKey: 'languages.es', flag: '🇪🇸' },
  { code: 'fr', labelKey: 'languages.fr', flag: '🇫🇷' },
  { code: 'de', labelKey: 'languages.de', flag: '🇩🇪' },
  { code: 'it', labelKey: 'languages.it', flag: '🇮🇹' }
]

export interface TopicOption {
  id: CanonicalTopic
  labelKey: string
  icon: string
}

export const CANONICAL_TOPICS: TopicOption[] = [
  { id: 'tecnologia', labelKey: 'topics.tecnologia', icon: '💻' },
  { id: 'economia', labelKey: 'topics.economia', icon: '📈' },
  { id: 'politica', labelKey: 'topics.politica', icon: '🏛️' },
  { id: 'ciencia', labelKey: 'topics.ciencia', icon: '🔬' },
  { id: 'esportes', labelKey: 'topics.esportes', icon: '⚽' },
  { id: 'cultura', labelKey: 'topics.cultura', icon: '🎬' },
  { id: 'games', labelKey: 'topics.games', icon: '🎮' },
  { id: 'saude', labelKey: 'topics.saude', icon: '🏥' },
  { id: 'mundo', labelKey: 'topics.mundo', icon: '🌍' }
]

export interface NewsTypeOption {
  id: string
  labelKey: string
  descKey: string
  icon: string
}

export const TICKER_NEWS_TYPES: NewsTypeOption[] = [
  {
    id: 'quotes',
    labelKey: 'newsTypes.quotes',
    descKey: 'newsTypes.quotesDesc',
    icon: '💵'
  },
  {
    id: 'polls',
    labelKey: 'newsTypes.polls',
    descKey: 'newsTypes.pollsDesc',
    icon: '🗳️'
  },
  {
    id: 'urgent',
    labelKey: 'newsTypes.urgent',
    descKey: 'newsTypes.urgentDesc',
    icon: '🚨'
  },
  {
    id: 'headlines',
    labelKey: 'newsTypes.headlines',
    descKey: 'newsTypes.headlinesDesc',
    icon: '📰'
  }
]
