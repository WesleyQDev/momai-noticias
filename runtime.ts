// runtime.ts
// MomAI Notícias persistent background worker
// Handles feed collection, caching, ranking, feed discovery, and IPC tools for Assistant and UI

import fs from 'node:fs'
import path from 'node:path'
import { parseFeedXml, sanitizeUrl, extractImageFromHtml, decodeFeedBuffer, upgradeImageUrl } from './src/services/feed-parser.ts'
import { extractFeedUrlsFromHtml, COMMON_FEED_PATHS } from './src/services/discovery.ts'
import { rankAndFilterFeed, deduplicateArticles, decayAffinities } from './src/services/ranking.ts'
import { createFeedPageStore, readFeedPage } from './src/services/feed-pages.ts'
import { resolveFeedSeed, shouldReuseSession } from './src/services/feed-shuffle.ts'
import { evaluateEmbedPolicy } from './src/services/embed-policy.ts'
import { buildFeedMix, spreadSameCategory, ensureFirstOfTopicHasPhoto } from './src/services/feed-mix.ts'
import { extractInterestTerms } from './src/services/interest-terms.ts'
import { classifyTextToTopics } from './src/services/categories.ts'
import type { NewsArticle, FeedSource, UserProfile, CanonicalTopic, SavedArticle } from './src/services/types.ts'
import { DEFAULT_USER_PROFILE } from './src/services/types.ts'

function safeSend(msg: any) {
  try {
    if (typeof process.send === 'function') {
      process.send(msg)
    }
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] IPC send error:', err?.message || err)
  }
}

process.on('uncaughtException', (err: any) => {
  console.error('[runtime:momai-noticias] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason: any) => {
  console.error('[runtime:momai-noticias] Unhandled rejection:', reason)
})
import { createIpcNewsStorage } from './storage-ipc.ts'

let storageResponseListener: ((msg: any) => void) | null = null
const storageBridge = createIpcNewsStorage({
  send: safeSend,
  onResponse: (listener) => {
    storageResponseListener = listener
  }
})

// Load Catalog
let curatedSources: FeedSource[] = []
try {
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd()
  const candidates = [
    path.join(currentDir, 'sources', 'catalog.json'),
    path.join(currentDir, '..', 'sources', 'catalog.json'),
    path.join(process.cwd(), 'sources', 'catalog.json')
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      curatedSources = JSON.parse(fs.readFileSync(c, 'utf8'))
      break
    }
  }
} catch (e: any) {
  console.error('[runtime:momai-noticias] Failed to load catalog.json:', e?.message || e)
}

// In-Memory Cache
const inMemoryArticles = new Map<string, NewsArticle>()
const feedHttpCache = new Map<string, { etag?: string; lastModified?: string; lastFetchedAt: number }>()
const ogImageCache = new Map<string, string>()
const embedPolicyCache = new Map<string, { embeddable: boolean; reason?: string }>()
// Scroll sessions for the infinite feed (see src/services/feed-pages.ts).
const feedPageStore = createFeedPageStore()

const USER_AGENT = 'MomAI-News-Reader/1.0 (+https://github.com/WesleyQDev/momai)'
const FETCH_TIMEOUT_MS = 9000

// Helper to get or initialize user profile
async function getUserProfile(): Promise<UserProfile> {
  try {
    const profile = await storageBridge.storage.get('news_user_profile')
    if (profile && typeof profile === 'object') {
      const merged: UserProfile = { ...DEFAULT_USER_PROFILE, ...profile }
      if (!merged.languages || merged.languages.length === 0) {
        merged.languages = ['pt-BR']
      }
      if (!merged.followedSources || merged.followedSources.length === 0) {
        merged.followedSources = curatedSources.filter((s) => merged.languages.includes(s.language)).map((s) => s.id)
      }
      return merged
    }
  } catch {}
  return {
    ...DEFAULT_USER_PROFILE,
    followedSources: curatedSources.filter((s) => s.language === 'pt-BR').map((s) => s.id)
  }
}

async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await storageBridge.storage.set('news_user_profile', profile)
  } catch (err) {
    console.error('[runtime:momai-noticias] Failed to save profile:', err)
  }
}

async function getSeenArticleIds(): Promise<Set<string>> {
  try {
    const seen = await storageBridge.storage.get('news_seen_articles')
    if (Array.isArray(seen)) {
      return new Set(seen)
    }
  } catch {}
  return new Set()
}

