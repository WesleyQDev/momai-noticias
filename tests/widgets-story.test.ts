import { describe, it, expect } from 'vitest'
import { orderStoriesByPhoto, pickNextStory } from '../src/widgets/services/storyRotation'
import type { HeadlineRow } from '../src/widgets/services/headlineItems'

function story(id: string, image?: string): HeadlineRow {
  return { id, title: `Title ${id}`, source: 'Source', image, publishedAt: 10 }
}

describe('headlines widget story rotation', () => {
  it('keeps stories that carry a photo ahead of the others', () => {
    const rows = [story('a'), story('b', 'photo-b'), story('c', 'photo-c')]

    expect(orderStoriesByPhoto(rows).map((row) => row.id)).toEqual(['b', 'c', 'a'])
  })

  it('takes the first story when nothing is on screen and consumes it', () => {
    const rows = [story('a', 'photo-a'), story('b', 'photo-b')]

    const pick = pickNextStory(rows, null)

    expect(pick.story?.id).toBe('a')
    expect(pick.remaining.map((row) => row.id)).toEqual(['b'])
  })

  it('never hands back the story already on screen', () => {
    const rows = [story('a', 'photo-a'), story('b', 'photo-b')]

    expect(pickNextStory(rows, 'a').story?.id).toBe('b')
  })

  it('reports an empty pick when the only story is the current one', () => {
    const pick = pickNextStory([story('a', 'photo-a')], 'a')

    expect(pick.story).toBeNull()
    expect(pick.remaining.map((row) => row.id)).toEqual(['a'])
  })

  it('prefers a story with a photo even when the current one has none', () => {
    const pick = pickNextStory([story('plain'), story('photo', 'img')], 'plain')

    expect(pick.story?.id).toBe('photo')
  })
})
