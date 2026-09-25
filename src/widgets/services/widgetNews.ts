import { newsApi } from '../../services/api'
import { mapHeadlineItems, type HeadlineRow } from './headlineItems'

/**
 * Reads a batch of ranked headlines through the existing feed service. The
 * widget keeps the batch as a queue so every turn shows a different story
 * without another network round trip.
 */
export async function fetchHeadlineStories(limit = 20, topic?: string, seed?: string): Promise<HeadlineRow[]> {
  const res = await newsApi.getFeed({ limit, ...(topic ? { topic } : {}), ...(seed ? { seed } : {}) })
  const articles: unknown[] = Array.isArray((res as any)?.articles)
    ? (res as any).articles
    : []
  return mapHeadlineItems(articles as any[]).slice(0, limit)
}