// Fetch single feed with timeout, backoff, and caching headers
async function fetchSingleFeed(source: FeedSource): Promise<NewsArticle[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
    }

    const cachedHeaders = feedHttpCache.get(source.feed)
    if (cachedHeaders?.etag) headers['If-None-Match'] = cachedHeaders.etag
    if (cachedHeaders?.lastModified) headers['If-Modified-Since'] = cachedHeaders.lastModified

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(source.feed, {
      headers,
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.status === 304) {
      // Not modified
      return []
    }

    if (!res.ok) {
      console.warn(`[runtime:momai-noticias] Feed HTTP ${res.status} for ${source.id} (${source.feed})`)
      return []
    }

    const etag = res.headers.get('etag') || undefined
    const lastModified = res.headers.get('last-modified') || undefined
    feedHttpCache.set(source.feed, { etag, lastModified, lastFetchedAt: Date.now() })

    const contentType = res.headers.get('content-type') || ''
    const arrayBuf = await res.arrayBuffer()
    const xml = decodeFeedBuffer(Buffer.from(arrayBuf), contentType)
    const parsed = parseFeedXml(xml, source)

    console.log(`[runtime:momai-noticias] Fetched ${source.id}: ${parsed.length} articles (${Math.round(arrayBuf.byteLength / 1024)}KB)`)

    // Store in memory
    for (const article of parsed) {
      inMemoryArticles.set(article.id, article)
    }

    // Persist to feed_cache collection
    try {
      if (parsed.length > 0) {
        await storageBridge.collections.upsertMany('feed_cache', parsed)
      }
    } catch (err: any) {
      console.warn(
        `[runtime:momai-noticias] Failed to persist ${parsed.length} articles from ${source.id}:`,
        err?.message || err
      )
    }

    return parsed
  } catch (err: any) {
    console.warn(`[runtime:momai-noticias] Error fetching feed ${source.id}:`, err?.message || err)
    return []
  }
}

// Lazy OpenGraph image fetcher
async function fetchOgImage(url: string): Promise<string | undefined> {
  if (ogImageCache.has(url)) return ogImageCache.get(url)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) return undefined
    const html = await res.text()

    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (ogMatch && ogMatch[1]) {
      let rawImg = ogMatch[1].trim()
      try {
        rawImg = new URL(rawImg, url).toString()
      } catch {}
      const imgUrl = upgradeImageUrl(rawImg) || rawImg
      ogImageCache.set(url, imgUrl)
      return imgUrl
    }
  } catch {}
  return undefined
}

// Discover RSS/Atom feed from website URL
async function discoverFeedUrl(rawSiteUrl: string): Promise<{ ok: boolean; feeds?: { url: string; title?: string }[]; error?: string }> {
  try {
    let target = rawSiteUrl.trim()
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { ok: false, error: `Não foi possível acessar a página (HTTP ${res.status}).` }
    }

    const contentType = res.headers.get('content-type') || ''
    const text = await res.text()

    // If the URL itself is already XML/RSS
    if (contentType.includes('xml') || text.includes('<rss') || text.includes('<feed')) {
      return {
        ok: true,
        feeds: [{ url: target, title: 'Feed RSS' }]
      }
    }

    // Extract from HTML <link rel="alternate">
    const extracted = extractFeedUrlsFromHtml(text, target)
    if (extracted.length > 0) {
      return {
        ok: true,
        feeds: extracted.map((f) => ({ url: f.feedUrl, title: f.title || 'Feed Descoberto' }))
      }
    }

    // Try common feed paths
    const urlObj = new URL(target)
    for (const commonPath of COMMON_FEED_PATHS) {
      try {
        const testUrl = new URL(commonPath, urlObj.origin).toString()
        const testCtrl = new AbortController()
        const testTimer = setTimeout(() => testCtrl.abort(), 3000)
        const testRes = await fetch(testUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: testCtrl.signal
        })
        clearTimeout(testTimer)
        if (testRes.ok) {
          const testText = await testRes.text()
          if (testText.includes('<rss') || testText.includes('<feed')) {
            return {
              ok: true,
              feeds: [{ url: testUrl, title: 'Feed RSS' }]
            }
          }
        }
      } catch {}
    }

    return { ok: false, error: 'Nenhum feed RSS ou Atom foi encontrado neste endereço.' }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao descobrir feed' }
  }
}

