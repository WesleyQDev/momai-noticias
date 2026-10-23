// Integration tests for the worker tool handlers. The host is emulated over
// the same IPC protocol (process.send / 'message' storage-response) so the
// tests exercise the real runtime without filesystem or network access.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { NewsArticle } from '../src/services/types'

const storage = new Map<string, any>()
const collections = new Map<string, Map<string, any>>()

function table(name: string): Map<string, any> {
  let t = collections.get(name)
  if (!t) {
    t = new Map()
    collections.set(name, t)
  }
  return t
}

function respond(msg: any): void {
  if (!msg || msg.type !== 'storage-request') return
  const [area, method] = String(msg.method).split('.')
  const args = Array.isArray(msg.args) ? msg.args : []
  let result: any
  try {
    if (area === 'storage') {
      if (method === 'get') result = { ok: true, value: storage.get(args[0]) ?? null }
      else if (method === 'set') {
        storage.set(args[0], args[1])
        result = { ok: true, value: undefined }
      } else result = { ok: true, value: undefined }
    } else if (area === 'collections') {
      const t = table(args[0])
      const filter = args[1]
      if (method === 'list') {
        let items = Array.from(t.values())
        const where = filter?.where
        if (where && typeof where === 'object') {
          items = items.filter((item) => Object.entries(where).every(([key, value]) => item?.[key] === value))
        } else if (filter && typeof filter === 'object' && filter.id !== undefined) {
          items = items.filter((item) => item?.id === filter.id)
        }
        if (typeof filter?.offset === 'number') items = items.slice(filter.offset)
        if (typeof filter?.limit === 'number') items = items.slice(0, filter.limit)
        result = { ok: true, value: items }
      } else if (method === 'upsertMany') {
        for (const item of args[1] || []) if (item?.id) t.set(item.id, item)
        result = { ok: true, value: undefined }
      } else if (method === 'upsert' || method === 'insert') {
        const item = method === 'upsert' ? args[2] : args[1]
        if (item?.id) t.set(item.id, item)
        result = { ok: true, value: undefined }
      } else if (method === 'remove') {
        const removeFilter = args[1] || {}
        for (const [key, item] of Array.from(t.entries())) {
          if (removeFilter.id === undefined || item?.id === removeFilter.id || key === removeFilter.id) {
            t.delete(key)
          }
        }
        result = { ok: true, value: undefined }
      } else if (method === 'clear') {
        t.clear()
        result = { ok: true, value: undefined }
      } else {
        result = { ok: true, value: [] }
      }
    } else {
      result = { ok: true, value: undefined }
    }
  } catch (err: any) {
    result = { ok: false, error: err?.message || String(err) }
  }
  runtime?.handleStorageResponse({ type: 'storage-response', requestId: msg.requestId, result })
}

function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'art-1',
    title: 'Nova tecnologia de chips chega ao mercado',
    url: 'https://example.com/art-1',
    summary: 'Resumo da notícia sobre chips',
    publishedAt: Date.now(),
    categories: [],
    canonicalTopics: ['tecnologia'],
    sourceId: 'tecnoblog',
    sourceName: 'Tecnoblog',
    language: 'pt-BR',
    ...overrides
  }
}

let runtime: any

beforeAll(async () => {
  // Minimal profile so background syncs only touch the one source the tests
  // use, keeping the suite network-free and quiet.
  storage.set('news_user_profile', {
    version: 1,
    onboardingCompleted: true,
    languages: ['pt-BR'],
    interests: ['tecnologia'],
    followedSources: ['tecnoblog'],
    blockedSources: [],
    mutedKeywords: [],
    customSources: [],
    affinityBySource: {},
    affinityByTopic: {},
    affinityByTerm: {},
    retentionDays: 3
  })
  ;(process as any).send = (msg: any) => {
    respond(msg)
    return true
  }
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('network disabled in tests')
  }))
  runtime = await import('../runtime')
})

