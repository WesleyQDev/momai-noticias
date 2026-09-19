import { upgradeImageUrl } from '../../services/image-utils'
import type { CanonicalTopic, NewsArticle } from '../../services/types'

export interface HeadlineRow {
  id: string
  title: string
  source: string
  image?: string
  publishedAt: number
  url?: string
  summary?: string
  categories?: string[]
  canonicalTopics?: CanonicalTopic[]
  sourceId?: string
  sourceName?: string
  language?: string
  article?: NewsArticle
}

interface FeedArticleShape {
  id?: unknown
  title?: unknown
  url?: unknown
  summary?: unknown
  sourceId?: unknown
  sourceName?: unknown
  image?: unknown
  publishedAt?: unknown
  categories?: unknown
  canonicalTopics?: unknown
  language?: unknown
  author?: unknown
  score?: unknown
}

/**
 * Maps ranked feed articles to compact widget rows.
 * Drops anything without an id and title so the list never
 * shows a blank row.
 */
export function mapHeadlineItems(articles: FeedArticleShape[]): HeadlineRow[] {
  const rows: HeadlineRow[] = []
  for (const article of articles) {
    if (!article || typeof article !== 'object') continue
    const id = String(article.id ?? '')
    const title = String(article.title ?? '').trim()
    if (id === '' || title === '') continue
    const rawImage = article.image ? String(article.image) : undefined
    const cleanImage = rawImage ? (upgradeImageUrl(rawImage) || rawImage) : undefined

    const fullArticle: NewsArticle = {
      id,
      title,
      url: String(article.url ?? ''),
      summary: String(article.summary ?? ''),
      image: cleanImage,
      publishedAt: Number(article.publishedAt ?? 0),
      categories: Array.isArray(article.categories) ? (article.categories as string[]) : [],
      canonicalTopics: Array.isArray(article.canonicalTopics)
        ? (article.canonicalTopics as CanonicalTopic[])
        : ['geral'],
      sourceId: String(article.sourceId ?? ''),
      sourceName: String(article.sourceName ?? ''),
      language: String(article.language ?? 'pt-BR'),
      author: article.author ? String(article.author) : undefined,
      score: typeof article.score === 'number' ? article.score : undefined
    }

    rows.push({
      id,
      title,
      source: String(article.sourceName ?? ''),
      image: cleanImage,
      publishedAt: Number(article.publishedAt ?? 0),
      url: fullArticle.url,
      summary: fullArticle.summary,
      categories: fullArticle.categories,
      canonicalTopics: fullArticle.canonicalTopics,
      sourceId: fullArticle.sourceId,
      sourceName: fullArticle.sourceName,
      language: fullArticle.language,
      article: fullArticle
    })
  }
  return rows
}

