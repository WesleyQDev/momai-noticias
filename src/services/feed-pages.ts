// src/services/feed-pages.ts
// Stable pagination for the infinite feed. The worker snapshots the ranked
// order once per scroll session, so later pages never shift or repeat while a
// fresh ranking keeps placing new articles at the top.

export interface FeedPageSession {
  cursor: string
  ids: string[]
  createdAt: number
}

export interface FeedPageStoreOptions {
  ttlMs?: number
  maxSessions?: number
  now?: () => number
  createCursor?: () => string
}

export interface FeedPageSlice {
  ids: string[]
  nextOffset: number
  hasMore: boolean
}

const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_MAX_SESSIONS = 4

function defaultCursor(): string {
  return `pg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createFeedPageStore(options: FeedPageStoreOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const maxSessions = Math.max(1, options.maxSessions ?? DEFAULT_MAX_SESSIONS)
  const now = options.now ?? (() => Date.now())
  const createCursor = options.createCursor ?? defaultCursor
  const sessions = new Map<string, FeedPageSession>()

  function prune(): void {
    const cutoff = now() - ttlMs
    for (const [cursor, session] of sessions) {
      if (session.createdAt <= cutoff) sessions.delete(cursor)
    }
  }

  function open(ids: string[]): FeedPageSession {
    prune()
    while (sessions.size >= maxSessions) {
      let oldest: FeedPageSession | null = null
      for (const session of sessions.values()) {
        if (!oldest || session.createdAt < oldest.createdAt) oldest = session
      }
      if (!oldest) break
      sessions.delete(oldest.cursor)
    }
    let cursor = createCursor()
    for (let attempt = 0; attempt < 5 && sessions.has(cursor); attempt += 1) {
      cursor = createCursor()
    }
    const session: FeedPageSession = { cursor, ids: [...ids], createdAt: now() }
    sessions.set(session.cursor, session)
    return session
  }

  function get(cursor: string): FeedPageSession | null {
    if (!cursor) return null
    const session = sessions.get(cursor)
    if (!session) return null
    if (session.createdAt <= now() - ttlMs) {
      sessions.delete(cursor)
      return null
    }
    return session
  }

  function close(cursor: string): void {
    sessions.delete(cursor)
  }

  return {
    open,
    get,
    close,
    prune,
    get size(): number {
      return sessions.size
    }
  }
}

export type FeedPageStore = ReturnType<typeof createFeedPageStore>

export function readFeedPage(ids: string[], offset: number, limit: number): FeedPageSlice {
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const size = Math.max(1, Math.floor(Number(limit)) || 1)
  const slice = ids.slice(start, start + size)
  const nextOffset = start + slice.length
  return { ids: slice, nextOffset, hasMore: nextOffset < ids.length }
}

// Numeric page buttons shown around the current page, clamped to the edges.
export function buildPageWindow(page: number, pageCount: number, size = 5): number[] {
  const count = Math.max(1, Math.floor(Number(pageCount)) || 1)
  const span = Math.max(1, Math.floor(Number(size)) || 1)
  const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), count)
  const start = Math.min(Math.max(1, current - Math.floor(span / 2)), Math.max(1, count - span + 1))
  const end = Math.min(count, start + span - 1)

  const window: number[] = []
  for (let number = start; number <= end; number += 1) window.push(number)
  return window
}
