// src/services/feed-parser.ts
import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import type { NewsArticle, FeedSource } from './types'
import { classifyTextToTopics } from './categories.ts'

export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return ''
  try {
    const parsed = new URL(rawUrl.trim())
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', '_ga', '_gl', 'ref'
    ]
    for (const param of trackingParams) {
      parsed.searchParams.delete(param)
    }
    let clean = parsed.toString()
    if (clean.endsWith('?')) clean = clean.slice(0, -1)
    return clean
  } catch {
    return rawUrl.trim()
  }
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&atilde;': 'ã',
  '&Atilde;': 'Ã',
  '&ccedil;': 'ç',
  '&Ccedil;': 'Ç',
  '&eacute;': 'é',
  '&Eacute;': 'É',
  '&aacute;': 'á',
  '&Aacute;': 'Á',
  '&iacute;': 'í',
  '&Iacute;': 'Í',
  '&oacute;': 'ó',
  '&Oacute;': 'Ó',
  '&uacute;': 'ú',
  '&Uacute;': 'Ú',
  '&acirc;': 'â',
  '&Acirc;': 'Â',
  '&ecirc;': 'ê',
  '&Ecirc;': 'Ê',
  '&icirc;': 'î',
  '&Icirc;': 'Î',
  '&ocirc;': 'ô',
  '&Ocirc;': 'Ô',
  '&ucirc;': 'û',
  '&Ucirc;': 'Û',
  '&otilde;': 'õ',
  '&Otilde;': 'Õ',
  '&agrave;': 'à',
  '&Agrave;': 'À',
  '&ordm;': 'º',
  '&ordf;': 'ª',
  '&bull;': '•',
  '&hellip;': '...',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”'
}

export function stripHtml(htmlStr: string): string {
  if (!htmlStr || typeof htmlStr !== 'string') return ''
  let clean = htmlStr
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')

  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    clean = clean.split(entity).join(replacement)
  }

  // Handle decimal &#227; and hex &#xE3; entities
  clean = clean
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCharCode(parseInt(dec, 10)) } catch { return '' }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)) } catch { return '' }
    })
    .replace(/\s+/g, ' ')
    .trim()

  return clean
}

import { upgradeImageUrl } from './image-utils.ts'
export { upgradeImageUrl }

export function extractMediaImage(
  mediaContent: any,
  mediaThumbnail: any,
  enclosure: any,
  rawSummary: string
): string | undefined {
  // 1. media:content (array or single object)
  if (mediaContent) {
    const list = Array.isArray(mediaContent) ? mediaContent : [mediaContent]
    const imageItems = list.filter((m: any) => {
      const type = String(m?.['@_type'] || '')
      const medium = String(m?.['@_medium'] || '')
      const url = extractStringValue(m?.['@_url'] || m?.['#text'] || '')
      if (!url) return false
      if (medium === 'video' || medium === 'audio') return false
      if (type.startsWith('video/') || type.startsWith('audio/')) return false
      return true
    })
    if (imageItems.length > 0) {
      imageItems.sort((a: any, b: any) => {
        const wA = parseInt(a?.['@_width'] || '0', 10) || 0
        const wB = parseInt(b?.['@_width'] || '0', 10) || 0
        return wB - wA
      })
      const url = extractStringValue(imageItems[0]?.['@_url'] || imageItems[0]?.['#text'] || '')
      if (url) {
        const upgraded = upgradeImageUrl(url)
        if (upgraded) return upgraded
      }
    }
  }

  // 2. enclosure
  if (enclosure) {
    const list = Array.isArray(enclosure) ? enclosure : [enclosure]
    const imageEnclosure = list.find((e: any) => {
      const type = String(e?.['@_type'] || '')
      const url = extractStringValue(e?.['@_url'] || '')
      return type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(url)
    })
    if (imageEnclosure) {
      const url = extractStringValue(imageEnclosure['@_url'] || imageEnclosure['#text'] || '')
      if (url) {
        const upgraded = upgradeImageUrl(url)
        if (upgraded) return upgraded
      }
    }
  }

  // 3. media:thumbnail
  if (mediaThumbnail) {
    const list = Array.isArray(mediaThumbnail) ? mediaThumbnail : [mediaThumbnail]
    list.sort((a: any, b: any) => {
      const wA = parseInt(a?.['@_width'] || '0', 10) || 0
      const wB = parseInt(b?.['@_width'] || '0', 10) || 0
      return wB - wA
    })
    const url = extractStringValue(list[0]?.['@_url'] || list[0]?.['#text'] || '')
    if (url) {
      const upgraded = upgradeImageUrl(url)
      if (upgraded) return upgraded
    }
  }

  // 4. HTML description / content
  const htmlImg = extractImageFromHtml(rawSummary)
  if (htmlImg) {
    const upgraded = upgradeImageUrl(htmlImg)
    if (upgraded) return upgraded
  }

  return undefined
}

