import { describe, it, expect } from 'vitest'
import { buildFeedMix, classifyFeedPool, spreadSameCategory } from '../src/services/feed-mix'
import type { NewsArticle, UserProfile } from '../src/services/types'
import { DEFAULT_USER_PROFILE } from '../src/services/types'

function article(id: string, overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    title: `Titulo ${id}`,
    url: `https://exemplo.com/${id}`,
    summary: 'Resumo',
    publishedAt: Date.now(),
    categories: [],
    canonicalTopics: ['geral'],
    sourceId: `fonte-${id}`,
    sourceName: 'Fonte',
    language: 'pt-BR',
    ...overrides
  }
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...DEFAULT_USER_PROFILE,
    interests: [],
    followedSources: [],
    affinityBySource: {},
    affinityByTopic: {},
    affinityByTerm: {},
    ...overrides
  }
}

describe('Feed mix', () => {
  it('classifies articles into personal, variety and explore pools', () => {
    const user = profile({ interests: ['tecnologia'], followedSources: ['seguida'], affinityBySource: { aprendida: 4 } })

    expect(classifyFeedPool(article('1', { canonicalTopics: ['tecnologia'] }), user)).toBe('personal')
    expect(classifyFeedPool(article('2', { sourceId: 'aprendida' }), user)).toBe('personal')
    expect(classifyFeedPool(article('3', { sourceId: 'seguida', canonicalTopics: ['esportes'] }), user)).toBe('variety')
    expect(classifyFeedPool(article('4', { sourceId: 'nova', canonicalTopics: ['esportes'] }), user)).toBe('explore')
  })

  it('interleaves the pools roughly by the configured shares', () => {
    const personal = Array.from({ length: 30 }, (_, i) => article(`p${i}`, { canonicalTopics: ['tecnologia'] }))
    const variety = Array.from({ length: 10 }, (_, i) => article(`v${i}`, { sourceId: 'seguida', canonicalTopics: ['esportes'] }))
    const explore = Array.from({ length: 10 }, (_, i) => article(`e${i}`, { sourceId: 'nova', canonicalTopics: ['mundo'] }))
    const user = profile({ interests: ['tecnologia'], followedSources: ['seguida'] })

    const result = buildFeedMix([...personal, ...variety, ...explore], user, new Set(), { pageSize: 20 })
    const first20 = result.articles.slice(0, 20).map((item) => classifyFeedPool(item, user))
    const personalCount = first20.filter((pool) => pool === 'personal').length
    const varietyCount = first20.filter((pool) => pool === 'variety').length
    const exploreCount = first20.filter((pool) => pool === 'explore').length

    expect(personalCount).toBeGreaterThanOrEqual(9)
    expect(personalCount).toBeLessThanOrEqual(13)
    expect(varietyCount).toBeGreaterThanOrEqual(4)
    expect(exploreCount).toBeGreaterThanOrEqual(1)
  })

  it('keeps every article exactly once even when a pool is short', () => {
    const ranked = [
      article('1', { canonicalTopics: ['tecnologia'] }),
      article('2', { sourceId: 'seguida', canonicalTopics: ['esportes'] }),
      article('3', { sourceId: 'nova', canonicalTopics: ['mundo'] })
    ]
    const user = profile({ interests: ['tecnologia'], followedSources: ['seguida'] })

    const result = buildFeedMix(ranked, user, new Set(), { pageSize: 50 })
    const ids = result.articles.map((item) => item.id)

    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(result.counts).toEqual({ personal: 1, variety: 1, explore: 1 })
  })

  it('still fills the page when there is nothing personal to show', () => {
    const ranked = Array.from({ length: 12 }, (_, i) => article(`n${i}`, { sourceId: `nova-${i}`, canonicalTopics: ['mundo'] }))
    const user = profile({})

    const result = buildFeedMix(ranked, user, new Set(), { pageSize: 10 })

    expect(result.articles).toHaveLength(10)
    expect(result.counts.personal).toBe(0)
  })

  it('spreads sources so a single feed cannot fill the page', () => {
    const ranked = [
      ...Array.from({ length: 30 }, (_, i) => article(`g${i}`, { sourceId: 'g1', canonicalTopics: ['geral'] })),
      ...Array.from({ length: 5 }, (_, i) => article(`b${i}`, { sourceId: 'bbc', canonicalTopics: ['mundo'] })),
      ...Array.from({ length: 5 }, (_, i) => article(`u${i}`, { sourceId: 'uol', canonicalTopics: ['economia'] }))
    ]
    const user = profile({ followedSources: ['g1', 'bbc', 'uol'] })

    const result = buildFeedMix(ranked, user, new Set(), { pageSize: 15 })
    const sources = result.articles.map((item) => item.sourceId)

    expect(result.articles).toHaveLength(15)
    expect(new Set(sources).size).toBe(3)
    expect(sources.filter((source) => source === 'g1').length).toBeLessThanOrEqual(9)
    expect(sources.filter((source) => source === 'bbc').length).toBeGreaterThanOrEqual(3)
  })

  it('avoids placing two articles of the same topic back to back', () => {
    const ranked = [
      article('1', { canonicalTopics: ['tecnologia'] }),
      article('2', { canonicalTopics: ['tecnologia'] }),
      article('3', { canonicalTopics: ['tecnologia'] }),
      article('4', { canonicalTopics: ['economia'] }),
      article('5', { canonicalTopics: ['mundo'] })
    ]

    const spread = spreadSameCategory(ranked)
    const topics = spread.map((item) => item.canonicalTopics[0])

    for (let i = 1; i < topics.length; i += 1) {
      expect(topics[i]).not.toBe(topics[i - 1])
    }
    expect(spread.map((item) => item.id).sort()).toEqual(['1', '2', '3', '4', '5'])
  })
})
