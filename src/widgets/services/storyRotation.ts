import type { HeadlineRow } from './headlineItems'
import { shuffleWithSeed } from '../../services/feed-shuffle'

export interface StoryPick {
  story: HeadlineRow | null
  remaining: HeadlineRow[]
}

/**
 * Puts stories that carry a photo first, keeping the ranking order inside
 * each group: the widget is meant to always show an illustrated story, and
 * only falls back to a plain one when nothing has an image.
 */
export function orderStoriesByPhoto(rows: HeadlineRow[], seed?: string | number): HeadlineRow[] {
  const withPhoto: HeadlineRow[] = []
  const withoutPhoto: HeadlineRow[] = []
  for (const row of rows) {
    if (row.image) withPhoto.push(row)
    else withoutPhoto.push(row)
  }
  if (seed !== undefined && String(seed).length > 0) {
    return [
      ...shuffleWithSeed(withPhoto, `${String(seed)}:photo`),
      ...shuffleWithSeed(withoutPhoto, `${String(seed)}:plain`)
    ]
  }
  return [...withPhoto, ...withoutPhoto]
}

/**
 * Takes the next story for display, skipping the one already on screen so
 * consecutive turns never repeat it. The taken story leaves `remaining`,
 * which makes the queue advance exactly one item per turn.
 */
export function pickNextStory(rows: HeadlineRow[], currentId: string | null): StoryPick {
  const index = rows.findIndex((row) => row.id !== currentId)
  if (index === -1) return { story: null, remaining: rows }
  return {
    story: rows[index],
    remaining: rows.filter((_, position) => position !== index)
  }
}
