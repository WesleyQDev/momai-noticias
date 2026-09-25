import { describe, expect, it, vi } from 'vitest'

vi.mock('momai:sdk', () => ({ default: { locale: 'pt-BR' } }))

import { renderToStaticMarkup } from 'react-dom/server'
import { ensureFirstOfTopicHasPhoto } from '../src/services/feed-mix'
import { rankAndFilterFeed } from '../src/services/ranking'
import { ChatBriefingCard } from '../src/components/ChatBriefingCard'
import type { BriefingResponse, NewsArticle, UserProfile } from '../src/services/types'
import { DEFAULT_USER_PROFILE } from '../src/services/types'

const PHOTO = 'https://exemplo.com/foto.jpg'

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

describe('first news of each topic carries a photo', () => {
  it('promotes the first same-topic article with a photo into the topic first slot', () => {
    const list = [
      article('t1', { canonicalTopics: ['tecnologia'] }),
      article('t2', { canonicalTopics: ['tecnologia'], image: PHOTO }),
      article('t3', { canonicalTopics: ['tecnologia'] })
    ]

    const ordered = ensureFirstOfTopicHasPhoto(list)

    expect(ordered.map((item) => item.id)).toEqual(['t2', 't1', 't3'])
    expect(ordered[0].image).toBe(PHOTO)
  })

  it('keeps the order when the topic first article already has a photo', () => {
    const list = [
      article('t1', { canonicalTopics: ['tecnologia'], image: PHOTO }),
      article('t2', { canonicalTopics: ['tecnologia'] })
    ]

    expect(ensureFirstOfTopicHasPhoto(list).map((item) => item.id)).toEqual(['t1', 't2'])
  })

  it('keeps the order when no article of the topic has a photo', () => {
    const list = [
      article('t1', { canonicalTopics: ['economia'] }),
      article('t2', { canonicalTopics: ['economia'] })
    ]

    expect(ensureFirstOfTopicHasPhoto(list).map((item) => item.id)).toEqual(['t1', 't2'])
  })

  it('applies the rule to every topic independently', () => {
    const list = [
      article('tec-1', { canonicalTopics: ['tecnologia'] }),
      article('eco-1', { canonicalTopics: ['economia'], image: PHOTO }),
      article('tec-2', { canonicalTopics: ['tecnologia'], image: PHOTO }),
      article('eco-2', { canonicalTopics: ['economia'] })
    ]

    const ordered = ensureFirstOfTopicHasPhoto(list)

    expect(ordered.map((item) => item.id)).toEqual(['tec-2', 'tec-1', 'eco-1', 'eco-2'])
  })

  it('starts a ranked topic list with a photo article when one exists', () => {
    const now = Date.now()
    const fresh = article('nova', { canonicalTopics: ['tecnologia'], publishedAt: now })
    const illustrated = article('foto', {
      canonicalTopics: ['tecnologia'],
      publishedAt: now - 20 * 60 * 60 * 1000,
      image: PHOTO
    })

    const ranked = rankAndFilterFeed([fresh, illustrated], profile(), new Set(), 'tecnologia')

    expect(ranked.map((item) => item.id)).toEqual(['foto', 'nova'])
    expect(ranked[0].image).toBe(PHOTO)
  })

  it('matches candidates even when the topic is secondary in canonicalTopics', () => {
    const list = [
      article('pol-1', { canonicalTopics: ['politica', 'mundo'] }),
      article('ger-1', { canonicalTopics: ['geral', 'politica'], image: PHOTO })
    ]

    const ordered = ensureFirstOfTopicHasPhoto(list)
    expect(ordered.map((item) => item.id)).toEqual(['ger-1', 'pol-1'])
    expect(ordered[0].image).toBe(PHOTO)
  })

  it('shows the first article photo of each briefing topic section', () => {
    const data: BriefingResponse = {
      ok: true,
      generatedAt: Date.now(),
      briefing: [
        {
          topic: 'tecnologia',
          topicLabel: 'Tecnologia',
          articles: [article('a1', { image: PHOTO }), article('a2', {})]
        },
        {
          topic: 'economia',
          topicLabel: 'Economia',
          articles: [article('b1', {}), article('b2', {})]
        }
      ]
    }

    const markup = renderToStaticMarkup(<ChatBriefingCard data={data} />)

    expect(markup).toContain(PHOTO)
    expect(markup).toContain('<img')
  })
})
