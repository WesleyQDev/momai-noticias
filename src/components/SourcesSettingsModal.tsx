// src/components/SourcesSettingsModal.tsx
import React, { useState } from 'react'
import type { UserProfile, CanonicalTopic, FeedSource } from '../services/types'
import { useExtensionLocale } from '../services/i18n'
import { THEME_CLASSES } from '../services/theme'
import { newsApi } from '../services/api'

interface SourcesSettingsModalProps {
  profile: UserProfile
  curatedSources: FeedSource[]
  onSave: (updated: UserProfile) => void
  onResetOnboarding: () => void
  onClose: () => void
}

const AVAILABLE_LANGUAGES = [
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' }
]

const CANONICAL_TOPICS: { id: CanonicalTopic; labelKey: string; icon: string }[] = [
  { id: 'tecnologia', labelKey: 'topics.tecnologia', icon: '💻' },
  { id: 'economia', labelKey: 'topics.economia', icon: '📈' },
  { id: 'politica', labelKey: 'topics.politica', icon: '🏛️' },
  { id: 'ciencia', labelKey: 'topics.ciencia', icon: '🔬' },
  { id: 'esportes', labelKey: 'topics.esportes', icon: '⚽' },
  { id: 'cultura', labelKey: 'topics.cultura', icon: '🎬' },
  { id: 'games', labelKey: 'topics.games', icon: '🎮' },
  { id: 'saude', labelKey: 'topics.saude', icon: '🏥' },
  { id: 'mundo', labelKey: 'topics.mundo', icon: '🌍' }
]

export const SourcesSettingsModal: React.FC<SourcesSettingsModalProps> = ({
  profile,
  curatedSources,
  onSave,
  onResetOnboarding,
  onClose
}) => {
  const { t } = useExtensionLocale()
  const [activeTab, setActiveTab] = useState<'sources' | 'topics' | 'languages' | 'muted'>('sources')

  const [languages, setLanguages] = useState<string[]>(profile.languages || ['pt-BR'])
  const [interests, setInterests] = useState<CanonicalTopic[]>(profile.interests || ['tecnologia'])
  const [followedSources, setFollowedSources] = useState<string[]>(profile.followedSources || [])
  const [blockedSources, setBlockedSources] = useState<string[]>(profile.blockedSources || [])
  const [mutedKeywords, setMutedKeywords] = useState<string[]>(profile.mutedKeywords || [])
  const [retentionDays] = useState<number>(profile.retentionDays || 3)

  const [sourceSearch, setSourceSearch] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

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
        setFollowedSources((prev) => [...prev, res.source!.id])
        setCustomUrl('')
      } else {
        setCustomError(res.error || t('onboarding.customSourceError'))
      }
    } catch {
      setCustomError(t('onboarding.customSourceError'))
    } finally {
      setIsAddingCustom(false)
    }
  }

  const handleSaveAll = () => {
    const updated: UserProfile = {
      ...profile,
      languages,
      interests,
      followedSources,
      blockedSources,
      mutedKeywords,
      retentionDays
    }
    onSave(updated)
    onClose()
  }

  const allSources = [...curatedSources, ...(profile.customSources || [])]

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
            onClick={onResetOnboarding}
            className="text-xs text-accent font-semibold hover:underline px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30 transition-colors"
          >
            ↺ {t('settings.redoSetup')}
          </button>
          <button
            onClick={onClose}
            className={`${THEME_CLASSES.buttonGhost} p-2`}
            title="Fechar"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex border-b border-border bg-sidebar/50 px-6 text-xs font-medium shrink-0">
        {(['sources', 'topics', 'languages', 'muted'] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setActiveTab(tb)}
            className={`py-3 px-5 border-b-2 font-semibold transition-colors ${
              activeTab === tb
                ? 'border-accent text-accent'
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
                  onClick={handleAddCustomSource}
                  disabled={isAddingCustom || !customUrl.trim()}
                  className={THEME_CLASSES.buttonPrimary}
                >
                  {isAddingCustom ? '...' : t('onboarding.addSourceBtn')}
                </button>
              </div>

              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Filtrar fontes por nome..."
                className={`w-full sm:w-72 ${THEME_CLASSES.input}`}
              />
            </div>
            {customError && <p className="text-accent">{customError}</p>}

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
                        <span>{langInfo.label}</span>
                      </span>
                      <span className="text-text-muted text-[11px] font-normal">
                        {followedCount} de {langSources.length} seguidas
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
                              isBlocked ? 'bg-sidebar/40 border-border/50 opacity-60' : 'bg-sidebar border-border'
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
                                onClick={() => toggleFollowSource(source.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                  isFollowed
                                    ? 'bg-accent text-white font-semibold shadow-xs'
                                    : 'bg-input text-text-muted hover:text-text'
                                }`}
                              >
                                {isFollowed ? `✓ ${t('onboarding.following')}` : t('onboarding.follow')}
                              </button>
                              <button
                                onClick={() => toggleBlockSource(source.id)}
                                title={isBlocked ? t('settings.unblock') : t('settings.block')}
                                className={`p-1 rounded text-xs ${
                                  isBlocked ? 'text-accent font-bold' : 'text-text-muted hover:text-text'
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
                  onClick={() => toggleInterest(topic.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-text shadow-xs font-semibold'
                      : 'bg-sidebar border-border text-text-muted hover:text-text'
                  }`}
                >
                  <span className="text-xl">{topic.icon}</span>
                  <span className="truncate">{t(topic.labelKey)}</span>
                </button>
              )
            })}
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
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-text font-semibold shadow-xs'
                      : 'bg-sidebar border-border text-text-muted hover:text-text'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                  {isSelected && (
                    <span className="text-accent font-bold text-sm">✓</span>
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
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                className={THEME_CLASSES.buttonPrimary}
              >
                {t('onboarding.addSourceBtn')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {mutedKeywords.length === 0 ? (
                <p className="text-text-muted italic text-xs">
                  Nenhum termo silenciado.
                </p>
              ) : (
                mutedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sidebar text-text border border-border text-xs font-medium"
                  >
                    <span>{kw}</span>
                    <button
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-text-muted hover:text-accent font-bold"
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
        <button onClick={onClose} className={THEME_CLASSES.buttonSecondary}>
          Cancelar
        </button>
        <button onClick={handleSaveAll} className={THEME_CLASSES.buttonPrimary}>
          {t('settings.saveChanges')}
        </button>
      </footer>
    </div>
  )
}
