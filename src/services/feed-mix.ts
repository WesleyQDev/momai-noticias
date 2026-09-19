// src/services/feed-mix.ts
// Monta o feed como um mix: a maior parte do que o usuário já demonstrou gostar
// (personal), uma fatia das fontes que ele segue (variety) e uma cota fixa de
// exploração (explore) para descobrir interesses novos — o mesmo princípio de
// ε-exploração usado em bandits de recomendação de notícias.
import type { NewsArticle, UserProfile } from './types'
import { extractInterestTerms } from './interest-terms.ts'

export type FeedPool = 'personal' | 'variety' | 'explore'

export interface FeedShares {
  personal: number
  variety: number
  explore: number
}

export const DEFAULT_FEED_SHARES: FeedShares = {
  personal: 0.55,
  variety: 0.3,
  explore: 0.15
}

export interface FeedMixOptions {
  pageSize?: number
  shares?: FeedShares
}

export interface FeedMixResult {
  articles: NewsArticle[]
  counts: Record<FeedPool, number>
}

export function hasLearnedAffinity(article: NewsArticle, profile: UserProfile): boolean {
  if ((profile.affinityBySource?.[article.sourceId] || 0) > 0) return true

  for (const topic of article.canonicalTopics || []) {
    if ((profile.affinityByTopic?.[topic] || 0) > 0) return true
  }

  const terms = extractInterestTerms(article.title)
  for (const term of terms) {
    if ((profile.affinityByTerm?.[term] || 0) > 0) return true
  }

  return false
}

// personal: interesse marcado ou afinidade aprendida (fonte, tema ou assunto)
// variety: outra fonte que o usuário segue (amplia dentro do que ele já segue)
// explore: fora do perfil — é a cota que descobre gostos novos
export function classifyFeedPool(article: NewsArticle, profile: UserProfile): FeedPool {
  const interests = new Set(profile.interests || [])
  if ((article.canonicalTopics || []).some((topic) => interests.has(topic))) return 'personal'
  if (hasLearnedAffinity(article, profile)) return 'personal'
  if ((profile.followedSources || []).includes(article.sourceId)) return 'variety'
  return 'explore'
}

// Smooth weighted round-robin: distributes the pools proportionally from the
// very first page, and simply fills with whatever is left when a pool runs dry.
function interleavePools(
  pools: Record<FeedPool, NewsArticle[]>,
  shares: FeedShares,
  pageSize: number
): FeedMixResult {
  const keys: FeedPool[] = ['personal', 'variety', 'explore']
  const totalWeight = Math.max(0.0001, keys.reduce((sum, key) => sum + shares[key], 0))
  const current: Record<FeedPool, number> = { personal: 0, variety: 0, explore: 0 }
  const counts: Record<FeedPool, number> = { personal: 0, variety: 0, explore: 0 }
  const articles: NewsArticle[] = []

  // Soft quotas per page: no single feed or subject should fill the list.
  const MAX_PER_SOURCE = 3
  const MAX_PER_TOPIC = 4
  const sourceUsage = new Map<string, number>()
  const topicUsage = new Map<string, number>()

  const takeFrom = (pool: NewsArticle[]): NewsArticle | null => {
    if (pool.length === 0) return null

    const topicOf = (item: NewsArticle) => item.canonicalTopics?.[0] || 'geral'
    const index = pool.findIndex(
      (item) =>
        (sourceUsage.get(item.sourceId) || 0) < MAX_PER_SOURCE &&
        (topicUsage.get(topicOf(item)) || 0) < MAX_PER_TOPIC
    )
    const chosen = index === -1 ? (pool.shift() as NewsArticle) : pool.splice(index, 1)[0]

    sourceUsage.set(chosen.sourceId, (sourceUsage.get(chosen.sourceId) || 0) + 1)
    topicUsage.set(topicOf(chosen), (topicUsage.get(topicOf(chosen)) || 0) + 1)
    return chosen
  }

  while (articles.length < pageSize) {
    let best: FeedPool | null = null

    for (const key of keys) {
      if (pools[key].length === 0) {
        current[key] = 0
        continue
      }
      current[key] += shares[key]
      if (best === null || current[key] > current[best]) best = key
    }

    if (!best) break
    current[best] -= totalWeight

    const chosen = takeFrom(pools[best])
    if (!chosen) break
    articles.push(chosen)
    counts[best] += 1
  }

  return { articles, counts }
}

export function buildFeedMix(
  ranked: NewsArticle[],
  profile: UserProfile,
  _seenIds: Set<string> = new Set(),
  options: FeedMixOptions = {}
): FeedMixResult {
  const shares = options.shares || DEFAULT_FEED_SHARES
  const pageSize = Math.max(1, Math.floor(Number(options.pageSize) || ranked.length || 1))

  const pools: Record<FeedPool, NewsArticle[]> = { personal: [], variety: [], explore: [] }
  for (const article of ranked) {
    pools[classifyFeedPool(article, profile)].push(article)
  }

  return interleavePools(pools, shares, pageSize)
}

// Avoids two articles about the same primary topic back to back (MMR-lite):
// looks ahead for a different topic and swaps it into place.
export function spreadSameCategory(articles: NewsArticle[]): NewsArticle[] {
  const result = [...articles]

  for (let index = 1; index < result.length; index += 1) {
    const previousTopic = result[index - 1].canonicalTopics?.[0]
    if (!previousTopic) continue
    if (result[index].canonicalTopics?.[0] !== previousTopic) continue

    const swapIndex = result.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && candidate.canonicalTopics?.[0] !== previousTopic
    )
    if (swapIndex === -1) continue

    const [moved] = result.splice(swapIndex, 1)
    result.splice(index, 0, moved)
  }

  return result
}