export function extractImageFromHtml(htmlStr: string): string | undefined {
  if (!htmlStr || typeof htmlStr !== 'string') return undefined
  const match = htmlStr.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (match && match[1]) {
    const url = match[1].trim()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
  }
  return undefined
}

function parseDateToTimestamp(rawDate: any): number {
  if (!rawDate) return Date.now()
  const d = new Date(rawDate)
  const time = d.getTime()
  return isNaN(time) ? Date.now() : time
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  cdataPropName: '__cdata',
  processEntities: {
    enabled: true,
    maxEntitySize: 50000,
    maxExpansionDepth: 10,
    maxTotalExpansions: 10000,
    maxExpandedLength: 500000
  }
})

export function decodeFeedBuffer(buffer: Buffer, contentType = ''): string {
  let isIso = /charset\s*=\s*(iso-8859-1|latin1|windows-1252)/i.test(contentType)
  if (!isIso) {
    const startStr = buffer.subarray(0, 150).toString('ascii')
    if (/encoding\s*=\s*["'](iso-8859-1|latin1|windows-1252)["']/i.test(startStr)) {
      isIso = true
    }
  }

  let xml = isIso
    ? new TextDecoder('iso-8859-1').decode(buffer)
    : new TextDecoder('utf-8').decode(buffer)

  // Fallback if UTF-8 decode produced replacement characters
  if (xml.includes('\uFFFD') && !isIso) {
    try {
      const fallback = new TextDecoder('iso-8859-1').decode(buffer)
      if (!fallback.includes('\uFFFD')) {
        xml = fallback
      }
    } catch {}
  }

  return xml
}

export function extractStringValue(val: any): string {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    if (val.__cdata !== undefined) return extractStringValue(val.__cdata)
    if (val['#text'] !== undefined) return extractStringValue(val['#text'])
    if (val.name !== undefined) return extractStringValue(val.name)
    if (val.title !== undefined) return extractStringValue(val.title)
  }
  return String(val)
}

// A base64 prefix of the guid is shared by every article of the same site
// (e.g. all https://g1.globo.com/... URLs), which collapsed each feed into a
// single cache entry. A digest of the full guid keeps ids unique and stable.
function buildArticleId(guid: string, sourceId?: string): string {
  const digest = createHash('sha256').update(guid).digest('hex').slice(0, 24)
  return `${sourceId || 'src'}-${digest}`
}

