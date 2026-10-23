// src/services/market-ticker.ts
// Handles market financial quotes (Dollar, Euro, Ibovespa, Bitcoin) and ticker item generation
import type { NewsArticle } from './types'

export interface MarketQuote {
  symbol: string
  label: string
  price: string
  changePercent: number
  direction: 'up' | 'down' | 'neutral'
}

export interface TickerItem {
  id: string
  type: 'quote' | 'urgent_news' | 'poll' | 'headline'
  label: string
  text: string
  value?: string
  direction?: 'up' | 'down' | 'neutral'
  url?: string
  articleId?: string
  article?: NewsArticle
}

export interface TickerResponse {
  ok: boolean
  items: TickerItem[]
  updatedAt: number
  error?: string
}

const QUOTES_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let quotesCache: { quotes: MarketQuote[]; timestamp: number } | null = null

export function resetMarketCacheForTesting(): void {
  quotesCache = null
}

const POLL_KEYWORDS = [
  'pesquisa eleitoral',
  'pesquisa',
  'datafolha',
  'quaest',
  'ipec',
  'paraná pesquisas',
  'atlasintel',
  'eleição',
  'eleições',
  'eleitoral',
  'intenção de voto',
  'intenções de voto'
]

const URGENT_KEYWORDS = [
  'urgente',
  'plantão',
  'atenção',
  'agora:',
  'stf',
  'banco central',
  'selic',
  'copom',
  'inflação',
  'ipca',
  'alerta',
  'guerra'
]

/**
 * Fetches real-time financial market quotes from AwesomeAPI and Brapi with memory caching.
 */
export async function fetchMarketQuotes(timeoutMs = 5000): Promise<MarketQuote[]> {
  if (quotesCache && Date.now() - quotesCache.timestamp < QUOTES_CACHE_TTL_MS) {
    return quotesCache.quotes
  }

  const quotes: MarketQuote[] = []

  // 1. AwesomeAPI (USD, EUR, BTC)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL', {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = (await res.json()) as Record<string, any>

      if (data.USDBRL) {
        const bid = Number(data.USDBRL.bid)
        const pct = Number(data.USDBRL.pctChange)
        quotes.push({
          symbol: 'USDBRL',
          label: 'DÓLAR',
          price: `R$ ${bid.toFixed(2).replace('.', ',')}`,
          changePercent: pct,
          direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
        })
      }

      if (data.EURBRL) {
        const bid = Number(data.EURBRL.bid)
        const pct = Number(data.EURBRL.pctChange)
        quotes.push({
          symbol: 'EURBRL',
          label: 'EURO',
          price: `R$ ${bid.toFixed(2).replace('.', ',')}`,
          changePercent: pct,
          direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
        })
      }

      if (data.BTCBRL) {
        const bid = Number(data.BTCBRL.bid)
        const pct = Number(data.BTCBRL.pctChange)
        quotes.push({
          symbol: 'BTCBRL',
          label: 'BITCOIN',
          price: `R$ ${Math.round(bid).toLocaleString('pt-BR')}`,
          changePercent: pct,
          direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
        })
      }
    }
  } catch (err: any) {
    // Graceful fallback: network error or disabled in tests
  }

  // 2. Brapi (Ibovespa ^BVSP)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 4000))
    const res = await fetch('https://brapi.dev/api/quote/%5EBVSP', {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (res.ok) {
      const data = (await res.json()) as any
      const item = data?.results?.[0]
      if (item && item.regularMarketPrice) {
        const price = Number(item.regularMarketPrice)
        const pct = Number(item.regularMarketChangePercent || 0)
        quotes.push({
          symbol: 'IBOVESPA',
          label: 'IBOVESPA',
          price: `${Math.round(price).toLocaleString('pt-BR')} pts`,
          changePercent: pct,
          direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
        })
      }
    }
  } catch {
    // Non-fatal if Brapi times out or is blocked
  }

  if (quotes.length > 0) {
    quotesCache = { quotes, timestamp: Date.now() }
  } else if (quotesCache) {
    return quotesCache.quotes
  }

  return quotes
}

const KNOWN_INSTITUTES = [
  'Datafolha',
  'Quaest',
  'Ipec',
  'Paraná Pesquisas',
  'AtlasIntel',
  'Atlas',
  'Real Time Big Data',
  'Futura',
  'PoderData',
  'CNT/MDA',
  'MDA',
  'Ipespe'
]

export function extractPollInstitute(text: string, fallbackSource?: string): string {
  for (const inst of KNOWN_INSTITUTES) {
    const regex = new RegExp(`\\b${inst.replace('/', '\\/')}\\b`, 'i')
    if (regex.test(text)) {
      return inst.toUpperCase()
    }
  }
  return (fallbackSource || 'PESQUISA').toUpperCase()
}

/**
 * Summarizes an election poll article down to only the institute/source and poll values.
 * E.g. "DATAFOLHA: NUNES 51% X 40% BOULOS", "QUAEST: 48% X 42%", "IPEC: 54%"
 */
