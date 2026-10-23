import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractTickerArticles,
  buildTickerFeed,
  fetchMarketQuotes,
  resetMarketCacheForTesting,
  summarizePollHeadline,
  type MarketQuote
} from '../src/services/market-ticker'
import type { NewsArticle } from '../src/services/types'

describe('market-ticker service', () => {
  beforeEach(() => {
    resetMarketCacheForTesting()
    vi.restoreAllMocks()
  })

  const mockArticles: NewsArticle[] = [
    {
      id: 'art-1',
      title: 'Datafolha: Nunes tem 51% e Boulos tem 40% na disputa pela prefeitura',
      url: 'https://noticias.example/pesquisa',
      summary: 'Datafolha divulga números atualizados da disputa.',
      publishedAt: Date.now() - 3600000,
      categories: ['politica'],
      canonicalTopics: ['politica'],
      sourceId: 'g1',
      sourceName: 'G1',
      language: 'pt-BR'
    },
    {
      id: 'art-2',
      title: 'Urgente: Banco Central eleva taxa Selic para controlar inflação',
      url: 'https://noticias.example/selic',
      summary: 'Copom decide ajuste na taxa básica de juros.',
      publishedAt: Date.now() - 1800000,
      categories: ['economia'],
      canonicalTopics: ['economia'],
      sourceId: 'folha',
      sourceName: 'Folha',
      language: 'pt-BR'
    },
    {
      id: 'art-3',
      title: 'Telescópio James Webb descobre galáxia mais distante já observada',
      url: 'https://noticias.example/astronomia',
      summary: 'Astrônomos comemoram avanço na observação espacial.',
      publishedAt: Date.now() - 7200000,
      categories: ['ciencia'],
      canonicalTopics: ['ciencia'],
      sourceId: 'bbc',
      sourceName: 'BBC Brasil',
      language: 'pt-BR'
    }
  ]

  it('extracts election poll articles and tags them with PESQUISA label with summarized values', () => {
    const items = extractTickerArticles(mockArticles)
    const pollItem = items.find((i) => i.type === 'poll')
    expect(pollItem).toBeDefined()
    expect(pollItem?.label).toBe('PESQUISA')
    expect(pollItem?.text).toBe('DATAFOLHA: NUNES 51% X BOULOS 40%')
    expect(pollItem?.articleId).toBe('art-1')
  })

  it('summarizes various poll headline formats down to institute and percentages', () => {
    const poll1: NewsArticle = {
      id: 'p1',
      title: 'Pesquisa Quaest aponta 48% a 42% no segundo turno',
      url: '',
      summary: '',
      publishedAt: Date.now(),
      categories: [],
      canonicalTopics: ['politica'],
      sourceId: 'uol',
      sourceName: 'UOL',
      language: 'pt-BR'
    }
    expect(summarizePollHeadline(poll1)).toBe('QUAEST: 48% X 42%')

    const poll2: NewsArticle = {
      id: 'p2',
      title: 'Paraná Pesquisas em Curitiba mostra candidato com 54% dos votos válidos',
      url: '',
      summary: '',
      publishedAt: Date.now(),
      categories: [],
      canonicalTopics: ['politica'],
      sourceId: 'g1',
      sourceName: 'G1',
      language: 'pt-BR'
    }
    expect(summarizePollHeadline(poll2)).toBe('PARANÁ PESQUISAS: 54%')
  })

  it('extracts urgent articles and tags them with URGENTE label', () => {
    const items = extractTickerArticles(mockArticles)
    const urgentItem = items.find((i) => i.type === 'urgent_news')
    expect(urgentItem).toBeDefined()
    expect(urgentItem?.label).toBe('URGENTE')
    expect(urgentItem?.text).toContain('Selic')
    expect(urgentItem?.articleId).toBe('art-2')
  })

  it('extracts general headlines when no urgent articles match', () => {
    const plainArticle: NewsArticle = {
      id: 'plain-1',
      title: 'Festival gastronômico reúne chefs no parque da cidade',
      url: 'https://noticias.example/festival',
      summary: 'Evento acontece no próximo final de semana.',
      publishedAt: Date.now(),
      categories: ['cultura'],
      canonicalTopics: ['cultura'],
      sourceId: 'uol',
      sourceName: 'UOL',
      language: 'pt-BR'
    }

    const items = extractTickerArticles([plainArticle])
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('headline')
    expect(items[0].label).toBe('DESTAQUE')
  })

  it('builds an alternating feed of quotes and news items', () => {
    const quotes: MarketQuote[] = [
      {
        symbol: 'USDBRL',
        label: 'DÓLAR',
        price: 'R$ 5,68',
        changePercent: 0.35,
        direction: 'up'
      },
      {
        symbol: 'IBOVESPA',
        label: 'IBOVESPA',
        price: '131.250 pts',
        changePercent: -0.42,
        direction: 'down'
      }
    ]

    const newsItems = extractTickerArticles(mockArticles)
    const feed = buildTickerFeed(quotes, newsItems)

    expect(feed.length).toBeGreaterThanOrEqual(4)
    // First item is quote
    expect(feed[0].type).toBe('quote')
    expect(feed[0].label).toBe('DÓLAR')
    // Second item is news
    expect(feed[1].type).not.toBe('quote')
    // Third item is quote
    expect(feed[2].type).toBe('quote')
    expect(feed[2].label).toBe('IBOVESPA')
  })

  it('fetches market quotes with graceful fallback when network fails or is disabled', async () => {
    // In test environment, fetch is mocked or fails
    const quotes = await fetchMarketQuotes(100)
    expect(Array.isArray(quotes)).toBe(true)
  })

  it('parses AwesomeAPI JSON payload correctly when fetch returns data', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('awesomeapi')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              USDBRL: { bid: '5.682', pctChange: '0.45' },
              EURBRL: { bid: '6.120', pctChange: '-0.20' }
            })
        })
      }
      return Promise.reject(new Error('Network error'))
    })

    vi.stubGlobal('fetch', mockFetch)

    const quotes = await fetchMarketQuotes(500)
    expect(quotes.length).toBeGreaterThanOrEqual(2)
    const dollar = quotes.find((q) => q.symbol === 'USDBRL')
    expect(dollar).toBeDefined()
    expect(dollar?.price).toBe('R$ 5,68')
    expect(dollar?.changePercent).toBe(0.45)
    expect(dollar?.direction).toBe('up')
  })
})
