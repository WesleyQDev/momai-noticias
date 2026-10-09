// runtime.ts
// MomAI Notícias persistent background worker
// Handles feed collection, caching, ranking, feed discovery, and IPC tools for Assistant and UI

import fs from 'node:fs'
import path from 'node:path'
import { parseFeedXml, sanitizeUrl, extractImageFromHtml, decodeFeedBuffer, upgradeImageUrl } from './src/services/feed-parser.ts'
import { extractFeedUrlsFromHtml, COMMON_FEED_PATHS } from './src/services/discovery.ts'
import { resolveCatalogPath } from './src/services/catalog-path.ts'
import { rankAndFilterFeed, scoreFeedArticles, applyDiversityLimit, decayAffinities } from './src/services/ranking.ts'
import { createFeedPageStore, readFeedPage } from './src/services/feed-pages.ts'
import { resolveFeedSeed, shouldReuseSession } from './src/services/feed-shuffle.ts'
import { evaluateEmbedPolicy } from './src/services/embed-policy.ts'
import { buildFeedMix, spreadSameCategory, ensureFirstOfTopicHasPhoto } from './src/services/feed-mix.ts'
import { extractInterestTerms } from './src/services/interest-terms.ts'
import { classifyTextToTopics } from './src/services/categories.ts'
import { resolveUserProfile, mergeCustomSources } from './src/services/profile.ts'
import { isPrivateNetworkUrl } from './src/services/url-safety.ts'
import type { NewsArticle, FeedSource, UserProfile, CanonicalTopic, SavedArticle } from './src/services/types.ts'

function safeSend(msg: any) {
  try {
    if (typeof process.send === 'function') {
      process.send(msg)
    }
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] IPC send error:', err?.message || err)
  }
}

// Persistent-worker mode is the only context where this module owns the
// process: it receives IPC commands and keeps timers/state alive. When the
// backend loads the runtime in-process (non-background extensions), global
// handlers would leak into the host process, so they stay disabled here.
const IS_PERSISTENT = process.env.MOMAI_PERSISTENT === 'true'

if (IS_PERSISTENT) {
  process.on('uncaughtException', (err: any) => {
    console.error('[runtime:momai-noticias] Uncaught exception:', err)
  })
  process.on('unhandledRejection', (reason: any) => {
    console.error('[runtime:momai-noticias] Unhandled rejection:', reason)
  })
}
import { createIpcNewsStorage } from './storage-ipc.ts'

let storageResponseListener: ((msg: any) => void) | null = null
const storageBridge = createIpcNewsStorage({
  send: safeSend,
  onResponse: (listener) => {
    storageResponseListener = listener
  }
})

// Routes a host storage response to the bridge. The IPC handler uses it and
// the integration tests call it directly, since they cannot emit on the
// process 'message' channel without colliding with the test runner.
export function handleStorageResponse(msg: any): void {
  try {
    storageResponseListener?.(msg)
  } catch {}
}

// Load Catalog
let curatedSources: FeedSource[] = []
try {
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd()
  const catalogPath = resolveCatalogPath(process.argv[3], currentDir, process.cwd())
  if (catalogPath) {
    curatedSources = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  }
} catch (e: any) {
  console.error('[runtime:momai-noticias] Failed to load catalog.json:', e?.message || e)
}

// In-Memory Cache
const inMemoryArticles = new Map<string, NewsArticle>()
const feedHttpCache = new Map<string, { etag?: string; lastModified?: string; lastFetchedAt: number }>()
const ogImageCache = new Map<string, string>()
const embedPolicyCache = new Map<string, { embeddable: boolean; reason?: string }>()
const OG_IMAGE_CACHE_MAX = 500
const EMBED_POLICY_CACHE_MAX = 500
// Scroll sessions for the infinite feed (see src/services/feed-pages.ts).
const feedPageStore = createFeedPageStore()

function setCapped<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
  if (!map.has(key) && map.size >= maxEntries) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

const OG_HTML_LIMIT_BYTES = 128 * 1024

// Reads only the beginning of an HTML response: article pages can be several
// megabytes and all the og:image meta tags live in the <head>.
async function readLimitedText(res: Response, maxBytes: number): Promise<string> {
  const body = res.body as ReadableStream<Uint8Array> | null
  if (!body || typeof (body as any).getReader !== 'function') {
    return res.text()
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        total += value.length
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {}
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

const USER_AGENT = 'MomAI-News-Reader/1.0 (+https://github.com/WesleyQDev/momai)'
const FETCH_TIMEOUT_MS = 9000

// Helper to get or initialize user profile
async function getUserProfile(): Promise<UserProfile> {
  try {
    const profile = await storageBridge.storage.get('news_user_profile')
    if (profile && typeof profile === 'object') {
      return resolveUserProfile(profile, curatedSources)
    }
  } catch {}
  return resolveUserProfile(null, curatedSources)
}

async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await storageBridge.storage.set('news_user_profile', profile)
  } catch (err) {
    console.error('[runtime:momai-noticias] Failed to save profile:', err)
  }
}

