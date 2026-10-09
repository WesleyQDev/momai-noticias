import { describe, expect, it } from 'vitest'
import { sanitizeUrl } from '../src/services/feed-parser'
import { extractFeedUrlsFromHtml } from '../src/services/discovery'

describe('article URL sanitization', () => {
  it('keeps http/https and strips tracking params', () => {
    expect(sanitizeUrl('https://example.com/post?utm_source=x&id=2')).toBe('https://example.com/post?id=2')
  })

  it('drops non-web protocols from feed links', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
    expect(sanitizeUrl('file:///etc/passwd')).toBe('')
  })
})

describe('feed discovery URL validation', () => {
  it('ignores alternate links that are not web URLs', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
    `
    const feeds = extractFeedUrlsFromHtml(html, 'https://example.com/')
    expect(feeds.map((f) => f.feedUrl)).toEqual(['https://example.com/feed.xml'])
  })
})
