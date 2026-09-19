import { describe, it, expect } from 'vitest'
import manifest from '../manifest.json'

const collections = ((manifest as any)?.storage?.collections || []) as Array<{
  name?: string
  indexes?: string[]
  unique?: string
}>

describe('Manifest storage contract', () => {
  it('should declare at least one collection', () => {
    expect(Array.isArray(collections)).toBe(true)
    expect(collections.length).toBeGreaterThan(0)
  })

  it('should declare a unique field for every collection (host requires it for upsert)', () => {
    for (const collection of collections) {
      expect(collection.name).toBeTruthy()
      expect(typeof collection.unique).toBe('string')
      expect(String(collection.unique).trim()).not.toBe('')
    }
  })

  it('should index the unique field of every collection', () => {
    for (const collection of collections) {
      expect(Array.isArray(collection.indexes)).toBe(true)
      expect(collection.indexes).toContain(collection.unique)
    }
  })
})
