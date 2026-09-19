import { describe, it, expect } from 'vitest'
import catalog from '../sources/catalog.json'

describe('Sources Catalog Validation', () => {
  it('should have a valid array of sources', () => {
    expect(Array.isArray(catalog)).toBe(true)
    expect(catalog.length).toBeGreaterThanOrEqual(25)
  })

  it('should validate every source has required fields', () => {
    const ids = new Set<string>()

    for (const source of catalog) {
      expect(source.id).toBeDefined()
      expect(typeof source.id).toBe('string')
      expect(source.id.trim()).not.toBe('')
      expect(ids.has(source.id)).toBe(false) // Unique ID
      ids.add(source.id)

      expect(source.title).toBeDefined()
      expect(typeof source.title).toBe('string')

      expect(source.homepage).toBeDefined()
      expect(source.homepage).toMatch(/^https?:\/\//)

      expect(source.feed).toBeDefined()
      expect(source.feed).toMatch(/^https?:\/\//)

      expect(source.language).toBeDefined()
      expect(['pt-BR', 'en-US', 'es', 'fr', 'de', 'it']).toContain(source.language)

      expect(Array.isArray(source.topics)).toBe(true)
      expect(source.topics.length).toBeGreaterThan(0)
    }
  })
})
