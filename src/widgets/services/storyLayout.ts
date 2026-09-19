export type StoryLayoutMode = 'row' | 'stack'

const ROW_ASPECT_RATIO = 1.5
const MIN_ROW_WIDTH = 220
const MIN_THUMB_WIDTH = 88
const MAX_THUMB_WIDTH = 160
const THUMB_WIDTH_RATIO = 0.3

/**
 * Chooses how the story card fills its box: side-by-side when the container
 * is wide (thumbnail left, text right), stacked otherwise. Measured from the
 * real widget box, so it holds for the size presets and for user resizes
 * alike.
 */
export function resolveStoryLayout(width: number, height: number): StoryLayoutMode {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'stack'
  }
  if (width < MIN_ROW_WIDTH) return 'stack'
  return width / height >= ROW_ASPECT_RATIO ? 'row' : 'stack'
}

/** Thumbnail width for the side-by-side layout, scaled but always readable. */
export function resolveThumbWidth(width: number): number {
  const scaled = Number.isFinite(width) && width > 0 ? width * THUMB_WIDTH_RATIO : MIN_THUMB_WIDTH
  return Math.round(Math.min(MAX_THUMB_WIDTH, Math.max(MIN_THUMB_WIDTH, scaled)))
}
