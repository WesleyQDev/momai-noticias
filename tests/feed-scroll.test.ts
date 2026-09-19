import { describe, it, expect, vi } from 'vitest'
import { scrollFeedToTop } from '../src/services/feed-scroll'

describe('scrollFeedToTop', () => {
  it('scrolls the feed container back to the top', () => {
    const scrollTo = vi.fn()
    const container = { scrollTo } as unknown as HTMLElement

    scrollFeedToTop(container)

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('ignores a missing container without throwing', () => {
    expect(() => scrollFeedToTop(null)).not.toThrow()
    expect(() => scrollFeedToTop(undefined)).not.toThrow()
  })
})