describe('runtime tool handlers', () => {
  it('serves the cached feed and searches it without network', async () => {
    table('feed_cache').set('art-1', article())

    const feed = await runtime.executeTool('get_feed', { limit: 10 })
    expect(feed.ok).toBe(true)
    expect(feed.articles.map((a: NewsArticle) => a.id)).toContain('art-1')

    const search = await runtime.executeTool('search_news', { query: 'chips' })
    expect(search.ok).toBe(true)
    expect(search.articles.map((a: NewsArticle) => a.id)).toContain('art-1')
  })

  it('saves, lists and removes an article', async () => {
    const saved = await runtime.executeTool('save_article', { articleId: 'art-1' })
    expect(saved.ok).toBe(true)

    const list = await runtime.executeTool('list_saved_articles')
    expect(list.articles.map((a: NewsArticle) => a.id)).toContain('art-1')

    const removed = await runtime.executeTool('remove_saved_article', { articleId: 'art-1' })
    expect(removed.ok).toBe(true)
    const after = await runtime.executeTool('list_saved_articles')
    expect(after.articles).toHaveLength(0)
  })

  it('rejects saving an unknown article', async () => {
    const res = await runtime.executeTool('save_article', { articleId: 'missing' })
    expect(res.ok).toBe(false)
  })

  it('learns source, topic and term affinity from explicit feedback', async () => {
    const res = await runtime.executeTool('set_article_feedback', {
      articleId: 'art-1',
      type: 'like',
      sourceId: 'tecnoblog',
      topics: ['tecnologia'],
      title: 'Nova tecnologia de chips'
    })
    expect(res.ok).toBe(true)

    const { profile } = await runtime.executeTool('get_profile')
    expect(profile.affinityByTopic.tecnologia).toBeGreaterThan(0)
    expect(profile.affinityBySource.tecnoblog).toBeGreaterThan(0)
    expect(profile.affinityByTerm.tecnologia).toBeGreaterThan(0)
  })

  it('preserves an explicitly empty followedSources list after onboarding', async () => {
    const stored = storage.get('news_user_profile')
    storage.set('news_user_profile', {
      ...stored,
      onboardingCompleted: true,
      followedSources: [],
      languages: ['pt-BR']
    })

    const { profile } = await runtime.executeTool('get_profile')
    expect(profile.followedSources).toEqual([])
  })

  it('merges custom sources instead of overwriting them from a stale snapshot', async () => {
    const source = {
      id: 'custom-1',
      title: 'Meu Feed',
      homepage: 'https://example.com',
      feed: 'https://example.com/feed',
      language: 'pt-BR',
      topics: ['geral'],
      isCustom: true,
      enabled: true
    }

    const first = await runtime.executeTool('update_profile', { updates: { customSources: [source] } })
    expect(first.profile.customSources.map((s: any) => s.id)).toContain('custom-1')

    const stale = await runtime.executeTool('update_profile', { updates: { customSources: [] } })
    expect(stale.profile.customSources.map((s: any) => s.id)).toContain('custom-1')
  })

  it('builds a briefing from cached articles without network', async () => {
    const res = await runtime.executeTool('get_briefing', { limitPerTopic: 2 })
    expect(res.ok).toBe(true)
    expect(res.briefing.length).toBeGreaterThan(0)
  })

  it('prunes old articles from the cache and keeps fresh ones', async () => {
    const old = article({ id: 'old-1', publishedAt: Date.now() - 10 * 24 * 60 * 60 * 1000 })
    const fresh = article({ id: 'fresh-1', publishedAt: Date.now() })
    table('feed_cache').set(old.id, old)
    table('feed_cache').set(fresh.id, fresh)

    const res = await runtime.executeTool('prune_cache', { retentionDays: 3 })
    expect(res.ok).toBe(true)
    expect(table('feed_cache').has('old-1')).toBe(false)
    expect(table('feed_cache').has('fresh-1')).toBe(true)
  })

  it('returns ticker data with market quotes and urgent or poll news', async () => {
    const pollArt = article({
      id: 'poll-1',
      title: 'Datafolha: pesquisa eleitoral aponta disputa acirrada',
      publishedAt: Date.now()
    })
    table('feed_cache').set(pollArt.id, pollArt)

    const res = await runtime.executeTool('get_ticker_data')
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.items)).toBe(true)
    const hasPoll = res.items.some((i: any) => i.label === 'PESQUISA')
    expect(hasPoll).toBe(true)
  })
})
