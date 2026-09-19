import { describe, it, expect } from 'vitest'
import { buildPageWindow, createFeedPageStore, readFeedPage } from '../src/services/feed-pages'

describe('Feed pagination', () => {
  it('serves consecutive pages without overlap or gaps', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']

    const first = readFeedPage(ids, 0, 2)
    const second = readFeedPage(ids, first.nextOffset, 2)
    const third = readFeedPage(ids, second.nextOffset, 2)

    expect(first.ids).toEqual(['a', 'b'])
    expect(first.hasMore).toBe(true)
    expect(second.ids).toEqual(['c', 'd'])
    expect(second.hasMore).toBe(true)
    expect(third.ids).toEqual(['e'])
    expect(third.hasMore).toBe(false)
    expect([...first.ids, ...second.ids, ...third.ids]).toEqual(ids)
  })

  it('reports no more pages when the offset is at or past the end', () => {
    const ids = ['a', 'b']

    const atEnd = readFeedPage(ids, 2, 5)
    const pastEnd = readFeedPage(ids, 9, 5)

    expect(atEnd.ids).toEqual([])
    expect(atEnd.hasMore).toBe(false)
    expect(pastEnd.ids).toEqual([])
    expect(pastEnd.hasMore).toBe(false)
  })

  it('sanitizes negative offsets and invalid limits', () => {
    const ids = ['a', 'b', 'c']

    expect(readFeedPage(ids, -5, 2).ids).toEqual(['a', 'b'])
    expect(readFeedPage(ids, Number.NaN, 0).ids).toEqual(['a'])
  })

  it('keeps an open session stable when a newer ranking changes the order', () => {
    const cursors = ['cursor-1', 'cursor-2']
    const store = createFeedPageStore({ createCursor: () => cursors.shift() as string })
    const session = store.open(['a', 'b', 'c'])

    // A newer ranking (fresh articles at the top) must not shift the open pages.
    store.open(['x', 'y', 'z'])

    expect(store.get(session.cursor)?.ids).toEqual(['a', 'b', 'c'])
    expect(readFeedPage(session.ids, 2, 5).ids).toEqual(['c'])
  })

  it('expires sessions after the ttl', () => {
    let now = 1_000
    const store = createFeedPageStore({ ttlMs: 100, now: () => now, createCursor: () => 'cursor-1' })
    store.open(['a'])

    expect(store.get('cursor-1')).not.toBeNull()

    now = 1_101

    expect(store.get('cursor-1')).toBeNull()
  })

  it('evicts the oldest session when the capacity is reached', () => {
    const cursors = ['cursor-1', 'cursor-2', 'cursor-3']
    const store = createFeedPageStore({ maxSessions: 2, createCursor: () => cursors.shift() as string })

    store.open(['a'])
    store.open(['b'])
    store.open(['c'])

    expect(store.get('cursor-1')).toBeNull()
    expect(store.get('cursor-2')).not.toBeNull()
    expect(store.get('cursor-3')).not.toBeNull()
  })

  it('returns null for unknown cursors', () => {
    const store = createFeedPageStore({ createCursor: () => 'cursor-1' })

    expect(store.get('')).toBeNull()
    expect(store.get('does-not-exist')).toBeNull()
  })
})

describe('Page window', () => {
  it('shows every page when there are few of them', () => {
    expect(buildPageWindow(1, 3)).toEqual([1, 2, 3])
    expect(buildPageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('centers the window on the current page', () => {
    expect(buildPageWindow(5, 10)).toEqual([3, 4, 5, 6, 7])
  })

  it('clamps the window at the first and last pages', () => {
    expect(buildPageWindow(1, 10)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageWindow(10, 10)).toEqual([6, 7, 8, 9, 10])
  })

  it('keeps a single page for an empty feed', () => {
    expect(buildPageWindow(1, 0)).toEqual([1])
  })

  it('clamps out-of-range current pages', () => {
    expect(buildPageWindow(99, 10)).toEqual([6, 7, 8, 9, 10])
    expect(buildPageWindow(-4, 10)).toEqual([1, 2, 3, 4, 5])
  })
})