// Fetch all active feeds based on user profile
async function performSyncActiveFeeds(force: boolean): Promise<void> {
  const profile = await getUserProfile()
  const allSources = [...curatedSources, ...(profile.customSources || [])]

  // Filter sources relevant to user languages or explicitly followed
  const relevantSources = allSources.filter((s) => {
    const isLangMatch = profile.languages && profile.languages.includes(s.language)
    const isFollowed = profile.followedSources && profile.followedSources.includes(s.id)
    const isBlocked = profile.blockedSources && profile.blockedSources.includes(s.id)
    return !isBlocked && (isLangMatch || isFollowed)
  })

  const sourcesToFetch = force
    ? relevantSources
    : relevantSources.filter((s) => {
        const cached = feedHttpCache.get(s.feed)
        if (!cached) return true
        return Date.now() - cached.lastFetchedAt > 15 * 60 * 1000 // 15 mins
      })

  console.log(`[runtime:momai-noticias] syncActiveFeeds: ${allSources.length} total, ${relevantSources.length} relevant, ${sourcesToFetch.length} to fetch (force=${force})`)

  // Prioritize primary portals and followed sources first so headline and top feed are ready rapidly
  const sortedSources = [...sourcesToFetch].sort((a, b) => {
    const aFollowed = profile.followedSources?.includes(a.id) ? 1 : 0
    const bFollowed = profile.followedSources?.includes(b.id) ? 1 : 0
    if (aFollowed !== bFollowed) return bFollowed - aFollowed
    const aMain = (a.topics?.includes('geral') || a.id.includes('geral') || a.id.includes('g1') || a.id.includes('folha') || a.id.includes('bbc') || a.id.includes('uol')) ? 1 : 0
    const bMain = (b.topics?.includes('geral') || b.id.includes('geral') || b.id.includes('g1') || b.id.includes('folha') || b.id.includes('bbc') || b.id.includes('uol')) ? 1 : 0
    return bMain - aMain
  })

  // Concurrency-limited fetch (max 5 simultaneous)
  const batchSize = 5
  for (let i = 0; i < sortedSources.length; i += batchSize) {
    const batch = sortedSources.slice(i, i + batchSize)
    await Promise.all(batch.map((s) => fetchSingleFeed(s)))
    safeSend({
      type: 'event',
      eventType: 'news_feed_updated',
      data: { count: inMemoryArticles.size, batchIndex: i }
    })
  }

  console.log(`[runtime:momai-noticias] syncActiveFeeds done. Total in memory: ${inMemoryArticles.size}`)
}

let syncInFlight: Promise<void> | null = null
let syncForcePending = false

// Serializes feed syncs: concurrent callers share the run already in flight,
// and a forced request arriving mid-run schedules one follow-up pass instead of
// a parallel fetch storm (startup preload + first get_feed + UI refresh).
function syncActiveFeeds(force = false): Promise<void> {
  if (force) syncForcePending = true
  if (!syncInFlight) {
    syncInFlight = (async () => {
      try {
        do {
          const runForce = syncForcePending
          syncForcePending = false
          await performSyncActiveFeeds(runForce)
        } while (syncForcePending)
      } finally {
        syncInFlight = null
      }
    })()
  }
  return syncInFlight
}

// Prune articles older than retention cutoff (retentionDays)
async function pruneOldArticles(retentionDays = 3): Promise<void> {
  const days = Math.max(1, Math.min(30, retentionDays || 3))
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)

  // Prune in-memory cache
  for (const [id, article] of inMemoryArticles.entries()) {
    if (article.publishedAt && article.publishedAt < cutoff) {
      inMemoryArticles.delete(id)
    }
  }

  // Prune feed_cache collection
  try {
    const list = await storageBridge.collections.list('feed_cache')
    if (Array.isArray(list)) {
      for (const a of list) {
        if (a && a.publishedAt && a.publishedAt < cutoff) {
          await storageBridge.collections.remove('feed_cache', { id: a.id })
        }
      }
    }
  } catch {}
}

