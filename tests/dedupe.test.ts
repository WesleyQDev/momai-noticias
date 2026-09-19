import { describe, it, expect } from 'vitest'
import { sanitizeUrl } from '../src/services/feed-parser'
import { deduplicateArticles } from '../src/services/ranking'
import type { NewsArticle } from '../src/services/types'

describe('URL Sanitization and Deduplication', () => {
  it('should strip tracking parameters from URLs', () => {
    const raw = 'https://exemplo.com/materia?utm_source=twitter&utm_medium=social&utm_campaign=launch&fbclid=12345&ref=homepage'
    const clean = sanitizeUrl(raw)
    expect(clean).toBe('https://exemplo.com/materia')
  })

  it('should deduplicate articles with identical URLs', () => {
    const articles: NewsArticle[] = [
      {
        id: '1',
        title: 'Título Notícia 1',
        url: 'https://site.com/noticia-1',
        summary: 'Resumo',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['tecnologia'],
        sourceId: 'src1',
        sourceName: 'Fonte 1',
        language: 'pt-BR'
      },
      {
        id: '2',
        title: 'Título Notícia 1 repetida',
        url: 'https://site.com/noticia-1',
        summary: 'Resumo repetido',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['tecnologia'],
        sourceId: 'src1',
        sourceName: 'Fonte 1',
        language: 'pt-BR'
      }
    ]

    const deduped = deduplicateArticles(articles)
    expect(deduped).toHaveLength(1)
  })

  it('should deduplicate articles from different sources with nearly identical titles', () => {
    const articles: NewsArticle[] = [
      {
        id: '1',
        title: 'Governo anuncia novo plano para a economia brasileira',
        url: 'https://fonte1.com/governo-economia',
        summary: 'Resumo 1',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['economia'],
        sourceId: 'fonte1',
        sourceName: 'Fonte 1',
        language: 'pt-BR'
      },
      {
        id: '2',
        title: 'Governo anuncia novo plano para a economia brasileira!',
        url: 'https://fonte2.com/governo-anuncia-plano',
        summary: 'Resumo 2',
        publishedAt: Date.now(),
        categories: [],
        canonicalTopics: ['economia'],
        sourceId: 'fonte2',
        sourceName: 'Fonte 2',
        language: 'pt-BR'
      }
    ]

    const deduped = deduplicateArticles(articles)
    expect(deduped).toHaveLength(1)
  })
})
