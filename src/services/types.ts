// src/services/types.ts

export type CanonicalTopic =
  | 'tecnologia'
  | 'economia'
  | 'politica'
  | 'ciencia'
  | 'esportes'
  | 'cultura'
  | 'games'
  | 'saude'
  | 'mundo'
  | 'geral'

export type ArticleFeedback = 'like' | 'dislike'

export interface NewsArticle {
  id: string
  title: string
  url: string
  summary: string
  image?: string
  publishedAt: number
  categories: string[]
  canonicalTopics: CanonicalTopic[]
  sourceId: string
  sourceName: string
  language: string
  author?: string
  score?: number
}

export interface SavedArticle extends NewsArticle {
  savedAt: number
  note?: string
}

export interface FeedSource {
  id: string
  title: string
  homepage: string
  feed: string
  language: string
  topics: CanonicalTopic[]
  region?: string
  isCustom?: boolean
  enabled?: boolean
}

export interface UserProfile {
  version: number
  onboardingCompleted: boolean
  languages: string[]
  interests: CanonicalTopic[]
  followedSources: string[]
  blockedSources: string[]
  mutedKeywords: string[]
  customSources: FeedSource[]
  affinityBySource: Record<string, number>
  affinityByTopic: Record<string, number>
  affinityByTerm: Record<string, number>
  lastInteractionAt?: number
  retentionDays?: number
  autoSyncIntervalMinutes?: number
  lastSyncAt?: number
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  version: 1,
  onboardingCompleted: false,
  languages: ['pt-BR'],
  interests: ['tecnologia', 'economia', 'ciencia', 'mundo', 'geral'],
  followedSources: ['g1-geral', 'tecnoblog', 'bbc-brasil', 'canaltech', 'infomoney'],
  blockedSources: [],
  mutedKeywords: [],
  customSources: [],
  affinityBySource: {},
  affinityByTopic: {},
  affinityByTerm: {},
  retentionDays: 3,
  autoSyncIntervalMinutes: 15
}

export interface FeedResponse {
  ok: boolean
  articles: NewsArticle[]
  total?: number
  hasMore?: boolean
  cursor?: string
  nextOffset?: number
  offset?: number
  syncing?: boolean
  error?: string
}

export interface BriefingResponse {
  ok: boolean
  briefing: {
    topic: CanonicalTopic
    topicLabel: string
    articles: NewsArticle[]
  }[]
  generatedAt: number
  directResponse?: string
  error?: string
}
