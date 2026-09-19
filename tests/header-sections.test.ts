import { describe, it, expect } from 'vitest'
import { NEWS_SECTIONS } from '../src/services/sections'

describe('News header sections', () => {
  it('keeps For You as the main feed without a redundant General tab', () => {
    const ids = NEWS_SECTIONS.map((section) => section.id)

    expect(ids[0]).toBe('paravoce')
    expect(ids).not.toContain('geral')
  })

  it('keeps the remaining topic sections available', () => {
    const ids = NEWS_SECTIONS.map((section) => section.id)

    expect(ids).toEqual([
      'paravoce',
      'tecnologia',
      'economia',
      'politica',
      'ciencia',
      'esportes',
      'cultura',
      'games',
      'saude',
      'mundo'
    ])
  })
})