// Refreshes only the sync mark from a fresh read, so a sync that finished
// while tool calls changed the profile cannot overwrite those changes with a
// stale snapshot.
async function markLastSync(): Promise<void> {
  try {
    const current = await getUserProfile()
    current.lastSyncAt = Date.now()
    await saveUserProfile(current)
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Failed to persist lastSyncAt:', err?.message || err)
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
      // Not modified: keep the validators and refresh the freshness mark so
      // the 15-minute sync filter does not refetch every feed again.
      const cached = feedHttpCache.get(source.feed)
      feedHttpCache.set(source.feed, {
        etag: cached?.etag,
        lastModified: cached?.lastModified,
        lastFetchedAt: Date.now()
      })
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

    // Store in memory (persistence is batched by performSyncActiveFeeds: one
    // storage transaction per sync instead of one per feed).
    for (const article of parsed) {
      inMemoryArticles.set(article.id, article)
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
  if (isPrivateNetworkUrl(url)) return undefined
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) return undefined
    const html = await readLimitedText(res, OG_HTML_LIMIT_BYTES)

    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (ogMatch && ogMatch[1]) {
      let rawImg = ogMatch[1].trim()
      try {
        rawImg = new URL(rawImg, url).toString()
      } catch {}
      const imgUrl = upgradeImageUrl(rawImg) || rawImg
      setCapped(ogImageCache, url, imgUrl, OG_IMAGE_CACHE_MAX)
      return imgUrl
    }
  } catch {}
  return undefined
}

// Discover RSS/Atom feed from website URL
async function discoverFeedUrl(rawSiteUrl: string): Promise<{ ok: boolean; feeds?: { url: string; title?: string }[]; error?: string; errorCode?: string }> {
  try {
    let target = rawSiteUrl.trim()
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target
    }

    // User/assistant supplied URLs must not reach internal services.
    if (isPrivateNetworkUrl(target)) {
      return { ok: false, errorCode: 'private_url', error: 'Endereço de rede privada não permitido.' }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { ok: false, errorCode: 'source_http_error', error: `Não foi possível acessar a página (HTTP ${res.status}).` }
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

    return { ok: false, errorCode: 'feed_not_found', error: 'Nenhum feed RSS ou Atom foi encontrado neste endereço.' }
  } catch (err: any) {
    return { ok: false, errorCode: 'discovery_failed', error: err?.message || 'Falha ao descobrir feed' }
  }
}

// Fetch all active feeds based on user profile
const BREAKING_ALERT_WINDOW_MS = 90 * 60 * 1000
const BREAKING_ALERT_MAX_IDS = 500
const emittedBreakingIds = new Set<string>()

