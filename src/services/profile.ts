// src/services/profile.ts
// Pure profile helpers shared by the worker runtime and tests.
import type { FeedSource, UserProfile } from './types'
import { DEFAULT_USER_PROFILE } from './types'

const FALLBACK_LANGUAGE = 'pt-BR'

function sourcesForLanguages(curatedSources: FeedSource[], languages: string[]): string[] {
  return curatedSources.filter((source) => languages.includes(source.language)).map((source) => source.id)
}

/**
 * Merges a stored profile with defaults. Languages are still normalized when
 * missing, but empty source lists are only backfilled while onboarding is
 * incomplete: after the user finishes setup, an explicitly empty list is a
 * valid choice and must be preserved. A missing followedSources key (profile
 * written by an older version) is backfilled regardless.
 */
export function resolveUserProfile(
  stored: Partial<UserProfile> | null | undefined,
  curatedSources: FeedSource[]
): UserProfile {
  if (!stored || typeof stored !== 'object') {
    return {
      ...DEFAULT_USER_PROFILE,
      followedSources: curatedSources
        .filter((source) => source.language === FALLBACK_LANGUAGE)
        .map((source) => source.id)
    }
  }

  const merged: UserProfile = { ...DEFAULT_USER_PROFILE, ...stored }
  if (!Array.isArray(merged.languages) || merged.languages.length === 0) {
    merged.languages = [FALLBACK_LANGUAGE]
  }

  const rawFollowed = (stored as { followedSources?: unknown }).followedSources
  if (!Array.isArray(rawFollowed)) {
    merged.followedSources = sourcesForLanguages(curatedSources, merged.languages)
  } else if (rawFollowed.length === 0 && !merged.onboardingCompleted) {
    merged.followedSources = sourcesForLanguages(curatedSources, merged.languages)
  }

  return merged
}

/**
 * Merges custom sources by id so a save made from a stale profile snapshot
 * cannot delete a source that was just added. Updating an existing source
 * replaces it; entries absent from the update are kept. Removing a custom
 * source needs an explicit remove API (not part of this contract yet).
 */
export function mergeCustomSources(
  stored: FeedSource[] | undefined,
  updates: FeedSource[] | undefined
): FeedSource[] {
  const base = Array.isArray(stored) ? stored : []
  if (!Array.isArray(updates)) return base

  const byId = new Map<string, FeedSource>()
  for (const source of base) {
    if (source && typeof source.id === 'string' && source.id) byId.set(source.id, source)
  }
  for (const source of updates) {
    if (source && typeof source.id === 'string' && source.id) byId.set(source.id, source)
  }
  return Array.from(byId.values())
}
