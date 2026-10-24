import { describe, it, expect } from 'vitest'
import { resolveTabChange, DEFAULT_FEED_TAB, SAVED_TAB } from '../src/services/tabs'

describe('resolveTabChange', () => {
  it('opens saved and remembers the current section', () => {
    const change = resolveTabChange('tecnologia', 'saved')

    expect(change.tab).toBe(SAVED_TAB)
    expect(change.lastFeedTab).toBe('tecnologia')
  })

  it('goes back to the previous section on the second saved click', () => {
    const first = resolveTabChange('economia', 'saved')
    const second = resolveTabChange(first.tab, 'saved', first.lastFeedTab)

    expect(second.tab).toBe('economia')
    expect(second.lastFeedTab).toBe('economia')
  })

  it('falls back to the main feed when nothing was remembered', () => {
    const change = resolveTabChange(SAVED_TAB, 'saved')

    expect(change.tab).toBe(DEFAULT_FEED_TAB)
  })

  it('keeps the remembered section when moving between feed tabs', () => {
    const change = resolveTabChange('saved', 'ciencia', 'esportes')

    expect(change.tab).toBe('ciencia')
    expect(change.lastFeedTab).toBe('ciencia')
  })

  it('normalizes the legacy general tab', () => {
    const change = resolveTabChange('economia', 'geral')

    expect(change.tab).toBe(DEFAULT_FEED_TAB)
    expect(change.lastFeedTab).toBe(DEFAULT_FEED_TAB)
  })
})
