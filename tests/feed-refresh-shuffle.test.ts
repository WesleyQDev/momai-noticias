import { describe, it, expect } from 'vitest'
import { rankAndFilterFeed } from '../src/services/ranking'
import { buildFeedMix } from '../src/services/feed-mix'
import { shuffleWithSeed, shouldReuseSession } from '../src/services/feed-shuffle'
import type { NewsArticle, UserProfile } from '../src/services/types'
import { DEFAULT_USER_PROFILE } from '../src/services/types'

function article(id: string, overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    title: `Titulo ${id} sobre tecnologia e mercado`,
    url: `https://exemplo.com/${id}`,
    summary: 'Resumo',
    publishedAt: Date.now(),
    categories: [],
    canonicalTopics: ['tecnologia'],
    sourceId: 'fonte-a',
    sourceName: 'Fonte A',
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

describe('feed variety on refresh', () => {
  it('reorders a fixed ranked list when the seed changes', () => {
    const ranked = Array.from({ length: 12 }, (_, i) => article(`n${i}`))
    const user = profile({})

    const first = buildFeedMix(ranked, user, new Set(), { pageSize: 12, seed: 'seed-a' })
    const second = buildFeedMix(ranked, user, new Set(), { pageSize: 12, seed: 'seed-b' })

    expect(first.articles.map((item) => item.id).sort()).toEqual(
      second.articles.map((item) => item.id).sort()
    )
    expect(first.articles.map((item) => item.id)).not.toEqual(
      second.articles.map((item) => item.id)
    )
  })

  it('breaks score ties in the ranked feed instead of returning a fixed list', () => {
    const now = Date.now()
    const ranked = Array.from({ length: 10 }, (_, i) =>
      article(`t${i}`, { publishedAt: now, sourceId: 'same-source' })
    )
    const user = profile({})

    const first = (rankAndFilterFeed as any)(ranked, user, new Set(), undefined, undefined, false, 'seed-a')
    const second = (rankAndFilterFeed as any)(ranked, user, new Set(), undefined, undefined, false, 'seed-b')

    expect(first.map((item: NewsArticle) => item.id).sort()).toEqual(
      second.map((item: NewsArticle) => item.id).sort()
    )
    expect(first.map((item: NewsArticle) => item.id)).not.toEqual(
      second.map((item: NewsArticle) => item.id)
    )
  })

  it('shuffles deterministically for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    expect(shuffleWithSeed(items, 'daily-seed')).toEqual(shuffleWithSeed(items, 'daily-seed'))
    expect(shuffleWithSeed(items, 'daily-seed')).not.toEqual(shuffleWithSeed(items, 'other-seed'))
    expect([...shuffleWithSeed(items, 'daily-seed')].sort()).toEqual([...items].sort())
  })

  it('ignores the previous scroll session when refreshing', () => {
    expect(shouldReuseSession({ refresh: true, cursor: 'cursor-1' })).toBe(false)
    expect(shouldReuseSession({ refresh: false, cursor: 'cursor-1' })).toBe(true)
    expect(shouldReuseSession({ refresh: false, cursor: '' })).toBe(false)
  })
})
