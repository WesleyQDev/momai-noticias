// src/services/api.ts
// Frontend API client to communicate with the momai-noticias worker
import sdk from 'momai:sdk'
import type {
  FeedResponse,
  BriefingResponse,
  FeedSource,
  UserProfile,
  NewsArticle,
  SavedArticle,
  ArticleFeedback,
  TickerResponse
} from './types'

const COALESCED_READ_COMMANDS = new Set([
  'list_saved_articles',
  'get_feed_feedback',
  'get_profile',
  'list_sources',
  'get_ticker_data'
])

const inFlightReadCommands = new Map<string, Promise<any>>()

function buildReadKey(toolName: string, args: Record<string, any>): string {
  const keys = Object.keys(args).sort()
  const normalized: Record<string, any> = {}
  for (const k of keys) {
    if (args[k] !== undefined) normalized[k] = args[k]
  }
  return `${toolName}:${JSON.stringify(normalized)}`
}

export async function executeCommand<T = any>(toolName: string, args: Record<string, any> = {}, timeoutMs = 25000): Promise<T> {
  const shouldCoalesce = COALESCED_READ_COMMANDS.has(toolName)
  const key = shouldCoalesce ? buildReadKey(toolName, args) : ''
  if (shouldCoalesce) {
    const existing = inFlightReadCommands.get(key)
    if (existing) return existing as Promise<T>
  }

  const run = (async () => {
    try {
      const res = await sdk.api.post('/extensions/momai-noticias/command', {
        toolName,
        args,
        timeoutMs
      })
      const data = res?.data !== undefined ? res.data : res
      return data as T
    } catch (err: any) {
      const serverError = err?.response?.data?.error || err?.response?.data?.message || err?.message || String(err)
      console.error(`[momai-noticias:api] Command ${toolName} failed:`, serverError)
      return { ok: false, error: serverError } as T
    } finally {
      if (shouldCoalesce) {
        inFlightReadCommands.delete(key)
      }
    }
  })()

  if (shouldCoalesce) {
    inFlightReadCommands.set(key, run)
  }

  return run
}

export const newsApi = {
  getFeed: (params: {
    topic?: string
    language?: string
    limit?: number
    onlyFollowed?: boolean
    session?: boolean
    cursor?: string
    offset?: number
    refresh?: boolean
    seed?: string
  } = {}) => executeCommand<FeedResponse>('get_feed', params),

  searchNews: (query: string, limit = 30) =>
    executeCommand<FeedResponse & { query: string }>('search_news', { query, limit }),

  getBriefing: (limitPerTopic = 3) =>
    executeCommand<BriefingResponse>('get_briefing', { limitPerTopic }),

  listSources: (language?: string) =>
    executeCommand<{ ok: boolean; sources: (FeedSource & { isFollowed: boolean; isBlocked: boolean })[] }>('list_sources', { language }),

  addCustomSource: (url: string, title?: string, language?: string) =>
    executeCommand<{ ok: boolean; source?: FeedSource; error?: string; errorCode?: string }>('add_custom_source', { url, title, language }),

  discoverFeed: (url: string) =>
    executeCommand<{ ok: boolean; feeds?: { url: string; title?: string }[]; error?: string }>('discover_feed', { url }),

  checkArticleEmbed: (url: string) =>
    executeCommand<{ ok: boolean; embeddable?: boolean; reason?: string; error?: string }>('check_article_embed', { url }),

  saveArticle: (articleId: string) =>
    executeCommand<{ ok: boolean; saved?: boolean; error?: string }>('save_article', { articleId }),

  removeSavedArticle: (articleId: string) =>
    executeCommand<{ ok: boolean; removed?: boolean }>('remove_saved_article', { articleId }),

  listSavedArticles: () =>
    executeCommand<{ ok: boolean; articles: SavedArticle[]; total: number }>('list_saved_articles'),

  getProfile: () =>
    executeCommand<{ ok: boolean; profile: UserProfile }>('get_profile'),

  updateProfile: (updates: Partial<UserProfile>) =>
    executeCommand<{ ok: boolean; profile: UserProfile }>('update_profile', { updates }),

  recordInteraction: (data: {
    type: 'click' | 'view' | 'save'
    articleId: string
    sourceId?: string
    topics?: string[]
    title?: string
  }) => executeCommand<{ ok: boolean }>('record_interaction', data),

  getFeedFeedback: () =>
    executeCommand<{ ok: boolean; feedback: Record<string, ArticleFeedback> }>('get_feed_feedback'),

  setArticleFeedback: (data: {
    articleId: string
    type: ArticleFeedback | null
    sourceId?: string
    topics?: string[]
    title?: string
  }) => executeCommand<{ ok: boolean; feedback?: Record<string, ArticleFeedback>; error?: string }>('set_article_feedback', data),

  refreshFeeds: () =>
    executeCommand<{ ok: boolean; totalArticles: number }>('refresh_feeds', {}, 35000),

  getTickerData: () =>
    executeCommand<TickerResponse>('get_ticker_data', {}, 15000)
}