// Ensure articles are populated from in-memory or collection cache
async function getAllArticles(): Promise<NewsArticle[]> {
  if (inMemoryArticles.size > 0) {
    return Array.from(inMemoryArticles.values())
  }
  try {
    // The host caps a single list read at 500 rows, so walk the cached pages.
    const cached: NewsArticle[] = []
    for (const offset of [0, 500]) {
      const page = await storageBridge.collections.list<NewsArticle>('feed_cache', {
        limit: 500,
        offset,
        orderBy: 'publishedAt'
      })
      if (!Array.isArray(page) || page.length === 0) break
      cached.push(...page)
      if (page.length < 500) break
    }
    if (cached.length > 0) {
      for (const a of cached) {
        if (a && a.id) {
          if (a.image) {
            a.image = upgradeImageUrl(a.image) || a.image
          }
          inMemoryArticles.set(a.id, a)
        }
      }
      return cached
    }
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Failed to read feed_cache:', err?.message || err)
  }
  return []
}

// Explicit like/dislike per article: drives the learned affinities and hides
// what the user rejected.
const ARTICLE_FEEDBACK_KEY = 'news_article_feedback'
const ARTICLE_FEEDBACK_LIMIT = 500

async function getArticleFeedback(): Promise<Record<string, 'like' | 'dislike'>> {
  try {
    const stored = await storageBridge.storage.get(ARTICLE_FEEDBACK_KEY)
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return stored as Record<string, 'like' | 'dislike'>
    }
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Failed to read article feedback:', err?.message || err)
  }
  return {}
}

async function saveArticleFeedback(map: Record<string, 'like' | 'dislike'>): Promise<void> {
  try {
    const entries = Object.entries(map)
    const trimmed = entries.length > ARTICLE_FEEDBACK_LIMIT
      ? Object.fromEntries(entries.slice(entries.length - ARTICLE_FEEDBACK_LIMIT))
      : map
    await storageBridge.storage.set(ARTICLE_FEEDBACK_KEY, trimmed)
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Failed to save article feedback:', err?.message || err)
  }
}

function feedbackWeight(type: 'like' | 'dislike' | null): number {
  return type === 'like' ? 3 : type === 'dislike' ? -3 : 0
}

// Fades what the feed learned before applying today's signal, so interests
// drift with the user instead of locking into old habits forever.
function applyAffinityDelta(
  target: UserProfile,
  signal: { sourceId?: any; topics?: any; terms?: string[] },
  delta: number
): void {
  if (delta === 0) return

  const now = Date.now()
  const daysSinceLast = target.lastInteractionAt
    ? (now - target.lastInteractionAt) / (24 * 60 * 60 * 1000)
    : 0
  target.affinityBySource = decayAffinities(target.affinityBySource, daysSinceLast)
  target.affinityByTopic = decayAffinities(target.affinityByTopic, daysSinceLast)
  target.affinityByTerm = decayAffinities(target.affinityByTerm || {}, daysSinceLast)
  target.lastInteractionAt = now

  const sourceId = signal.sourceId ? String(signal.sourceId) : ''
  if (sourceId) {
    target.affinityBySource[sourceId] = (target.affinityBySource[sourceId] || 0) + delta
  }
  if (Array.isArray(signal.topics)) {
    for (const topic of signal.topics) {
      target.affinityByTopic[topic] = (target.affinityByTopic[topic] || 0) + delta
    }
  }
  for (const term of signal.terms || []) {
    target.affinityByTerm[term] = (target.affinityByTerm[term] || 0) + delta
  }
}

// Title terms are what the user actually reacted to; the cached article is the
// source of truth, with the UI-provided title as fallback.
function resolveArticleTerms(articleId: string, providedTitle?: any): string[] {
  const cached = articleId ? inMemoryArticles.get(articleId) : undefined
  const title = String(providedTitle || cached?.title || '')
  return title ? extractInterestTerms(title) : []
}

// Background initial preload & auto-prune on startup
setTimeout(async () => {
  try {
    const profile = await getUserProfile()
    await getAllArticles()
    await pruneOldArticles(profile.retentionDays || 3)
    // Sync feeds on startup in the background
    await syncActiveFeeds(true)
    profile.lastSyncAt = Date.now()
    await saveUserProfile(profile)
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Initial preload error:', err?.message || err)
  }
}, 50)

// Periodic background auto-sync & prune (every 15 minutes)
setInterval(async () => {
  try {
    const profile = await getUserProfile()
    await syncActiveFeeds(false)
    await pruneOldArticles(profile.retentionDays || 3)
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Auto sync error:', err?.message || err)
  }
}, 15 * 60 * 1000)

