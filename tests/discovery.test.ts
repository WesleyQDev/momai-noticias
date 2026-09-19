import { describe, it, expect } from 'vitest'
import { extractFeedUrlsFromHtml } from '../src/services/discovery'

describe('Feed Discovery', () => {
  it('should find RSS link in HTML head', () => {
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Meu Blog</title>
        <link rel="alternate" type="application/rss+xml" title="Feed RSS do Meu Blog" href="/feed.xml" />
      </head>
      <body><h1>Olá</h1></body>
    </html>`

    const feeds = extractFeedUrlsFromHtml(html, 'https://meublog.com.br')
    expect(feeds).toHaveLength(1)
    expect(feeds[0].feedUrl).toBe('https://meublog.com.br/feed.xml')
    expect(feeds[0].type).toBe('rss')
    expect(feeds[0].title).toBe('Feed RSS do Meu Blog')
  })

  it('should find Atom link in HTML head with full URL', () => {
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <link rel="alternate" type="application/atom+xml" href="https://site.org/atom.xml" />
      </head>
    </html>`

    const feeds = extractFeedUrlsFromHtml(html, 'https://site.org')
    expect(feeds).toHaveLength(1)
    expect(feeds[0].feedUrl).toBe('https://site.org/atom.xml')
    expect(feeds[0].type).toBe('atom')
  })
})
