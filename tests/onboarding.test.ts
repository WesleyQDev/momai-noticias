import { describe, it, expect } from 'vitest'
import { DEFAULT_USER_PROFILE } from '../src/services/types'
import { rankAndFilterFeed } from '../src/services/ranking'
import type { NewsArticle, UserProfile } from '../src/services/types'

describe('Onboarding Fallback Rules', () => {
  it('should guarantee default profile has valid languages and sources to avoid empty feed', () => {
    expect(DEFAULT_USER_PROFILE.languages.length).toBeGreaterThan(0)
    expect(DEFAULT_USER_PROFILE.interests.length).toBeGreaterThan(0)
    expect(DEFAULT_USER_PROFILE.followedSources.length).toBeGreaterThan(0)
  })

  it('should rank and return articles even if user skips onboarding without custom selections', () => {
    const skippedProfile: UserProfile = {
      version: 1,
      onboardingCompleted: true,
      languages: ['pt-BR'],
      interests: ['tecnologia', 'geral'],
      followedSources: ['g1-geral', 'tecnoblog'],
      blockedSources: [],
      mutedKeywords: [],
      customSources: [],
      affinityBySource: {},
      affinityByTopic: {},
      affinityByTerm: {}
    }

    const mockArticles: NewsArticle[] = [
      {
        id: '1',
        title: 'Notícia de Tecnologia Geral',
        url: 'https://tecnoblog.net/post1',
        summary: 'Resumo tech',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['tecnologia'],
        sourceId: 'tecnoblog',
        sourceName: 'Tecnoblog',
        language: 'pt-BR'
      },
      {
        id: '2',
        title: 'Notícia de Economia Geral',
        url: 'https://g1.globo.com/post2',
        summary: 'Resumo econ',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['economia'],
        sourceId: 'g1-geral',
        sourceName: 'G1',
        language: 'pt-BR'
      }
    ]

    const result = rankAndFilterFeed(mockArticles, skippedProfile)
    expect(result.length).toBe(2)
  })

  it('should allow followed foreign language source to be shown despite language filter', () => {
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      languages: ['pt-BR'],
      followedSources: ['the-verge'] // user specifically follows The Verge (en-US)
    }

    const mockArticles: NewsArticle[] = [
      {
        id: '1',
        title: 'Verge Top Story',
        url: 'https://theverge.com/story1',
        summary: 'Summary',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['tecnologia'],
        sourceId: 'the-verge',
        sourceName: 'The Verge',
        language: 'en-US'
      }
    ]

    const result = rankAndFilterFeed(mockArticles, profile)
    expect(result.length).toBe(1)
    expect(result[0].sourceId).toBe('the-verge')
  })
})
