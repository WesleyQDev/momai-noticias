// src/components/OnboardingModal.tsx
import React, { useState } from 'react'
import newsIconPng from '../../icon.png'
import type { UserProfile, CanonicalTopic, FeedSource } from '../services/types'
import { useExtensionLocale } from '../services/i18n'
import { THEME_CLASSES } from '../services/theme'
import { newsApi } from '../services/api'

interface OnboardingModalProps {
  initialProfile: UserProfile
  curatedSources: FeedSource[]
  onComplete: (profile: UserProfile) => void
  onClose?: () => void
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

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialProfile,
  curatedSources,
  onComplete
}) => {
  const { t, locale } = useExtensionLocale()
  const [step, setStep] = useState(1)

  const [languages, setLanguages] = useState<string[]>(() => {
    if (initialProfile.languages && initialProfile.languages.length > 0) {
      return initialProfile.languages
    }
    return [locale.includes('en') ? 'en-US' : 'pt-BR']
  })

  const [interests, setInterests] = useState<CanonicalTopic[]>(() => {
    if (initialProfile.interests && initialProfile.interests.length > 0) {
      return initialProfile.interests
    }
    return ['tecnologia', 'economia', 'mundo', 'ciencia', 'esportes', 'cultura', 'games', 'saude', 'geral']
  })

  const [followedSources, setFollowedSources] = useState<string[]>(() => {
    if (initialProfile.followedSources && initialProfile.followedSources.length > 0) {
      return initialProfile.followedSources
    }
    const initialLang = locale.includes('en') ? 'en-US' : 'pt-BR'
    return curatedSources.filter((s) => s.language === initialLang).map((s) => s.id)
  })

  const [mutedKeywords, setMutedKeywords] = useState<string[]>(() => {
    return initialProfile.mutedKeywords || []
  })
  const [newKeyword, setNewKeyword] = useState('')

  const [customUrl, setCustomUrl] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customMessage, setCustomMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => {
      let nextLangs: string[]
      if (prev.includes(code)) {
        if (prev.length === 1) return prev
        nextLangs = prev.filter((c) => c !== code)
        // Remove sources of removed language
        setFollowedSources((prevSources) => {
          const removed = new Set(curatedSources.filter((s) => s.language === code).map((s) => s.id))
          return prevSources.filter((id) => !removed.has(id))
        })
      } else {
        nextLangs = [...prev, code]
        // Automatically follow all curated sources of the newly added language
        setFollowedSources((prevSources) => {
          const added = curatedSources.filter((s) => s.language === code).map((s) => s.id)
          return Array.from(new Set([...prevSources, ...added]))
        })
      }
      return nextLangs
    })
  }

  const toggleInterest = (topic: CanonicalTopic) => {
    setInterests((prev) => {
      if (prev.includes(topic)) {
        if (prev.length === 1) return prev
        return prev.filter((t) => t !== topic)
      }
      return [...prev, topic]
    })
  }

  const toggleFollowSource = (sourceId: string) => {
    setFollowedSources((prev) => {
      if (prev.includes(sourceId)) {
        return prev.filter((id) => id !== sourceId)
      }
      return [...prev, sourceId]
    })
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
    setCustomMessage(null)
    try {
      const res = await newsApi.addCustomSource(customUrl.trim())
      if (res.ok && res.source) {
        setCustomMessage({ text: t('onboarding.customSourceAdded') })
        setFollowedSources((prev) => [...prev, res.source!.id])
        setCustomUrl('')
      } else {
        setCustomMessage({ text: res.error || t('onboarding.customSourceError'), isError: true })
      }
    } catch {
      setCustomMessage({ text: t('onboarding.customSourceError'), isError: true })
    } finally {
      setIsAddingCustom(false)
    }
  }

  const handleFinish = (isSkip = false) => {
    const finalLanguages = languages.length > 0 ? languages : ['pt-BR']
    const finalInterests: CanonicalTopic[] = interests.length > 0 ? interests : ['tecnologia', 'economia', 'mundo', 'geral']
    const finalFollowed = isSkip && followedSources.length === 0
      ? curatedSources.filter((s) => finalLanguages.includes(s.language)).map((s) => s.id)
      : followedSources.length > 0
        ? followedSources
        : curatedSources.filter((s) => finalLanguages.includes(s.language)).map((s) => s.id)

    const updatedProfile: UserProfile = {
      ...initialProfile,
      onboardingCompleted: true,
      languages: finalLanguages,
      interests: finalInterests,
      followedSources: finalFollowed,
      mutedKeywords
    }

    onComplete(updatedProfile)
  }

  return (
    <div className="w-full h-full bg-bg text-text flex flex-col font-sans overflow-y-auto">
      {/* Top Header Bar */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <img
              src={newsIconPng}
              alt="MomAI Notícias"
              className="w-10 h-10 object-contain select-none"
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-text">
              {t('app.title')}
            </h1>
            <p className="text-xs text-text-muted">
              {t('onboarding.title')}
            </p>
          </div>
        </div>

        <button
          onClick={() => handleFinish(true)}
          className="text-xs font-semibold text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-input transition-colors"
        >
          {t('onboarding.skip')} →
        </button>
      </header>

      {/* Center Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Progress Bar & Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-muted font-medium">
              <span>Etapa {step} de 4</span>
              <span>{Math.round((step / 4) * 100)}% concluído</span>
            </div>
            <div className="h-2 w-full bg-sidebar rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Step Card Container */}
          <div className={`p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-md space-y-6`}>
            {/* Step 1: Languages */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text mb-1">
                    {t('onboarding.step1Title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {t('onboarding.step1Desc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = languages.includes(lang.code)
                    return (
                      <button
                        key={lang.code}
                        onClick={() => toggleLanguage(lang.code)}
                        className={`flex items-center justify-between p-4 rounded-xl border text-sm transition-all duration-200 ${
                          isSelected
                            ? 'bg-accent/15 border-accent text-text shadow-xs font-semibold'
                            : 'bg-sidebar border-border text-text-muted hover:text-text hover:border-border/80'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-xl">{lang.flag}</span>
                          <span>{lang.label}</span>
                        </span>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Interests */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text mb-1">
                    {t('onboarding.step2Title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {t('onboarding.step2Desc')}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {CANONICAL_TOPICS.map((topic) => {
                    const isSelected = interests.includes(topic.id)
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleInterest(topic.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 text-sm ${
                          isSelected
                            ? 'bg-accent/15 border-accent text-text shadow-xs font-semibold'
                            : 'bg-sidebar border-border text-text-muted hover:text-text hover:border-border/80'
                        }`}
                      >
                        <span className="text-xl">{topic.icon}</span>
                        <span className="truncate">{t(topic.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Sources */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text mb-1">
                    {t('onboarding.step3Title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {t('onboarding.step3Desc')}
                  </p>
                </div>

                {/* Add Custom Source */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={t('onboarding.addSourcePlaceholder')}
                    className={`flex-1 text-sm ${THEME_CLASSES.input}`}
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
                {customMessage && (
                  <p className={`text-xs ${customMessage.isError ? 'text-accent font-semibold' : 'text-text-muted'}`}>
                    {customMessage.text}
                  </p>
                )}

                {/* Sources Grouped by Language */}
                <div className="space-y-5 max-h-80 overflow-y-auto pr-1">
                  {languages.map((langCode) => {
                    const langInfo = AVAILABLE_LANGUAGES.find((l) => l.code === langCode)
                    const langSources = curatedSources.filter((s) => s.language === langCode)
                    if (langSources.length === 0) return null

                    const followedCount = langSources.filter((s) => followedSources.includes(s.id)).length

                    return (
                      <div key={langCode} className="space-y-2.5">
                        <div className="flex items-center justify-between font-bold text-text text-xs border-b border-border/60 pb-2">
                          <span className="flex items-center gap-1.5">
                            <span>{langInfo?.flag}</span>
                            <span>{langInfo?.label || langCode}</span>
                          </span>
                          <span className="text-text-muted text-[11px] font-normal">
                            {followedCount} de {langSources.length} selecionadas
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {langSources.map((source) => {
                            const isFollowed = followedSources.includes(source.id)
                            return (
                              <div
                                key={source.id}
                                onClick={() => toggleFollowSource(source.id)}
                                className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all select-none ${
                                  isFollowed
                                    ? 'bg-accent/15 border-accent text-text shadow-xs font-semibold'
                                    : 'bg-sidebar border-border text-text-muted hover:text-text'
                                }`}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="text-xs truncate">{source.title}</div>
                                  <div className="text-[10px] text-text-muted truncate">{source.homepage?.replace(/^https?:\/\//, '')}</div>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isFollowed ? 'bg-accent text-white' : 'bg-input text-text-muted'
                                }`}>
                                  {isFollowed ? '✓' : '+'}
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

            {/* Step 4: Muted Keywords */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-text mb-1">
                    {t('onboarding.step4Title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted">
                    {t('onboarding.step4Desc')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder={t('onboarding.mutedPlaceholder')}
                    className={`flex-1 text-sm ${THEME_CLASSES.input}`}
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
                      Nenhum termo silenciado ainda. Você pode configurar isso a qualquer momento.
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
                          className="text-text-muted hover:text-accent font-bold text-sm leading-none"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 pb-4 flex items-center justify-between border-t border-border mt-8 shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className={THEME_CLASSES.buttonSecondary}
            >
              ← {t('onboarding.back')}
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className={`${THEME_CLASSES.buttonPrimary} px-6 py-2.5 text-sm font-semibold`}
            >
              {t('onboarding.next')} →
            </button>
          ) : (
            <button
              onClick={() => handleFinish(false)}
              className={`${THEME_CLASSES.buttonPrimary} px-6 py-2.5 text-sm font-semibold shadow-md`}
            >
              {t('onboarding.finish')} ✨
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
