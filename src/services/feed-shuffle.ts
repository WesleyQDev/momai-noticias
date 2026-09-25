// src/services/feed-shuffle.ts
// Seeded shuffling keeps the feed varied across refreshes while staying
// deterministic for a given seed, so pagination snapshots remain stable.

export function hashStringToSeed(value: string): number {
  let hash = 2166136261
  const text = String(value ?? '')
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string | number): T[] {
  const result = [...items]
  const numericSeed = typeof seed === 'number' ? seed >>> 0 : hashStringToSeed(String(seed))
  const random = mulberry32(numericSeed)
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

export function resolveFeedSeed(options: { seed?: string | number; refresh?: boolean; now?: number } = {}): string {
  if (options.seed !== undefined && String(options.seed).length > 0) return String(options.seed)
  const now = typeof options.now === 'number' ? options.now : Date.now()
  if (options.refresh) return `refresh-${now}`
  const day = new Date(now).toISOString().slice(0, 10)
  return `day-${day}`
}

export function shouldReuseSession(options: { refresh?: boolean; cursor?: string } = {}): boolean {
  if (options.refresh) return false
  return Boolean(options.cursor)
}