// Emits at most one urgent-news event per sync, only for a fresh article from
// a source the user follows. Automations listening to news_breaking_alert get
// a real signal without a notification storm.
function emitBreakingAlert(profile: UserProfile, articles: NewsArticle[]): void {
  const followed = new Set(profile.followedSources || [])
  if (followed.size === 0) return

  const cutoff = Date.now() - BREAKING_ALERT_WINDOW_MS
  let candidate: NewsArticle | null = null
  for (const article of articles) {
    if (!article.id || !followed.has(article.sourceId)) continue
    if (!article.publishedAt || article.publishedAt < cutoff) continue
    if (emittedBreakingIds.has(article.id)) continue
    if (!candidate || article.publishedAt > candidate.publishedAt) candidate = article
  }
  if (!candidate) return

  emittedBreakingIds.add(candidate.id)
  if (emittedBreakingIds.size > BREAKING_ALERT_MAX_IDS) {
    const oldest = emittedBreakingIds.values().next().value
    if (oldest !== undefined) emittedBreakingIds.delete(oldest)
  }
  safeSend({
    type: 'event',
    eventType: 'news_breaking_alert',
    data: { title: candidate.title, sourceName: candidate.sourceName, url: candidate.url }
  })
}

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

  // Prioritize primary portals and followed sources first so headline and top feed are ready rapidly
  const sortedSources = [...sourcesToFetch].sort((a, b) => {
    const aFollowed = profile.followedSources?.includes(a.id) ? 1 : 0
    const bFollowed = profile.followedSources?.includes(b.id) ? 1 : 0
    if (aFollowed !== bFollowed) return bFollowed - aFollowed
    const aMain = (a.topics?.includes('geral') || a.id.includes('geral') || a.id.includes('g1') || a.id.includes('folha') || a.id.includes('bbc') || a.id.includes('uol')) ? 1 : 0
    const bMain = (b.topics?.includes('geral') || b.id.includes('geral') || b.id.includes('g1') || b.id.includes('folha') || b.id.includes('bbc') || b.id.includes('uol')) ? 1 : 0
    return bMain - aMain
  })

  // Concurrency-limited fetch (max 5 simultaneous). Articles are persisted
  // once at the end (chunked) so a 25-feed sync costs one storage transaction
  // instead of 25 synchronous SQLite writes on the host event loop.
  const batchSize = 5
  const pendingPersistence: NewsArticle[] = []
  for (let i = 0; i < sortedSources.length; i += batchSize) {
    const batch = sortedSources.slice(i, i + batchSize)
    const results = await Promise.all(batch.map((s) => fetchSingleFeed(s)))
    for (const parsed of results) {
      if (parsed.length > 0) pendingPersistence.push(...parsed)
    }
    safeSend({
      type: 'event',
      eventType: 'news_feed_updated',
      data: { count: inMemoryArticles.size, batchIndex: i }
    })
  }

  const PERSIST_CHUNK = 1000
  for (let i = 0; i < pendingPersistence.length; i += PERSIST_CHUNK) {
    try {
      await storageBridge.collections.upsertMany(
        'feed_cache',
        pendingPersistence.slice(i, i + PERSIST_CHUNK)
      )
    } catch (err: any) {
      console.warn(
        `[runtime:momai-noticias] Failed to persist ${pendingPersistence.length} articles:`,
        err?.message || err
      )
      break
    }
  }

  emitBreakingAlert(profile, pendingPersistence)
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

  // Prune feed_cache collection page by page. The cutoff may sit beyond the
  // first page, so the scan must continue until the collection is exhausted
  // instead of stopping at the first page without old articles.
  const PAGE_SIZE = 500
  const MAX_PAGES = 100
  try {
    let offset = 0
    for (let page = 0; page < MAX_PAGES; page++) {
      const list = await storageBridge.collections.list<NewsArticle>('feed_cache', {
        limit: PAGE_SIZE,
        offset,
        orderBy: 'publishedAt'
      })
      if (!Array.isArray(list) || list.length === 0) break

      let removedCount = 0
      for (const a of list) {
        if (a && a.id && a.publishedAt && a.publishedAt < cutoff) {
          await storageBridge.collections.remove('feed_cache', { id: a.id })
          removedCount++
        }
      }

      if (list.length < PAGE_SIZE) break
      // Removed rows shift the next window left; only advance past survivors.
      offset += list.length - removedCount
    }
  } catch (err: any) {
    console.warn('[runtime:momai-noticias] Failed to prune feed_cache:', err?.message || err)
  }
}

