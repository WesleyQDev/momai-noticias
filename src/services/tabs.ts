// src/services/tabs.ts
// Helpers for the header tab navigation. "Saved" is a temporary view: clicking
// it again while it is already open should return to the section the user came
// from instead of leaving the button without any effect.

export const DEFAULT_FEED_TAB = 'paravoce'
export const SAVED_TAB = 'saved'

export interface TabChange {
  tab: string
  lastFeedTab: string
}

/** Legacy "geral" alias maps to the main For You feed. */
export function normalizeTab(tab: string): string {
  return tab === 'geral' ? DEFAULT_FEED_TAB : tab
}

/**
 * Resolves the next active tab and the feed tab to remember for the next
 * "saved" toggle. The remembered tab is never "saved" itself.
 */
export function resolveTabChange(
  currentTab: string,
  requestedTab: string,
  lastFeedTab: string = DEFAULT_FEED_TAB
): TabChange {
  const current = normalizeTab(currentTab)
  const requested = normalizeTab(requestedTab)
  const previousFeedTab =
    current !== SAVED_TAB
      ? current
      : lastFeedTab && lastFeedTab !== SAVED_TAB
        ? normalizeTab(lastFeedTab)
        : DEFAULT_FEED_TAB

  if (requested === SAVED_TAB) {
    // Second click on the saved button: back to the previous section.
    if (current === SAVED_TAB) {
      return { tab: previousFeedTab, lastFeedTab: previousFeedTab }
    }
    return { tab: SAVED_TAB, lastFeedTab: previousFeedTab }
  }

  return { tab: requested, lastFeedTab: requested }
}
