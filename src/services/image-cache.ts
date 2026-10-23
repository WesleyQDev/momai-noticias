// src/services/image-cache.ts
// In-memory set of image URLs successfully decoded in this session.
// Prevents pop-in and re-flicker on tab switches and re-renders.

export const loadedImageUrls = new Set<string>()

export function isImageCached(url?: string): boolean {
  if (!url) return false
  return loadedImageUrls.has(url)
}

export function markImageCached(url?: string): void {
  if (url) loadedImageUrls.add(url)
}
