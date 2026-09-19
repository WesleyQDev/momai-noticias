import { describe, it, expect } from 'vitest'
import { mapHeadlineItems } from '../src/widgets/services/headlineItems'

describe('headlines widget items', () => {
  it('maps feed articles to compact headline rows', () => {
    const rows = mapHeadlineItems([
      { id: 'a', title: 'Title A', url: 'https://x/a', sourceName: 'Source', image: 'img', publishedAt: 10 }
    ])
    expect(rows[0]).toMatchObject({
      id: 'a',
      title: 'Title A',
      source: 'Source',
      image: 'img',
      publishedAt: 10,
      url: 'https://x/a'
    })
    expect(rows[0].article).toBeDefined()
    expect(rows[0].article?.id).toBe('a')
    expect(rows[0].article?.url).toBe('https://x/a')
  })

  it('drops articles without id or title', () => {
    expect(mapHeadlineItems([{} as any, { id: 'a' } as any])).toEqual([])
  })
})