// Execute Tool Handler
async function executeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const profile = await getUserProfile()
  const seenIds = await getSeenArticleIds()

  switch (toolName) {
    case 'get_feed': {
      let articles = await getAllArticles()
      let syncing = false

      if (articles.length === 0) {
        // Nothing cached yet: start syncing and wait briefly for the first batch
        // so the headline and first elements load as fast as possible without
        // waiting for every single remote feed to finish.
        syncing = true
        void syncActiveFeeds(true)
        const start = Date.now()
        while (inMemoryArticles.size === 0 && Date.now() - start < 1200 && syncInFlight) {
          await new Promise((r) => setTimeout(r, 60))
        }
        articles = await getAllArticles()
      } else {
        // Serve the cached feed immediately and refresh in the background.
        const isSyncRunning = syncInFlight !== null
        const lastSync = profile.lastSyncAt || 0
        const isStaleFeed = Date.now() - lastSync > 2 * 60 * 1000
        if (isSyncRunning) {
          syncing = true
        } else if (isStaleFeed) {
          syncing = true
          syncActiveFeeds(false)
            .then(async () => {
              profile.lastSyncAt = Date.now()
              await saveUserProfile(profile)
            })
            .catch((err) => {
              console.warn('[runtime:momai-noticias] Background sync error:', err?.message || err)
            })
        }
      }

      console.log(`[runtime:momai-noticias] get_feed: ${articles.length} raw articles in cache`)

      const limit = Math.min(Math.max(Number(args?.limit) || 40, 1), 100)
      const offset = Math.max(0, Math.floor(Number(args?.offset)) || 0)
      const requestedCursor = typeof args?.cursor === 'string' ? args.cursor : ''
      const isRefresh = Boolean(args?.refresh)
      const feedSeed = resolveFeedSeed({ seed: args?.seed, refresh: isRefresh })

      // Only callers that page the feed open a scroll session; one-shot reads
      // (sidebar highlights, assistant calls) just take the top of the ranking.
      // A refresh always starts a new ranking snapshot instead of replaying it.
      let session = shouldReuseSession({ refresh: isRefresh, cursor: requestedCursor })
        ? feedPageStore.get(requestedCursor)
        : null
      let pageOffset = offset
      let rankedIds: string[] = []
      if (!session) {
        const ranked = rankAndFilterFeed(
          articles,
          profile,
          seenIds,
          args?.topic,
          args?.language,
          Boolean(args?.onlyFollowed),
          feedSeed
        )
        const isTopicFilter = args?.topic && args.topic !== 'all' && args.topic !== 'paravoce'
        if (isTopicFilter) {
          // When filtering by a specific topic (e.g. Games, Politica, Tecnologia), ensure first article has photo
          rankedIds = ensureFirstOfTopicHasPhoto(ranked).map((a) => a.id)
        } else {
          // Mix personal / variety / explore so the main feed does not become a bubble
          // and keeps testing subjects the user has not reacted to yet.
          const mixed = buildFeedMix(ranked, profile, seenIds, { pageSize: ranked.length, seed: feedSeed })
          console.log(
            `[runtime:momai-noticias] get_feed: ${ranked.length} ranked (personal=${mixed.counts.personal}, variety=${mixed.counts.variety}, explore=${mixed.counts.explore})`
          )
          rankedIds = ensureFirstOfTopicHasPhoto(spreadSameCategory(mixed.articles)).map((a) => a.id)
        }
        if (args?.session === true) {
          session = feedPageStore.open(rankedIds)
          // An expired cursor restarts at the top; the UI de-duplicates by id.
          if (requestedCursor) pageOffset = 0
        }
      }

      const sourceIds = session ? session.ids : rankedIds
      const page = readFeedPage(sourceIds, pageOffset, limit)
      const sliced: NewsArticle[] = []
      for (const id of page.ids) {
        const article = inMemoryArticles.get(id)
        if (article) sliced.push(article)
      }

      // Background lazy og:image check for top items
      sliced.forEach((a) => {
        if (!a.image && a.url) {
          fetchOgImage(a.url).then((img) => {
            if (img) {
              a.image = img
              inMemoryArticles.set(a.id, a)
            }
          })
        }
      })

      return {
        ok: true,
        articles: sliced,
        total: sourceIds.length,
        hasMore: page.hasMore,
        ...(session ? { cursor: session.cursor, nextOffset: page.nextOffset, offset: pageOffset } : {}),
        syncing,
        directResponse: sliced.length === 0
          ? 'Nenhuma notícia encontrada no momento.'
          : `Aqui estão as principais notícias (${sliced.length}):\n` +
            sliced.slice(0, 5).map((a, i) => `${i + 1}. **${a.title}** (${a.sourceName})`).join('\n')
      }
    }

    case 'search_news': {
      const query = String(args?.query || '').trim()
      if (!query) return { ok: false, error: 'Termo de busca obrigatório.' }

      await syncActiveFeeds(false)
      const articles = await getAllArticles()

      const normQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const matched = articles.filter((a) => {
        const text = `${a.title} ${a.summary} ${a.sourceName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return text.includes(normQuery)
      })

      const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 30)
      const ranked = rankAndFilterFeed(matched, profile, seenIds, args?.topic)
      const sliced = ranked.slice(0, limit)

      return {
        ok: true,
        query,
        articles: sliced,
        total: matched.length,
        directResponse: sliced.length === 0
          ? `Nenhuma notícia encontrada para "${query}".`
          : `Encontrei ${matched.length} notícia(s) sobre "${query}":\n` +
            sliced.slice(0, 5).map((a, i) => `${i + 1}. **${a.title}** (${a.sourceName})`).join('\n')
      }
    }

    case 'get_briefing': {
      await syncActiveFeeds(false)
      let articles = await getAllArticles()
      if (articles.length === 0) {
        await syncActiveFeeds(true)
        articles = await getAllArticles()
      }

      const limitPerTopic = Math.min(Math.max(Number(args?.limitPerTopic) || 3, 1), 6)
      const topics = profile.interests && profile.interests.length > 0
        ? profile.interests
        : (['tecnologia', 'economia', 'mundo', 'ciencia'] as CanonicalTopic[])

      const briefing: { topic: CanonicalTopic; topicLabel: string; articles: NewsArticle[] }[] = []

      const topicLabels: Record<CanonicalTopic, string> = {
        tecnologia: 'Tecnologia',
        economia: 'Economia',
        politica: 'Política',
        ciencia: 'Ciência',
        esportes: 'Esportes',
        cultura: 'Cultura',
        games: 'Games',
        saude: 'Saúde',
        mundo: 'Mundo',
        geral: 'Geral'
      }

      for (const t of topics) {
        const rankedForTopic = rankAndFilterFeed(articles, profile, seenIds, t)
        if (rankedForTopic.length > 0) {
          briefing.push({
            topic: t,
            topicLabel: topicLabels[t] || t,
            articles: rankedForTopic.slice(0, limitPerTopic)
          })
        }
      }

      let summaryText = '📰 **Briefing Diário de Notícias**\n\n'
      for (const section of briefing) {
        summaryText += `### ${section.topicLabel}\n`
        for (const art of section.articles) {
          summaryText += `• **${art.title}** — _${art.sourceName}_\n`
        }
        summaryText += '\n'
      }

      return {
        ok: true,
        briefing,
        generatedAt: Date.now(),
        directResponse: summaryText.trim()
      }
    }

    case 'list_sources': {
      const allSources = [...curatedSources, ...(profile.customSources || [])]
      let filtered = allSources
      if (args?.language) {
        filtered = filtered.filter((s) => s.language === args.language)
      }
      return {
        ok: true,
        sources: filtered.map((s) => ({
          ...s,
          isFollowed: profile.followedSources.includes(s.id),
          isBlocked: profile.blockedSources.includes(s.id)
        }))
      }
    }

    case 'add_custom_source': {
      const url = String(args?.url || '').trim()
      if (!url) return { ok: false, error: 'URL é obrigatória.' }

      const discovery = await discoverFeedUrl(url)
      if (!discovery.ok || !discovery.feeds || discovery.feeds.length === 0) {
        return { ok: false, error: discovery.error || 'Nenhum feed encontrado.' }
      }

      const feedInfo = discovery.feeds[0]
      const title = args?.title || feedInfo.title || 'Feed Personalizado'
      const language = args?.language || profile.languages[0] || 'pt-BR'

      const customId = `custom-${Date.now()}`
      const newSource: FeedSource = {
        id: customId,
        title,
        homepage: url,
        feed: feedInfo.url,
        language,
        topics: ['geral'],
        isCustom: true,
        enabled: true
      }

      const updatedCustom = [...(profile.customSources || []), newSource]
      const updatedFollowed = [...profile.followedSources, customId]
      const updatedProfile = { ...profile, customSources: updatedCustom, followedSources: updatedFollowed }
      await saveUserProfile(updatedProfile)

      // Test fetch
      const initialFetch = await fetchSingleFeed(newSource)

      return {
        ok: true,
        source: newSource,
        fetchedCount: initialFetch.length,
        directResponse: `Fonte "${title}" adicionada com sucesso!`
      }
    }

    case 'save_article': {
      const articleId = String(args?.articleId || '')
      if (!articleId) return { ok: false, error: 'ID do artigo obrigatório.' }

      let article = inMemoryArticles.get(articleId)
      if (!article) {
        const cached = await storageBridge.collections.list<NewsArticle>('feed_cache', {
          where: { id: articleId },
          limit: 1
        })
        if (cached && cached[0]) article = cached[0]
      }

      if (!article) {
        return { ok: false, error: 'Artigo não encontrado.' }
      }

      const savedItem: SavedArticle = {
        ...article,
        savedAt: Date.now()
      }

      await storageBridge.collections.upsert('saved_articles', { id: articleId }, savedItem)

      safeSend({
        type: 'event',
        eventType: 'news_article_saved',
        data: { articleId, title: article.title }
      })

      return {
        ok: true,
        saved: true,
        directResponse: `Artigo "${article.title}" salvo com sucesso.`
      }
    }

    case 'remove_saved_article': {
      const articleId = String(args?.articleId || '')
      if (!articleId) return { ok: false, error: 'ID do artigo obrigatório.' }

      await storageBridge.collections.remove('saved_articles', { id: articleId })
      return { ok: true, removed: true, directResponse: 'Artigo removido dos salvos.' }
    }

    case 'list_saved_articles': {
      const list = await storageBridge.collections.list('saved_articles')
      const sorted = (list || []).sort((a: SavedArticle, b: SavedArticle) => (b.savedAt || 0) - (a.savedAt || 0))
      return {
        ok: true,
        articles: sorted,
        total: sorted.length
      }
    }

    case 'get_profile': {
      return { ok: true, profile }
    }

    case 'update_profile': {
      const updates = args?.updates || args || {}
      const updatedProfile: UserProfile = {
        ...profile,
        ...updates,
        version: profile.version
      }
      await saveUserProfile(updatedProfile)
      return { ok: true, profile: updatedProfile }
    }

    case 'get_feed_feedback': {
      return { ok: true, feedback: await getArticleFeedback() }
    }

    case 'set_article_feedback': {
      const articleId = String(args?.articleId || '').trim()
      if (!articleId) return { ok: false, error: 'articleId obrigatório.' }

      const requested = args?.type
      const type: 'like' | 'dislike' | null =
        requested === 'like' || requested === 'dislike' ? requested : null

      const map = await getArticleFeedback()
      const previous = map[articleId] || null
      if (type) map[articleId] = type
      else delete map[articleId]
      await saveArticleFeedback(map)

      // Turning a reaction on/off shifts the learned affinity by the delta only.
      const delta = feedbackWeight(type) - feedbackWeight(previous)
      if (delta !== 0) {
        applyAffinityDelta(
          profile,
          { sourceId: args?.sourceId, topics: args?.topics, terms: resolveArticleTerms(articleId, args?.title) },
          delta
        )
        await saveUserProfile(profile)
      }

      return { ok: true, feedback: map, type, previous }
    }

    case 'record_interaction': {
      const { type, articleId, sourceId, topics } = args
      if (articleId) {
        seenIds.add(articleId)
        // Keep up to 500 recent seen ids
        const recentSeen = Array.from(seenIds).slice(-500)
        await storageBridge.storage.set('news_seen_articles', recentSeen)
      }

      const weight = type === 'save' ? 2 : type === 'click' ? 1 : type === 'view' ? 0.5 : 0
      if (weight > 0) {
        applyAffinityDelta(
          profile,
          { sourceId, topics, terms: resolveArticleTerms(String(articleId || ''), args?.title) },
          weight
        )
        await saveUserProfile(profile)
      }

      return { ok: true }
    }

    case 'clear_cache': {
      const clearedCount = inMemoryArticles.size
      inMemoryArticles.clear()
      feedHttpCache.clear()
      ogImageCache.clear()
      try {
        const list = await storageBridge.collections.list('feed_cache')
        if (Array.isArray(list)) {
          for (const a of list) {
            if (a && a.id) {
              await storageBridge.collections.remove('feed_cache', { id: a.id })
            }
          }
        }
      } catch {}
      return { ok: true, clearedCount, directResponse: 'Cache de notícias limpo com sucesso.' }
    }

    case 'get_cache_stats': {
      let cachedCount = inMemoryArticles.size
      try {
        const cached = await storageBridge.collections.list('feed_cache')
        if (Array.isArray(cached) && cached.length > cachedCount) {
          cachedCount = cached.length
        }
      } catch {}

      let savedCount = 0
      try {
        const saved = await storageBridge.collections.list('saved_articles')
        if (Array.isArray(saved)) savedCount = saved.length
      } catch {}

      return {
        ok: true,
        cachedCount,
        savedCount,
        retentionDays: profile.retentionDays || 3,
        autoSyncIntervalMinutes: profile.autoSyncIntervalMinutes || 15,
        lastSyncAt: profile.lastSyncAt || Date.now()
      }
    }

    case 'prune_cache': {
      const days = Number(args?.retentionDays) || profile.retentionDays || 3
      await pruneOldArticles(days)
      return { ok: true, retentionDays: days }
    }

    case 'refresh_feeds': {
      await syncActiveFeeds(true)
      profile.lastSyncAt = Date.now()
      await saveUserProfile(profile)
      const articles = await getAllArticles()
      console.log(`[runtime:momai-noticias] refresh_feeds: ${articles.length} articles in cache after sync`)
      return { ok: true, totalArticles: articles.length }
    }

    case 'discover_feed': {
      const url = String(args?.url || '')
      return discoverFeedUrl(url)
    }

    // Used by the in-app reader before embedding a page: X-Frame-Options and
    // CSP frame-ancestors are enforced by Chromium, so the UI needs to know
    // beforehand whether the site can be framed at all.
    case 'check_article_embed': {
      const url = String(args?.url || '').trim()
      if (!url) return { ok: false, error: 'URL obrigatória.' }

      const cached = embedPolicyCache.get(url)
      if (cached) return { ok: true, ...cached }

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 6000)
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal
        })
        clearTimeout(timer)
        const policy = evaluateEmbedPolicy({
          xFrameOptions: res.headers.get('x-frame-options'),
          contentSecurityPolicy: res.headers.get('content-security-policy')
        })
        // Headers are all we need; release the body without downloading it.
        res.body?.cancel().catch(() => {})
        embedPolicyCache.set(url, policy)
        return { ok: true, ...policy }
      } catch (err: any) {
        console.warn('[runtime:momai-noticias] Embed check failed for', url, err?.message || err)
        // Network failure is not a framing policy: let the reader try the page.
        return { ok: true, embeddable: true }
      }
    }

    default:
      return { ok: false, error: `Ferramenta desconhecida: ${toolName}` }
  }
}

// Persistent workers are forked by the host straight from
// manifest.backgroundScript and must announce readiness/liveness: without the
// 'ready' signal the host waits 45s and then restarts the worker mid-sync.
if (process.env.MOMAI_PERSISTENT === 'true') {
  safeSend({ type: 'ready' })
  setInterval(() => safeSend({ type: 'heartbeat', timestamp: Date.now() }), 30000)
}

// Process incoming IPC messages from MomAI extension host
process.on('message', async (msg: any) => {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'storage-response') {
    try {
      storageResponseListener?.(msg)
    } catch {}
    return
  }
  if (msg.type === 'execute') {
    const { requestId, payload } = msg
    const { toolName, args } = payload || {}
    try {
      const result = await executeTool(toolName, args)
      safeSend({ type: 'response', requestId, result })
    } catch (err: any) {
      safeSend({
        type: 'response',
        requestId,
        result: { ok: false, error: err?.message || String(err) }
      })
    }
  } else if (msg.type === 'shutdown') {
    process.exit(0)
  }
})

process.on('disconnect', () => {
  process.exit(0)
})

export default {
  execute: executeTool,
  executeTool
}

export { executeTool, executeTool as execute }