export function summarizePollHeadline(article: NewsArticle): string {
  const fullText = `${article.title} ${article.summary || ''}`
  const institute = extractPollInstitute(fullText, article.sourceName)

  // 1. Candidate names + % comparison: "Candidato A 51% e Candidato B 40%"
  const candidateMatch = fullText.match(
    /\b([A-ZÀ-Ú][a-zà-ú]{2,})\s*(?:\([^\)]*\)\s*)?(?:tem\s+|com\s+|lidera com\s+)?(\d{1,2}(?:[.,]\d+)?%)\s*(?:,|e|x|a|contra)\s*([A-ZÀ-Ú][a-zà-ú]{2,})\s*(?:\([^\)]*\)\s*)?(?:tem\s+|com\s+)?(\d{1,2}(?:[.,]\d+)?%)/i
  )

  if (candidateMatch) {
    const [, c1, p1, c2, p2] = candidateMatch
    const stopWords = ['pesquisa', 'nova', 'segundo', 'diz', 'entre', 'aponta', 'mostra', 'para', 'com', 'nesta', 'neste']
    if (!stopWords.includes(c1.toLowerCase()) && !stopWords.includes(c2.toLowerCase())) {
      return `${institute}: ${c1.toUpperCase()} ${p1} X ${c2.toUpperCase()} ${p2}`
    }
  }

  // 2. Direct comparison: "51% a 40%" or "48% x 42%"
  const directComparison = fullText.match(/(\d{1,2}(?:[.,]\d+)?%)\s*(?:x|a|contra|e)\s*(\d{1,2}(?:[.,]\d+)?%)/i)
  if (directComparison) {
    return `${institute}: ${directComparison[1]} X ${directComparison[2]}`
  }

  // 3. Any percentages in title or summary
  const allPercentages = article.title.match(/\d{1,2}(?:[.,]\d+)?%/g) || article.summary?.match(/\d{1,2}(?:[.,]\d+)?%/g)
  if (allPercentages && allPercentages.length >= 2) {
    return `${institute}: ${allPercentages[0]} X ${allPercentages[1]}`
  } else if (allPercentages && allPercentages.length === 1) {
    return `${institute}: ${allPercentages[0]}`
  }

  // 4. Fallback if no percentages present: concise title with source
  const cleanedTitle = article.title
    .replace(/^(?:pesquisa\s+)?(?:datafolha|quaest|ipec|atlasintel|atlas|paraná pesquisas|poderdata)[:\s-]*/i, '')
    .trim()
  return `${institute}: ${cleanedTitle}`
}

/**
 * Extracts news items for the ticker (election polls, breaking news, recent top headlines).
 */
export function extractTickerArticles(
  allArticles: NewsArticle[],
  allowedTypes: string[] = ['quotes', 'polls', 'urgent', 'headlines']
): TickerItem[] {
  if (!Array.isArray(allArticles) || allArticles.length === 0) {
    return []
  }

  const items: TickerItem[] = []
  const usedIds = new Set<string>()

  const sortedArticles = [...allArticles].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))

  // 1. Search for Poll / Election articles (summarized with institute + values)
  if (allowedTypes.includes('polls')) {
    for (const article of sortedArticles) {
      if (items.filter((i) => i.type === 'poll').length >= 2) break
      const textToCheck = `${article.title} ${article.summary || ''}`.toLowerCase()
      const isPoll = POLL_KEYWORDS.some((kw) => textToCheck.includes(kw))
      if (isPoll && !usedIds.has(article.id)) {
        usedIds.add(article.id)
        const pollText = summarizePollHeadline(article)
        items.push({
          id: `poll-${article.id}`,
          type: 'poll',
          label: 'PESQUISA',
          text: pollText,
          url: article.url,
          articleId: article.id,
          article
        })
      }
    }
  }

  // 2. Search for Urgent / Breaking articles
  if (allowedTypes.includes('urgent')) {
    for (const article of sortedArticles) {
      if (items.filter((i) => i.type === 'urgent_news').length >= 3) break
      if (usedIds.has(article.id)) continue

      const textToCheck = `${article.title} ${article.summary || ''}`.toLowerCase()
      const isUrgent = URGENT_KEYWORDS.some((kw) => textToCheck.includes(kw))
      if (isUrgent) {
        usedIds.add(article.id)
        items.push({
          id: `urgent-${article.id}`,
          type: 'urgent_news',
          label: 'URGENTE',
          text: article.title,
          url: article.url,
          articleId: article.id,
          article
        })
      }
    }
  }

  // 3. Fallback / Top headlines if urgent count is low
  if (allowedTypes.includes('headlines')) {
    for (const article of sortedArticles) {
      if (items.length >= 6) break
      if (usedIds.has(article.id)) continue

      usedIds.add(article.id)
      items.push({
        id: `headline-${article.id}`,
        type: 'headline',
        label: 'DESTAQUE',
        text: article.title,
        url: article.url,
        articleId: article.id,
        article
      })
    }
  }

  return items
}

/**
 * Combines market quotes and news articles into an alternating ticker list.
 */
export function buildTickerFeed(quotes: MarketQuote[], newsItems: TickerItem[]): TickerItem[] {
  const result: TickerItem[] = []

  const quoteItems: TickerItem[] = quotes.map((q) => {
    const sign = q.changePercent > 0 ? '+' : ''
    const valStr = `${q.price} (${sign}${q.changePercent.toFixed(2)}%)`
    return {
      id: `quote-${q.symbol}`,
      type: 'quote',
      label: q.label,
      text: q.label,
      value: valStr,
      direction: q.direction
    }
  })

  // Alternate: Quote -> News -> Quote -> News ...
  const maxLen = Math.max(quoteItems.length, newsItems.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < quoteItems.length) result.push(quoteItems[i])
    if (i < newsItems.length) result.push(newsItems[i])
  }

  return result
}
