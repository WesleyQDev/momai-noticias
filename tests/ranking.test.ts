import { describe, it, expect } from 'vitest'
import {
  calculateRecencyScore,
  calculateArticleScore,
  applyDiversityLimit,
  decayAffinities,
  normalizeAffinity,
  rankAndFilterFeed
} from '../src/services/ranking'
import type { NewsArticle, UserProfile } from '../src/services/types'
import { DEFAULT_USER_PROFILE } from '../src/services/types'

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'a',
    title: 'Titulo',
    url: 'https://exemplo.com/a',
    summary: 'Resumo',
    publishedAt: Date.now(),
    categories: [],
    canonicalTopics: ['geral'],
    sourceId: 'fonte',
    sourceName: 'Fonte',
    language: 'pt-BR',
    ...overrides
  }
}

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    ...DEFAULT_USER_PROFILE,
    interests: [],
    followedSources: [],
    affinityBySource: {},
    affinityByTopic: {},
    ...overrides
  }
}

describe('Ranking and Scoring Engine', () => {
  it('should apply exponential decay to older articles', () => {
    const now = 1700000000000
    const freshTime = now - 1 * 60 * 60 * 1000 // 1 hour ago
    const oldTime = now - 28 * 60 * 60 * 1000 // 2 half-lives (28 hours) ago

    const freshScore = calculateRecencyScore(freshTime, now)
    const oldScore = calculateRecencyScore(oldTime, now)

    expect(freshScore).toBeGreaterThan(0.9)
    expect(oldScore).toBeCloseTo(0.25, 1)
  })

  it('should score interested and followed articles higher', () => {
    const now = Date.now()
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      interests: ['tecnologia'],
      followedSources: ['tecnoblog']
    }

    const techArticle: NewsArticle = {
      id: '1',
      title: 'Lançamento de placa de vídeo',
      url: 'https://tecnoblog.net/gpu',
      summary: 'Nova GPU',
      publishedAt: now,
      categories: [],
      canonicalTopics: ['tecnologia'],
      sourceId: 'tecnoblog',
      sourceName: 'Tecnoblog',
      language: 'pt-BR'
    }

    const genericArticle: NewsArticle = {
      id: '2',
      title: 'Tempo no final de semana',
      url: 'https://outro.com/tempo',
      summary: 'Previsão do tempo',
      publishedAt: now,
      categories: [],
      canonicalTopics: ['geral'],
      sourceId: 'outro',
      sourceName: 'Outro',
      language: 'pt-BR'
    }

    const techScore = calculateArticleScore(techArticle, profile, new Set(), now)
    const genericScore = calculateArticleScore(genericArticle, profile, new Set(), now)

    expect(techScore).toBeGreaterThan(genericScore)
  })

  it('should penalize muted keywords or blocked sources to 0 / negative', () => {
    const now = Date.now()
    const profile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      mutedKeywords: ['fofoca', 'spoiler'],
      blockedSources: ['site-ruim']
    }

    const mutedArticle: NewsArticle = {
      id: '1',
      title: 'Grande spoiler do filme',
      url: 'https://site.com/spoiler',
      summary: 'Cuidado com spoiler',
      publishedAt: now,
      categories: [],
      canonicalTopics: ['cultura'],
      sourceId: 'site-ok',
      sourceName: 'Site',
      language: 'pt-BR'
    }

    const blockedArticle: NewsArticle = {
      id: '2',
      title: 'Notícia normal',
      url: 'https://site-ruim.com/noticia',
      summary: 'Resumo',
      publishedAt: now,
      categories: [],
      canonicalTopics: ['geral'],
      sourceId: 'site-ruim',
      sourceName: 'Site Ruim',
      language: 'pt-BR'
    }

    expect(calculateArticleScore(mutedArticle, profile, new Set(), now)).toBeLessThanOrEqual(0)
    expect(calculateArticleScore(blockedArticle, profile, new Set(), now)).toBeLessThanOrEqual(0)
  })

  it('should enforce diversity by avoiding more than 2 consecutive articles from the same source', () => {
    const articles: NewsArticle[] = [
      { id: '1', title: 'A1', url: 'u1', summary: '', publishedAt: 0, categories: [], canonicalTopics: ['geral'], sourceId: 'srcA', sourceName: 'A', language: 'pt-BR' },
      { id: '2', title: 'A2', url: 'u2', summary: '', publishedAt: 0, categories: [], canonicalTopics: ['geral'], sourceId: 'srcA', sourceName: 'A', language: 'pt-BR' },
      { id: '3', title: 'A3', url: 'u3', summary: '', publishedAt: 0, categories: [], canonicalTopics: ['geral'], sourceId: 'srcA', sourceName: 'A', language: 'pt-BR' },
      { id: '4', title: 'B1', url: 'u4', summary: '', publishedAt: 0, categories: [], canonicalTopics: ['geral'], sourceId: 'srcB', sourceName: 'B', language: 'pt-BR' }
    ]

    const diversified = applyDiversityLimit(articles, 2)
    expect(diversified[0].sourceId).toBe('srcA')
    expect(diversified[1].sourceId).toBe('srcA')
    expect(diversified[2].sourceId).toBe('srcB') // interleaved
    expect(diversified[3].sourceId).toBe('srcA')
  })
})

