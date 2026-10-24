// src/components/SourcesSettingsModal.tsx
import React, { useState, useMemo } from 'react'
import type { UserProfile, CanonicalTopic, FeedSource } from '../services/types'
import { useExtensionLocale, translateErrorCode } from '../services/i18n'
import { THEME_CLASSES } from '../services/theme'
import { newsApi } from '../services/api'
import { AVAILABLE_LANGUAGES, CANONICAL_TOPICS, TICKER_NEWS_TYPES } from '../services/onboarding-options'

interface SourcesSettingsModalProps {
  profile: UserProfile
  curatedSources: FeedSource[]
  onSave: (updated: Partial<UserProfile>) => void
  onResetOnboarding: () => void
  onClose: () => void
}

export const SourcesSettingsModal: React.FC<SourcesSettingsModalProps> = ({
  profile,
  curatedSources,
  onSave,
  onResetOnboarding,
  onClose
}) => {
  const { t } = useExtensionLocale()
  const [activeTab, setActiveTab] = useState<'sources' | 'topics' | 'types' | 'languages' | 'muted'>('sources')

  const [languages, setLanguages] = useState<string[]>(profile.languages || ['pt-BR'])
  const [interests, setInterests] = useState<CanonicalTopic[]>(profile.interests || ['tecnologia'])
  const [tickerTypes, setTickerTypes] = useState<string[]>(
    profile.tickerTypes || ['quotes', 'polls', 'urgent', 'headlines']
  )
  const [followedSources, setFollowedSources] = useState<string[]>(profile.followedSources || [])
  const [blockedSources, setBlockedSources] = useState<string[]>(profile.blockedSources || [])
  const [mutedKeywords, setMutedKeywords] = useState<string[]>(profile.mutedKeywords || [])
  const [retentionDays] = useState<number>(profile.retentionDays || 3)

  const [sourceSearch, setSourceSearch] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  // Sources added during this session, shown immediately even though the
  // server-side profile has not been re-fetched yet.
  const [addedSources, setAddedSources] = useState<FeedSource[]>([])

  const toggleTickerType = (typeId: string) => {
    setTickerTypes((prev) => (prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]))
  }

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => (prev.includes(code) ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev) : [...prev, code]))
  }

  const toggleInterest = (topic: CanonicalTopic) => {
    setInterests((prev) => (prev.includes(topic) ? (prev.length > 1 ? prev.filter((t) => t !== topic) : prev) : [...prev, topic]))
  }

  const toggleFollowSource = (sourceId: string) => {
    setFollowedSources((prev) => (prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]))
    setBlockedSources((prev) => prev.filter((id) => id !== sourceId))
  }

  const toggleBlockSource = (sourceId: string) => {
    setBlockedSources((prev) => (prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]))
    setFollowedSources((prev) => prev.filter((id) => id !== sourceId))
  }

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase()
    if (trimmed && !mutedKeywords.includes(trimmed)) {
      setMutedKeywords([...mutedKeywords, trimmed])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (kw: string) => {
    setMutedKeywords(mutedKeywords.filter((k) => k !== kw))
  }

  const handleAddCustomSource = async () => {
    if (!customUrl.trim()) return
    setIsAddingCustom(true)
    setCustomError(null)
    try {
      const res = await newsApi.addCustomSource(customUrl.trim())
      if (res.ok && res.source) {
        setAddedSources((prev) => (prev.some((s) => s.id === res.source!.id) ? prev : [...prev, res.source!]))
        setFollowedSources((prev) => (prev.includes(res.source!.id) ? prev : [...prev, res.source!.id]))
        setCustomUrl('')
      } else {
        setCustomError(translateErrorCode(res.errorCode, t))
      }
    } catch {
      setCustomError(t('onboarding.customSourceError'))
    } finally {
      setIsAddingCustom(false)
    }
  }

  const handleSaveAll = () => {
    // Send only the fields this screen owns. The full profile (and its custom
    // sources) is merged on the server, so a snapshot older than a source just
    // added here cannot erase it.
    const updates: Partial<UserProfile> = {
      languages,
      interests,
      followedSources,
      blockedSources,
      mutedKeywords,
      retentionDays,
      tickerTypes
    }
    onSave(updates)
    onClose()
  }

  const allSources = useMemo(() => {
    const combined = [...curatedSources, ...(profile.customSources || []), ...addedSources]
    const seen = new Set<string>()
    const unique: FeedSource[] = []
    for (const source of combined) {
      if (source && source.id && !seen.has(source.id)) {
        seen.add(source.id)
        unique.push(source)
      }
    }
    return unique
  }, [curatedSources, profile.customSources, addedSources])

  return (
    <div className="w-full h-full flex flex-col bg-bg text-text font-sans overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <div>
            <h1 className="text-base font-bold text-text">
              {t('settings.title')}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetOnboarding}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text px-3 py-1.5 rounded-lg bg-sidebar hover:bg-input border border-border font-medium transition-colors"
            title={t('settings.redoSetup')}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>{t('settings.redoSetup')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${THEME_CLASSES.buttonGhost} p-2`}
            title={t('app.back')}
          >
            ✕
          </button>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex border-b border-border bg-sidebar/50 px-6 text-xs font-medium shrink-0">
        {(['sources', 'topics', 'types', 'languages', 'muted'] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setActiveTab(tb)}
            className={`py-3 px-5 border-b-2 font-semibold transition-colors ${
              activeTab === tb
                ? 'border-text text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t(`settings.tabs.${tb}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="p-6 overflow-y-auto flex-1 text-xs w-full">
        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="space-y-6">
            {/* Action Bar: Add Custom Source & Search */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-4xl">
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder={t('onboarding.addSourcePlaceholder')}
                  className={`flex-1 ${THEME_CLASSES.input}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSource()}
                />
                <button
                  type="button"
                  onClick={handleAddCustomSource}
                  disabled={isAddingCustom || !customUrl.trim()}
                  className="bg-text text-bg font-medium px-4 py-2 rounded-lg text-xs transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isAddingCustom ? '...' : t('onboarding.addSourceBtn')}
                </button>
              </div>

              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder={t('settings.filterSources')}
                className={`w-full sm:w-72 ${THEME_CLASSES.input}`}
              />
            </div>
            {customError && <p className="text-error text-xs">{customError}</p>}

            {/* Grouped by Languages */}
            <div className="space-y-6">
              {AVAILABLE_LANGUAGES.map((langInfo) => {
                let langSources = allSources.filter((s) => s.language === langInfo.code)
                if (sourceSearch.trim()) {
                  const q = sourceSearch.toLowerCase()
                  langSources = langSources.filter((s) => s.title.toLowerCase().includes(q) || s.homepage.toLowerCase().includes(q))
                }
                if (langSources.length === 0) return null

                const followedCount = langSources.filter((s) => followedSources.includes(s.id)).length

                return (
                  <div key={langInfo.code} className="space-y-3">
                    <div className="flex items-center justify-between font-bold text-text text-xs border-b border-border/60 pb-1.5">
                      <span className="flex items-center gap-2">
                        <span className="text-base">{langInfo.flag}</span>
                        <span>{t(langInfo.labelKey)}</span>
                      </span>
                      <span className="text-text-muted text-[11px] font-normal">
                        {t('settings.sourcesFollowed', { count: followedCount, total: langSources.length })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {langSources.map((source) => {
                        const isFollowed = followedSources.includes(source.id)
                        const isBlocked = blockedSources.includes(source.id)
                        return (
                          <div
                            key={source.id}
                            className={`flex items-center justify-between p-3 rounded-xl border gap-2 transition-all ${
                              isBlocked
                                ? 'bg-sidebar/40 border-border/50 opacity-60'
                                : isFollowed
                                ? 'bg-card border-border shadow-xs'
                                : 'bg-sidebar border-border/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-text truncate">
                                {source.title}
                              </div>
                              <div className="text-[10px] text-text-muted truncate">
                                {source.homepage?.replace(/^https?:\/\//, '')}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleFollowSource(source.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                                  isFollowed
                                    ? 'bg-input text-text border border-border/80 font-medium hover:bg-border/30 shadow-2xs'
                                    : 'bg-sidebar/60 text-text-muted hover:text-text hover:bg-input border border-border/60 font-normal'
                                }`}
                              >
                                {isFollowed ? `✓ ${t('onboarding.following')}` : t('onboarding.follow')}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleBlockSource(source.id)}
                                title={isBlocked ? t('settings.unblock') : t('settings.block')}
                                className={`p-1 rounded text-xs transition-colors ${
                                  isBlocked ? 'text-error font-bold' : 'text-text-muted hover:text-text'
                                }`}
                              >
                                🚫
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {CANONICAL_TOPICS.map((topic) => {
              const isSelected = interests.includes(topic.id)
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleInterest(topic.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-card border-text/60 ring-1 ring-text/20 text-text shadow-xs font-semibold'
                      : 'bg-sidebar border-border text-text-muted hover:text-text hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{topic.icon}</span>
                    <span className="truncate">{t(topic.labelKey)}</span>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-bold text-text shrink-0 ml-1.5">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* News Types Tab */}
        {activeTab === 'types' && (
          <div className="space-y-4 max-w-4xl">
            <p className="text-text-muted text-xs mb-3">
              {t('settings.typesDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TICKER_NEWS_TYPES.map((typeOption) => {
                const isSelected = tickerTypes.includes(typeOption.id)
                return (
                  <button
                    key={typeOption.id}
                    type="button"
                    onClick={() => toggleTickerType(typeOption.id)}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all select-none ${
                      isSelected
                        ? 'bg-card border-text/60 ring-1 ring-text/20 text-text shadow-xs'
                        : 'bg-sidebar border-border text-text-muted hover:text-text hover:border-border/80'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{typeOption.icon}</span>
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="text-xs font-bold text-text mb-1">
                        {t(typeOption.labelKey)}
                      </div>
                      <div className="text-[11px] text-text-muted leading-relaxed">
                        {t(typeOption.descKey)}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-text text-bg shadow-xs'
                          : 'bg-input text-text-muted border border-border/60'
                      }`}
                    >
                      {isSelected ? '✓' : '+'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Languages Tab */}
        {activeTab === 'languages' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AVAILABLE_LANGUAGES.map((lang) => {
              const isSelected = languages.includes(lang.code)
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-card border-text/60 ring-1 ring-text/20 text-text font-semibold shadow-xs'
                      : 'bg-sidebar border-border text-text-muted hover:text-text hover:border-border/80'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{lang.flag}</span>
                    <span>{t(lang.labelKey)}</span>
                  </span>
                  {isSelected && (
                    <span className="text-text font-bold text-sm">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Muted Tab */}
        {activeTab === 'muted' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t('onboarding.mutedPlaceholder')}
                className={`flex-1 ${THEME_CLASSES.input}`}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                className="bg-text text-bg font-medium px-4 py-2 rounded-lg text-xs transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {t('onboarding.addSourceBtn')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {mutedKeywords.length === 0 ? (
                <p className="text-text-muted italic text-xs">
                  {t('settings.emptyMuted')}
                </p>
              ) : (
                mutedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sidebar text-text border border-border text-xs font-medium"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-text-muted hover:text-error font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-border flex items-center justify-end gap-3 bg-card shrink-0">
        <button type="button" onClick={onClose} className={THEME_CLASSES.buttonSecondary}>
          {t('settings.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSaveAll}
          className="bg-text text-bg font-semibold px-5 py-2 rounded-lg text-xs transition-opacity hover:opacity-90 shadow-xs"
        >
          {t('settings.saveChanges')}
        </button>
      </footer>
    </div>
  )
}
