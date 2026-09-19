import { describe, it, expect } from 'vitest'
import { resolveStoryLayout, resolveThumbWidth } from '../src/widgets/services/storyLayout'

describe('headlines widget responsive layout', () => {
  it('lays out side by side when the widget is wide, whatever the size preset', () => {
    expect(resolveStoryLayout(330, 130)).toBe('row')
    expect(resolveStoryLayout(660, 400)).toBe('row')
  })

  it('stacks photo over text on square, tall or narrow widgets', () => {
    expect(resolveStoryLayout(330, 260)).toBe('stack')
    expect(resolveStoryLayout(200, 200)).toBe('stack')
    expect(resolveStoryLayout(160, 130)).toBe('stack')
  })

  it('falls back to the stacked layout before it can measure the container', () => {
    expect(resolveStoryLayout(0, 0)).toBe('stack')
    expect(resolveStoryLayout(Number.NaN, 200)).toBe('stack')
  })

  it('scales the thumbnail with the container but keeps it usable', () => {
    expect(resolveThumbWidth(330)).toBe(99)
    expect(resolveThumbWidth(160)).toBe(88)
    expect(resolveThumbWidth(1400)).toBe(160)
  })
})
