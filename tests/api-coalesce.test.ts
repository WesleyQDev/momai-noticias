import { describe, expect, it, vi, beforeEach } from 'vitest'

const postMock = vi.fn()

vi.mock('momai:sdk', () => ({
  default: {
    api: {
      post: (...args: any[]) => postMock(...args)
    }
  }
}))

import { newsApi } from '../src/services/api'

describe('newsApi read command coalescing', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('coalesces concurrent listSavedArticles calls into a single in-flight request', async () => {
    let resolveFn!: (value: any) => void
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )

    const p1 = newsApi.listSavedArticles()
    const p2 = newsApi.listSavedArticles()
    const p3 = newsApi.listSavedArticles()

    expect(postMock).toHaveBeenCalledTimes(1)

    resolveFn({ data: { ok: true, articles: [{ id: 'a1' }], total: 1 } })
    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    expect(r1).toEqual({ ok: true, articles: [{ id: 'a1' }], total: 1 })
    expect(r2).toEqual(r1)
    expect(r3).toEqual(r1)

    // After settlement, a subsequent call issues a fresh request.
    postMock.mockResolvedValueOnce({ data: { ok: true, articles: [], total: 0 } })
    const r4 = await newsApi.listSavedArticles()
    expect(postMock).toHaveBeenCalledTimes(2)
    expect(r4).toEqual({ ok: true, articles: [], total: 0 })
  })

  it('does not coalesce write commands like saveArticle', async () => {
    postMock.mockResolvedValue({ data: { ok: true, saved: true } })

    await Promise.all([newsApi.saveArticle('a1'), newsApi.saveArticle('a1')])
    expect(postMock).toHaveBeenCalledTimes(2)
  })
})

