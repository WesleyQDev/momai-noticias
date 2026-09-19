import { describe, it, expect } from 'vitest'
import manifest from '../manifest.json'

describe('noticias widgets manifest', () => {
  it('declares headlines widget for the gallery', () => {
    const widgets = (manifest as any)?.ui?.widgets ?? []
    const types = widgets.map((w: any) => w.type)
    expect(types).toContain('momai-noticias-headlines-widget')
  })

  it('points the headlines entry at a widget bundle', () => {
    const widgets = (manifest as any)?.ui?.widgets ?? []
    const headlines = widgets.find((w: any) => w.type === 'momai-noticias-headlines-widget')
    expect(typeof headlines?.entry).toBe('string')
    expect(headlines.entry.startsWith('dist/widget-')).toBe(true)
  })
})
