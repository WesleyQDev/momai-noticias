import { describe, expect, it } from 'vitest'
import { mergeCustomSources, resolveUserProfile } from '../src/services/profile'
import type { FeedSource } from '../src/services/types'

const curated: FeedSource[] = [
  { id: 'br-1', title: 'BR 1', homepage: 'https://br1.example', feed: 'https://br1.example/feed', language: 'pt-BR', topics: ['geral'] },
  { id: 'br-2', title: 'BR 2', homepage: 'https://br2.example', feed: 'https://br2.example/feed', language: 'pt-BR', topics: ['geral'] },
  { id: 'us-1', title: 'US 1', homepage: 'https://us1.example', feed: 'https://us1.example/feed', language: 'en-US', topics: ['geral'] }
]

describe('resolveUserProfile', () => {
  it('backfills followed sources for a brand new profile', () => {
    const profile = resolveUserProfile(null, curated)
    expect(profile.languages).toEqual(['pt-BR'])
    expect(profile.followedSources).toEqual(['br-1', 'br-2'])
  })

  it('backfills an empty list while onboarding is not complete', () => {
    const profile = resolveUserProfile(
      { onboardingCompleted: false, languages: ['pt-BR'], followedSources: [] },
      curated
    )
    expect(profile.followedSources).toEqual(['br-1', 'br-2'])
  })

  it('preserves an explicitly empty list after onboarding', () => {
    const profile = resolveUserProfile(
      { onboardingCompleted: true, languages: ['pt-BR'], followedSources: [] },
      curated
    )
    expect(profile.followedSources).toEqual([])
  })

  it('backfills a missing followedSources key even after onboarding', () => {
    const profile = resolveUserProfile(
      { onboardingCompleted: true, languages: ['en-US'] } as any,
      curated
    )
    expect(profile.followedSources).toEqual(['us-1'])
  })
})

describe('mergeCustomSources', () => {
  const source = (id: string): FeedSource => ({
    id,
    title: id,
    homepage: `https://${id}.example`,
    feed: `https://${id}.example/feed`,
    language: 'pt-BR',
    topics: ['geral'],
    isCustom: true,
    enabled: true
  })

  it('keeps stored entries that are absent from a stale update', () => {
    const merged = mergeCustomSources([source('a'), source('b')], [source('a')])
    expect(merged.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('applies changes for the same id and adds new ids', () => {
    const renamed = { ...source('a'), title: 'Renomeada' }
    const merged = mergeCustomSources([source('a')], [renamed, source('c')])
    expect(merged.find((s) => s.id === 'a')?.title).toBe('Renomeada')
    expect(merged.some((s) => s.id === 'c')).toBe(true)
  })

  it('returns the stored list when the update has no sources array', () => {
    expect(mergeCustomSources([source('a')], undefined).map((s) => s.id)).toEqual(['a'])
  })
})
