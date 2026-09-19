// src/services/discovery.ts

export interface DiscoveredFeed {
  feedUrl: string
  title?: string
  type: 'rss' | 'atom'
}

export function extractFeedUrlsFromHtml(html: string, baseUrl: string): DiscoveredFeed[] {
  if (!html || typeof html !== 'string') return []
  const feeds: DiscoveredFeed[] = []

  const linkRegex = /<link\s+[^>]*rel=["']alternate["'][^>]*>/gi
  const matches = html.match(linkRegex) || []

  for (const match of matches) {
    const isRss = /type=["']application\/rss\+xml["']/i.test(match)
    const isAtom = /type=["']application\/atom\+xml["']/i.test(match)

    if (isRss || isAtom) {
      const hrefMatch = match.match(/href=["']([^"']+)["']/i)
      const titleMatch = match.match(/title=["']([^"']+)["']/i)

      if (hrefMatch && hrefMatch[1]) {
        try {
          const resolvedUrl = new URL(hrefMatch[1], baseUrl).toString()
          feeds.push({
            feedUrl: resolvedUrl,
            title: titleMatch ? titleMatch[1] : undefined,
            type: isAtom ? 'atom' : 'rss'
          })
        } catch {}
      }
    }
  }

  return feeds
}

export const COMMON_FEED_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/rss.xml',
  '/atom.xml',
  '/feed.xml',
  '/?feed=rss2',
  '/index.xml'
]
