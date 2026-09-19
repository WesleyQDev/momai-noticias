// src/services/feed-scroll.ts
// Scrolls the feed container back to the top after the visible page changes,
// so pagination controls at the bottom never leave the user stuck below the fold.

export function scrollFeedToTop(container: HTMLElement | null | undefined): void {
  if (!container) return
  try {
    container.scrollTo({ top: 0 })
  } catch {
    try {
      container.scrollTop = 0
    } catch {
      // No scrollable container available; the new page still renders.
    }
  }
}