describe('Learned affinities', () => {
  it('should saturate affinities so a heavily favoured source cannot dominate', () => {
    expect(normalizeAffinity(0)).toBe(0)
    expect(normalizeAffinity(5)).toBeGreaterThan(0.5)
    expect(normalizeAffinity(60)).toBeLessThan(1.01)

    const now = Date.now()
    const profile = makeProfile({ affinityBySource: { favorita: 60 } })
    const favourite = makeArticle({ sourceId: 'favorita', publishedAt: now })
    const neutral = makeArticle({ sourceId: 'neutra', publishedAt: now })

    const ratio =
      calculateArticleScore(favourite, profile, new Set(), now) /
      calculateArticleScore(neutral, profile, new Set(), now)

    expect(ratio).toBeLessThan(3)
    expect(ratio).toBeGreaterThan(1)
  })

  it('should boost sources and topics the user interacted with', () => {
    const now = Date.now()
    const learned = makeProfile({
      affinityBySource: { tecnologa: 4 },
      affinityByTopic: { tecnologia: 4 }
    })
    const plain = makeProfile({})

    const article = makeArticle({
      sourceId: 'tecnologa',
      canonicalTopics: ['tecnologia'],
      publishedAt: now
    })

    expect(calculateArticleScore(article, learned, new Set(), now)).toBeGreaterThan(
      calculateArticleScore(article, plain, new Set(), now)
    )
  })

  it('should decay learned affinities with time so old habits fade', () => {
    const decayed = decayAffinities({ tecnologia: 8, tecnoblog: 4 }, 7)

    expect(decayed.tecnologia).toBeCloseTo(4, 1)
    expect(decayed.tecnoblog).toBeCloseTo(2, 1)
  })

  it('should keep affinities untouched when no time has passed', () => {
    expect(decayAffinities({ a: 3 }, 0)).toEqual({ a: 3 })
    expect(decayAffinities(undefined, 10)).toEqual({})
  })

  it('should keep seen articles in the ranking instead of dropping them out', () => {
    const now = Date.now()
    const profile = makeProfile({})
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000

    const article = makeArticle({ publishedAt: threeDaysAgo, canonicalTopics: ['geral'] })
    const score = calculateArticleScore(article, profile, new Set([article.id]), now)
    const unseenScore = calculateArticleScore(article, profile, new Set(), now)

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(unseenScore)
  })

  it('should lower the score of sources and topics the user disliked', () => {
    const now = Date.now()
    const disliked = makeProfile({ affinityBySource: { ruim: -6 }, affinityByTopic: { esportes: -6 } })
    const neutral = makeProfile({})

    const fromDislikedSource = makeArticle({ sourceId: 'ruim', canonicalTopics: ['geral'], publishedAt: now })
    const aboutDislikedTopic = makeArticle({ sourceId: 'outra', canonicalTopics: ['esportes'], publishedAt: now })
    const plain = makeArticle({ sourceId: 'outra', canonicalTopics: ['geral'], publishedAt: now })

    expect(calculateArticleScore(fromDislikedSource, disliked, new Set(), now)).toBeLessThan(
      calculateArticleScore(plain, disliked, new Set(), now)
    )
    expect(calculateArticleScore(aboutDislikedTopic, disliked, new Set(), now)).toBeLessThan(
      calculateArticleScore(plain, disliked, new Set(), now)
    )
    expect(calculateArticleScore(plain, disliked, new Set(), now)).toBeCloseTo(
      calculateArticleScore(plain, neutral, new Set(), now),
      5
    )
    expect(calculateArticleScore(fromDislikedSource, disliked, new Set(), now)).toBeGreaterThan(0)
  })

  it('should boost headlines matching terms the user liked', () => {
    const now = Date.now()
    const learned = makeProfile({ affinityByTerm: { inteligencia: 4, artificial: 4 } })
    const plain = makeProfile({})

    const matching = makeArticle({ title: 'Nova inteligência artificial chega ao mercado', publishedAt: now })
    const unrelated = makeArticle({ title: 'Time vence campeonato regional', publishedAt: now })

    expect(calculateArticleScore(matching, learned, new Set(), now)).toBeGreaterThan(
      calculateArticleScore(unrelated, learned, new Set(), now)
    )
    expect(calculateArticleScore(matching, learned, new Set(), now)).toBeGreaterThan(
      calculateArticleScore(matching, plain, new Set(), now)
    )
  })

  it('should lower headlines matching terms the user disliked, without removing them', () => {
    const now = Date.now()
    const learned = makeProfile({ affinityByTerm: { futebol: -6 } })

    const matching = makeArticle({ title: 'Futebol brasileiro tem rodada decisiva', publishedAt: now })
    const unrelated = makeArticle({ title: 'Nova descoberta científica', publishedAt: now })

    const matchingScore = calculateArticleScore(matching, learned, new Set(), now)
    expect(matchingScore).toBeLessThan(calculateArticleScore(unrelated, learned, new Set(), now))
    expect(matchingScore).toBeGreaterThan(0)
  })

  it('should strictly filter articles by canonical topic in rankAndFilterFeed', () => {
    const articles: NewsArticle[] = [
      makeArticle({ id: '1', url: 'https://exemplo.com/1', title: 'São Bernardo vence após 10 jogos', canonicalTopics: ['esportes'] }),
      makeArticle({ id: '2', url: 'https://exemplo.com/2', title: 'GTA 6 ganha novo trailer de gameplay no PS5', canonicalTopics: ['games'] }),
      makeArticle({ id: '3', url: 'https://exemplo.com/3', title: 'Horóscopo do dia para todos os signos', canonicalTopics: ['geral'] }),
      makeArticle({ id: '4', url: 'https://exemplo.com/4', title: 'Senado aprova votação de projeto de lei', canonicalTopics: ['politica'] })
    ]
    const profile = makeProfile({})

    const gamesFeed = rankAndFilterFeed(articles, profile, new Set(), 'games')
    expect(gamesFeed).toHaveLength(1)
    expect(gamesFeed[0].id).toBe('2')

    const politicaFeed = rankAndFilterFeed(articles, profile, new Set(), 'politica')
    expect(politicaFeed).toHaveLength(1)
    expect(politicaFeed[0].id).toBe('4')
  })
})
