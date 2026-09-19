// src/services/ranking.ts
import type { NewsArticle, UserProfile } from './types'
import { extractInterestTerms } from './interest-terms.ts'

export const HALF_LIFE_HOURS = 14
export const HALF_LIFE_MS = HALF_LIFE_HOURS * 60 * 60 * 1000

// Learned signals: they saturate (tanh) so a single favourite source cannot
// take over the feed, and they fade with time so old habits lose weight.
export const AFFINITY_SCALE = 5
export const AFFINITY_HALF_LIFE_DAYS = 7
// Older articles keep competing: recency decays to a floor instead of zero.
export const RECENCY_FLOOR = 0.1
// Already-seen articles stay reachable but lose priority.
export const SEEN_MULTIPLIER = 0.35

export function calculateRecencyScore(publishedAt: number, now = Date.now()): number {
  const ageMs = Math.max(0, now - publishedAt)
  // Exponential decay: e^(-lambda * t) where lambda = ln(2) / halfLife
  const decayFactor = Math.pow(0.5, ageMs / HALF_LIFE_MS)
  return Math.max(0.01, decayFactor)
}

export function normalizeAffinity(value: number | undefined, scale = AFFINITY_SCALE): number {
  const raw = Number(value)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.tanh(raw / Math.max(1, scale))
}

// Negative feedback ("dislike") saturates the same way, as a discount factor.
export function affinityPenalty(value: number | undefined, scale = AFFINITY_SCALE): number {
  const raw = Number(value)
  if (!Number.isFinite(raw) || raw >= 0) return 0
  return Math.tanh(-raw / Math.max(1, scale))
}

export function decayAffinities(
  map: Record<string, number> | undefined,
  daysSinceLastInteraction: number,
  halfLifeDays = AFFINITY_HALF_LIFE_DAYS
): Record<string, number> {
  const source = map || {}
  const days = Number(daysSinceLastInteraction)
  if (!Number.isFinite(days) || days <= 0) return { ...source }

  const factor = Math.pow(0.5, days / Math.max(0.5, halfLifeDays))
  const decayed: Record<string, number> = {}
  for (const [key, value] of Object.entries(source)) {
    const next = Number(value) * factor
    if (Number.isFinite(next) && next > 0.01) decayed[key] = Math.round(next * 1000) / 1000
  }
  return decayed
}

export function calculateArticleScore(
  article: NewsArticle,
  profile: UserProfile,
  seenIds: Set<string> = new Set(),
  now = Date.now()
): number {
  // 1. Muted check: if title/summary contains muted keywords, penalize heavily or filter
  if (profile.mutedKeywords && profile.mutedKeywords.length > 0) {
    const text = `${article.title} ${article.summary}`.toLowerCase()
    for (const kw of profile.mutedKeywords) {
      if (kw && text.includes(kw.toLowerCase().trim())) {
        return 0 // filtered out
      }
    }
  }

  // 2. Blocked source check
  if (profile.blockedSources && profile.blockedSources.includes(article.sourceId)) {
    return 0
  }

  // 3. Recency [RECENCY_FLOOR..1]: recent wins, but an older story from an
  // interest or a favourite source can still climb.
  const recency = Math.max(RECENCY_FLOOR, calculateRecencyScore(article.publishedAt, now))

  // 4. Interests + learned topic affinity (dislikes discount the topic)
  const interests = new Set(profile.interests || [])
  const topics = article.canonicalTopics || []
  const matchedInterests = topics.filter((topic) => interests.has(topic)).length
  const learnedTopic = topics.reduce(
    (best, topic) => Math.max(best, normalizeAffinity(profile.affinityByTopic?.[topic])),
    0
  )
  const dislikedTopic = topics.reduce(
    (worst, topic) => Math.max(worst, affinityPenalty(profile.affinityByTopic?.[topic])),
    0
  )
  const topicScore =
    (1 + 0.5 * matchedInterests + 1.5 * learnedTopic) * (1 - 0.6 * dislikedTopic)

  // 5. Followed source + learned source affinity (dislikes discount the source)
  const isFollowed = Boolean(profile.followedSources && profile.followedSources.includes(article.sourceId))
  const learnedSource = normalizeAffinity(profile.affinityBySource?.[article.sourceId])
  const dislikedSource = affinityPenalty(profile.affinityBySource?.[article.sourceId])
  const sourceScore =
    ((isFollowed ? 1.6 : 1) + 1.2 * learnedSource) * (1 - 0.6 * dislikedSource)

  // 6. Language affinity
  const isPreferredLanguage = Boolean(profile.languages && profile.languages.includes(article.language))
  const languageMultiplier = isPreferredLanguage || isFollowed ? 1.0 : 0.4

  // 7. Title terms: the specific subjects the user reacted to ("inteligência
  // artificial" beats the broad "tecnologia" category as a signal).
  let positiveTerms = 0
  let dislikedTerms = 0
  for (const term of extractInterestTerms(article.title)) {
    const value = profile.affinityByTerm?.[term] || 0
    if (value > 0) positiveTerms += value
    else if (value < 0) dislikedTerms += value
  }
  const contentScore =
    (1 + 1.0 * normalizeAffinity(positiveTerms)) * (1 - 0.5 * affinityPenalty(dislikedTerms))

  const baseScore = topicScore * recency * sourceScore * languageMultiplier * contentScore

  // 7. Seen articles drop in priority without leaving the feed.
  const isSeen = seenIds.has(article.id) || seenIds.has(article.url)
  return isSeen ? baseScore * SEEN_MULTIPLIER : baseScore
}