// Ensure articles are populated from in-memory or collection cache
async function getAllArticles(): Promise<NewsArticle[]> {
  if (inMemoryArticles.size > 0) {
    return Array.from(inMemoryArticles.values())
  }
  try {
    const profile = await getUserProfile()
    const retentionDays = profile.retentionDays || 3
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

    const cached: NewsArticle[] = []
    for (let offset = 0; offset < 2000; offset += 500) {
      const page = await storageBridge.collections.list<NewsArticle>('feed_cache', {
        limit: 500,
        offset,
        orderBy: 'publishedAt'
      })
      if (!Array.isArray(page) || page.length === 0) break
      for (const a of page) {
        if (a && a.id && (!a.publishedAt || a.publishedAt >= cutoff)) {
          if (a.image) {
            a.image = upgradeImageUrl(a.image) || a.image
          }
          inMemoryArticles.set(a.id, a)
          cached.push(a)
        }
      }
      if (page.length < 500) break
    }
    if (cached.length > 0) {
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

// Background initial preload & auto-prune on startup. These timers only make
// sense in the long-lived worker process; in-process runtimes would leak them
// into the host.
if (IS_PERSISTENT) {
  // Preload and initial sync on background startup (staggered to avoid boot contention)
  setTimeout(async () => {
    try {
      const profile = await getUserProfile()
      const cached = await getAllArticles()
      await pruneOldArticles(profile.retentionDays || 3)
      const lastSync = profile.lastSyncAt || 0
      const isStale = Date.now() - lastSync > 15 * 60 * 1000
      if (cached.length === 0 || isStale) {
        await syncActiveFeeds(cached.length === 0)
        await markLastSync()
      }
    } catch (err: any) {
      console.warn('[runtime:momai-noticias] Initial preload error:', err?.message || err)
    }
  }, 10000)

  // Periodic background auto-sync & prune (every 15 minutes)
  setInterval(async () => {
    try {
      const profile = await getUserProfile()
      await syncActiveFeeds(false)
      await pruneOldArticles(profile.retentionDays || 3)
      await markLastSync()
    } catch (err: any) {
      console.warn('[runtime:momai-noticias] Auto sync error:', err?.message || err)
    }
  }, 15 * 60 * 1000)
}

// Execute Tool Handler
async function executeTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const profile = await getUserProfile()
  const seenIds = await getSeenArticleIds()

  switch (toolName) {
    case 'get_feed': {
      let articles = await getAllArticles()
      let syncing = false

      const limit = Math.min(Math.max(Number(args?.limit) || 40, 1), 100)
      const offset = Math.max(0, Math.floor(Number(args?.offset)) || 0)
      const requestedCursor = typeof args?.cursor === 'string' ? args.cursor : ''
      const isRefresh = Boolean(args?.refresh)
      const feedSeed = resolveFeedSeed({ seed: args?.seed, refresh: isRefresh })

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
        if (isRefresh) {
          syncing = true
          syncActiveFeeds(true)
            .then(() => markLastSync())
            .catch((err) => {
              console.warn('[runtime:momai-noticias] Background refresh sync error:', err?.message || err)
            })
        } else if (isSyncRunning) {
          syncing = true
        } else if (isStaleFeed) {
          syncing = true
          syncActiveFeeds(false)
            .then(() => markLastSync())
            .catch((err) => {
              console.warn('[runtime:momai-noticias] Background sync error:', err?.message || err)
            })
        }
      }

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

      // Search serves the cache immediately; the background refresh must not
      // block the answer because a full sync can outlive the caller timeout.
      void syncActiveFeeds(false)
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
      let articles = await getAllArticles()
      if (articles.length === 0) {
        await syncActiveFeeds(true)
        articles = await getAllArticles()
      } else {
        // Same as search: refresh in the background, answer from cache now.
        void syncActiveFeeds(false)
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

      // Score the whole corpus once and reuse it for every topic instead of
      // re-scoring thousands of articles per topic.
      const scored = scoreFeedArticles(articles, profile, seenIds)

      for (const t of topics) {
        const rankedForTopic = ensureFirstOfTopicHasPhoto(
          applyDiversityLimit(scored.filter((article) => (article.canonicalTopics || []).includes(t)))
        )
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
        return {
          ok: false,
          error: discovery.error || 'Nenhum feed encontrado.',
          errorCode: discovery.errorCode || 'feed_not_found'
        }
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
      const updates = (args?.updates || args || {}) as Partial<UserProfile>
      const updatedProfile: UserProfile = {
        ...profile,
        ...updates,
        // A caller saving a form may hold a snapshot older than a source just
        // added through add_custom_source; merging by id keeps both.
        customSources: mergeCustomSources(profile.customSources, updates.customSources),
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
      embedPolicyCache.clear()
      try {
        // Bulk clear when the host supports it; fall back to one remove per item.
        await storageBridge.collections.clear('feed_cache')
      } catch {
        try {
          const list = await storageBridge.collections.list<NewsArticle>('feed_cache')
          for (const a of Array.isArray(list) ? list : []) {
            if (a && a.id) {
              await storageBridge.collections.remove('feed_cache', { id: a.id })
            }
          }
        } catch {}
      }
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
      await markLastSync()
      const articles = await getAllArticles()
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

      // Internal addresses must not be fetched (or framed) by the reader.
      if (isPrivateNetworkUrl(url)) {
        return { ok: true, embeddable: false, reason: 'private_network' }
      }

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
      setCapped(embedPolicyCache, url, policy, EMBED_POLICY_CACHE_MAX)
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
// Everything below owns only the forked worker process; an in-process runtime
// must not touch the host process globals or IPC channel.
let executeQueue: Promise<void> = Promise.resolve()

if (IS_PERSISTENT) {
  safeSend({ type: 'ready' })
  setInterval(() => safeSend({ type: 'heartbeat', timestamp: Date.now() }), 30000)

  // Process incoming IPC messages from MomAI extension host
  process.on('message', (msg: any) => {
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'storage-response') {
      handleStorageResponse(msg)
      return
    }
    if (msg.type === 'execute') {
      const { requestId, payload } = msg
      const { toolName, args } = payload || {}
      // Tool calls run one at a time: overlapping calls would each save a full
      // profile snapshot and the last write would drop the first one.
      executeQueue = executeQueue.then(async () => {
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
      })
    } else if (msg.type === 'shutdown') {
      process.exit(0)
    }
  })

  process.on('disconnect', () => {
    process.exit(0)
  })
}

export default {
  execute: executeTool,
  executeTool
}

export { executeTool, executeTool as execute }