export function parseFeedXml(xmlContent: string, source: Partial<FeedSource>): NewsArticle[] {
  if (!xmlContent || typeof xmlContent !== 'string') return []

  const parsed = xmlParser.parse(xmlContent)
  const articles: NewsArticle[] = []

  // Check RSS 2.0 / RSS 0.9 / RSS 1.0
  const channel = parsed?.rss?.channel || parsed?.rdf?.channel || parsed?.channel
  if (channel) {
    const rawItems = channel.item || parsed?.['rdf:RDF']?.item || []
    const items = Array.isArray(rawItems) ? rawItems : [rawItems]

    for (const item of items) {
      if (!item) continue

      const rawTitle = extractStringValue(item.title)
      const title = stripHtml(rawTitle)
      if (!title) continue

      let rawUrl = item.link
      if (typeof rawUrl === 'object') {
        rawUrl = rawUrl?.['@_href'] || rawUrl?.__cdata || rawUrl?.['#text'] || ''
      }
      const url = sanitizeUrl(extractStringValue(rawUrl))
      if (!url) continue

      const rawSummary = extractStringValue(item.description || item['content:encoded'] || '')
      const summary = stripHtml(rawSummary).slice(0, 320)

      // Media / Image detection
      const image = extractMediaImage(item['media:content'], item['media:thumbnail'], item.enclosure, rawSummary)

      // Categories
      const rawCategories = item.category ? (Array.isArray(item.category) ? item.category : [item.category]) : []
      const categories = rawCategories.map((c: any) => extractStringValue(c)).filter(Boolean)

      const publishedAt = parseDateToTimestamp(item.pubDate || item['dc:date'] || item.date)
      const guid = extractStringValue(item.guid || url)

      const canonicalTopics = classifyTextToTopics(title, summary, categories, source.topics)

      const rawAuthor = extractStringValue(item['dc:creator'] || item.author?.name || item.author)
      const sourceTitle = extractStringValue(source.title || channel.title || 'Notícias')

      articles.push({
        id: buildArticleId(guid, source.id),
        title,
        url,
        summary,
        image,
        publishedAt,
        categories,
        canonicalTopics,
        sourceId: source.id || 'custom',
        sourceName: sourceTitle,
        language: source.language || 'pt-BR',
        author: rawAuthor || undefined
      })
    }
  }

  // Check Atom Feed
  const feed = parsed?.feed
  if (feed) {
    const rawEntries = feed.entry || []
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries]

    for (const entry of entries) {
      if (!entry) continue

      const rawTitle = extractStringValue(entry.title)
      const title = stripHtml(rawTitle)
      if (!title) continue

      let rawUrl = ''
      if (Array.isArray(entry.link)) {
        const alt = entry.link.find((l: any) => l?.['@_rel'] === 'alternate') || entry.link[0]
        rawUrl = alt?.['@_href'] || alt?.['#text'] || alt?.__cdata || ''
      } else if (typeof entry.link === 'object') {
        rawUrl = entry.link?.['@_href'] || entry.link?.['#text'] || entry.link?.__cdata || ''
      } else {
        rawUrl = String(entry.link || '')
      }
      const url = sanitizeUrl(extractStringValue(rawUrl))
      if (!url) continue

      const rawSummary = extractStringValue(entry.summary || entry.content || '')
      const summary = stripHtml(rawSummary).slice(0, 320)

      const image = extractMediaImage(entry['media:content'], entry['media:thumbnail'], entry.enclosure || entry.link, rawSummary)

      const rawCats = entry.category ? (Array.isArray(entry.category) ? entry.category : [entry.category]) : []
      const categories = rawCats.map((c: any) => extractStringValue(c?.['@_term'] || c?.['@_label'] || c)).filter(Boolean)

      const publishedAt = parseDateToTimestamp(entry.published || entry.updated)
      const guid = extractStringValue(entry.id || url)

      const canonicalTopics = classifyTextToTopics(title, summary, categories, source.topics)
      const rawAuthor = extractStringValue(entry.author?.name || entry.author)
      const feedTitle = extractStringValue(source.title || feed.title || 'Notícias')

      articles.push({
        id: buildArticleId(guid, source.id),
        title,
        url,
        summary,
        image,
        publishedAt,
        categories,
        canonicalTopics,
        sourceId: source.id || 'custom',
        sourceName: feedTitle,
        language: source.language || 'pt-BR',
        author: rawAuthor || undefined
      })
    }
  }

  return articles
}
