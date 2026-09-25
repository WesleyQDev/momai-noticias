import { useCallback, useEffect, useRef, useState } from 'react'
import { useExtensionEvents } from 'momai:events'
import { newsApi } from '../services/api'
import type { NewsArticle } from '../services/types'

export const FEED_PAGE_SIZE = 15
const SYNC_REFETCH_DELAY_MS = 2500
const MAX_SYNC_REFETCHES = 4

export interface FeedParams {
  topic?: string
  language?: string
  onlyFollowed?: boolean
  seed?: string
  refresh?: boolean
}

export interface PageResult {
  ok: boolean
  error?: string
}

export function useFeedPagination() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const cursorRef = useRef('')
  const paramsRef = useRef<FeedParams>({})
  const topicCacheRef = useRef<Map<string, { articles: NewsArticle[]; total: number; cursor: string }>>(new Map())
  const pageCacheRef = useRef<Map<string, NewsArticle[]>>(new Map())
  const requestSeqRef = useRef(0)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)
  const syncAttemptsRef = useRef(0)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goToPageRef = useRef<(page: number, options?: { silent?: boolean; refresh?: boolean; seed?: string }) => Promise<PageResult>>(
    async () => ({ ok: true })
  )

  const clearSyncTimer = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
  }, [])

  // Listen to background feed batch updates to progressively render new news
  useExtensionEvents({
    eventType: 'news_feed_updated',
    onEvent: () => {
      if (pageRef.current === 1 && !loadingRef.current) {
        clearSyncTimer()
        syncTimerRef.current = setTimeout(() => {
          syncTimerRef.current = null
          void goToPageRef.current(1, { silent: true })
        }, 400)
      }
    }
  })

  // Follow-up reads while the worker refreshes feeds in the background: the
  // first page is replayed silently so new articles appear without a reload.
  const scheduleSyncRefetch = useCallback(() => {
    clearSyncTimer()
    if (pageRef.current !== 1) return
    if (syncAttemptsRef.current >= MAX_SYNC_REFETCHES) return
    syncAttemptsRef.current += 1
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null
      void goToPageRef.current(1, { silent: true })
    }, SYNC_REFETCH_DELAY_MS)
  }, [clearSyncTimer])

  useEffect(() => clearSyncTimer, [clearSyncTimer])

  const goToPage = useCallback(
    async (targetPage: number, options: { silent?: boolean; refresh?: boolean; seed?: string } = {}): Promise<PageResult> => {
      const pageNumber = Math.max(1, Math.floor(Number(targetPage)) || 1)
      const topicKey = paramsRef.current.topic || 'paravoce'
      const pageKey = `${topicKey}:${pageNumber}`
      const isRefresh = Boolean(options.refresh || paramsRef.current.refresh)

      const cachedPage = options.silent || isRefresh ? undefined : pageCacheRef.current.get(pageKey)
      if (cachedPage && cachedPage.length > 0) {
        pageRef.current = pageNumber
        setPage(pageNumber)
        setArticles(cachedPage)
        return { ok: true }
      }

      loadingRef.current = true
      if (!options.silent) setIsLoadingPage(true)
      const seq = requestSeqRef.current

      try {
        const refreshSeed = options.seed || paramsRef.current.seed || (isRefresh ? String(Date.now()) : undefined)
        const res = await newsApi.getFeed({
          ...paramsRef.current,
          limit: FEED_PAGE_SIZE,
          session: true,
          cursor: isRefresh ? undefined : cursorRef.current || undefined,
          offset: isRefresh ? 0 : (pageNumber - 1) * FEED_PAGE_SIZE,
          refresh: isRefresh || undefined,
          seed: refreshSeed
        })
        if (seq !== requestSeqRef.current) return { ok: true }
        if (!res.ok || !Array.isArray(res.articles)) {
          return { ok: false, error: res.error }
        }

        const isNewSession = !cursorRef.current
        cursorRef.current = res.cursor || cursorRef.current
        const servedPage = Math.floor((Number(res.offset) || 0) / FEED_PAGE_SIZE) + 1
        const servedKey = `${topicKey}:${servedPage}`

        pageCacheRef.current.set(servedKey, res.articles)
        if (servedPage === 1) {
          topicCacheRef.current.set(topicKey, {
            articles: res.articles,
            total: Number(res.total) || res.articles.length,
            cursor: cursorRef.current
          })
        }

        pageRef.current = servedPage
        setPage(servedPage)
        setArticles(res.articles)
        setTotal(Number(res.total) || res.articles.length)
        const stillSyncing = Boolean((res as { syncing?: boolean }).syncing)
        setSyncing(stillSyncing)
        if (stillSyncing) scheduleSyncRefetch()
        return { ok: true }
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) }
      } finally {
        if (seq === requestSeqRef.current) {
          loadingRef.current = false
          if (!options.silent) setIsLoadingPage(false)
        }
      }
    },
    [scheduleSyncRefetch]
  )

  useEffect(() => {
    goToPageRef.current = goToPage
  }, [goToPage])

  const loadFirstPage = useCallback(
    async (params: FeedParams = {}, options: { force?: boolean } = {}): Promise<PageResult> => {
      paramsRef.current = params
      requestSeqRef.current += 1
      clearSyncTimer()
      syncAttemptsRef.current = 0
      setSyncing(false)

      const topicKey = params.topic || 'paravoce'
      if (options.force || params.refresh) {
        topicCacheRef.current.delete(topicKey)
        for (const key of [...pageCacheRef.current.keys()]) {
          if (key === topicKey || key.startsWith(`${topicKey}:`)) pageCacheRef.current.delete(key)
        }
        cursorRef.current = ''
        setTotal(0)
        return goToPage(1, { refresh: true, seed: params.seed || String(Date.now()) })
      }
      const cachedTopic = topicCacheRef.current.get(topicKey)
      if (cachedTopic && cachedTopic.articles.length > 0) {
        cursorRef.current = cachedTopic.cursor
        pageRef.current = 1
        setPage(1)
        setArticles(cachedTopic.articles)
        setTotal(cachedTopic.total)
        // Revalidate silently in background to keep fresh
        void goToPage(1, { silent: true })
        return { ok: true }
      }

      cursorRef.current = ''
      setTotal(0)
      return goToPage(1)
    },
    [clearSyncTimer, goToPage]
  )

  // Search results and other one-shot lists replace the feed and disable paging.
  const setStatic = useCallback(
    (list: NewsArticle[], listTotal?: number) => {
      requestSeqRef.current += 1
      clearSyncTimer()
      cursorRef.current = ''
      syncAttemptsRef.current = 0
      pageRef.current = 1
      setPage(1)
      setArticles(list)
      setTotal(Number(listTotal) || list.length)
      setSyncing(false)
    },
    [clearSyncTimer]
  )

  const pageCount = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE))

  return {
    articles,
    page,
    pageCount,
    total,
    isLoadingPage,
    syncing,
    loadFirstPage,
    goToPage,
    setStatic
  }
}