export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seenUrls = new Set<string>()
  const seenTitlePrefixes = new Map<string, NewsArticle>()
  const result: NewsArticle[] = []

  const normalizeTitle = (t: string) =>
    t.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  for (const article of articles) {
    if (!article.url || seenUrls.has(article.url)) continue

    const normTitle = normalizeTitle(article.title)
    // Use a generous prefix (60 chars) to catch true duplicates from overlapping
    // feeds (e.g. G1 geral + G1 tecnologia publishing the same article) while
    // keeping distinct articles about the same topic from different sources.
    const titleKey = normTitle.length > 15 ? normTitle.slice(0, 60) : normTitle
    if (titleKey.length > 10) {
      if (seenTitlePrefixes.has(titleKey)) {
        // Keep the newer one or the one with image
        const existing = seenTitlePrefixes.get(titleKey)!
        if (!existing.image && article.image) {
          const idx = result.indexOf(existing)
          if (idx !== -1) result[idx] = article
          seenTitlePrefixes.set(titleKey, article)
        }
        continue
      }
      seenTitlePrefixes.set(titleKey, article)
    }

    seenUrls.add(article.url)
    result.push(article)
  }

  return result
}

export function applyDiversityLimit(articles: NewsArticle[], maxConsecutivePerSource = 2): NewsArticle[] {
  const result: NewsArticle[] = []
  const remaining = [...articles]

  while (remaining.length > 0) {
    let chosenIndex = 0

    // Check if the first article violates consecutive limit
    if (result.length >= maxConsecutivePerSource) {
      const lastSource = result[result.length - 1].sourceId
      let consecutiveCount = 0
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].sourceId === lastSource) consecutiveCount++
        else break
      }

      if (consecutiveCount >= maxConsecutivePerSource && remaining[0].sourceId === lastSource) {
        // Find next article from different source
        const altIndex = remaining.findIndex((a) => a.sourceId !== lastSource)
        if (altIndex !== -1) {
          chosenIndex = altIndex
        }
      }
    }

    result.push(remaining.splice(chosenIndex, 1)[0])
  }

  return result
}

export function rankAndFilterFeed(
  articles: NewsArticle[],
  profile: UserProfile,
  seenIds: Set<string> = new Set(),
  filterTopic?: string,
  filterLang?: string,
  onlyFollowed = false
): NewsArticle[] {
  // Deduplicate first
  const deduped = deduplicateArticles(articles)

  // Score articles
  const scored = deduped.map((a) => {
    const score = calculateArticleScore(a, profile, seenIds)
    return { ...a, score }
  }).filter((a) => a.score > 0)

  // Filter by topic if specified
  let filtered = scored
  if (filterTopic && filterTopic !== 'all' && filterTopic !== 'paravoce') {
    const normTopic = filterTopic.toLowerCase().trim()
    filtered = filtered.filter((a) => {
      return Boolean(a.canonicalTopics && a.canonicalTopics.includes(normTopic as any))
    })
  }

  // Filter by language if specified
  if (filterLang) {
    filtered = filtered.filter((a) => a.language === filterLang)
  }

  // Filter by only followed
  if (onlyFollowed) {
    const followedSet = new Set(profile.followedSources || [])
    filtered = filtered.filter((a) => followedSet.has(a.sourceId))
  }

  // Sort by score descending
  filtered.sort((a, b) => (b.score || 0) - (a.score || 0))

  // Apply diversity
  return applyDiversityLimit(filtered)
}
