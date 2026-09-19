// src/page.tsx
// Main application page for MomAI Notícias extension

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { newsApi } from './services/api'
import { useFeedPagination } from './hooks/useFeedPagination'
import { useExtensionLocale } from './services/i18n'
import { THEME_CLASSES } from './services/theme'
import type { NewsArticle, SavedArticle, UserProfile, FeedSource, ArticleFeedback } from './services/types'
import { DEFAULT_USER_PROFILE } from './services/types'
import { NewsHeader } from './components/NewsHeader'
import { NewsFeed } from './components/NewsFeed'
import { scrollFeedToTop } from './services/feed-scroll'
import { SavedArticlesView } from './components/SavedArticlesView'
import { OnboardingModal } from './components/OnboardingModal'
import { SourcesSettingsModal } from './components/SourcesSettingsModal'
import { ArticleReaderView } from './components/ArticleReaderView'

export const NewsPage: React.FC<{ isActive?: boolean }> = () => {
  const { t } = useExtensionLocale()
  const {
    articles,
    page,
    pageCount,
    total,
    isLoadingPage,
    syncing,
    loadFirstPage,
    goToPage,
    setStatic
  } = useFeedPagination()

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE)
  const [curatedSources, setCuratedSources] = useState<FeedSource[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [activeTab, setActiveTab] = useState<string>('paravoce')
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([])
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<Record<string, ArticleFeedback>>({})
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchDebounceRef = useRef<any>(null)

  const initialLoadDone = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Listen to sidebar clicks and deep-link article navigations
  useEffect(() => {
    const handleSidebarClick = (e: Event) => {
      const customEv = e as CustomEvent<{
        path?: string
        extensionId?: string
        state?: { article?: NewsArticle }
      }>
      if (
        customEv.detail?.path === '/extensions/momai-noticias' ||
        customEv.detail?.extensionId === 'momai-noticias'
      ) {
        if (customEv.detail?.state?.article) {
          setSelectedArticle(customEv.detail.state.article)
          setShowSettings(false)
          setShowOnboarding(false)
          return
        }
        setSelectedArticle(null)
        setShowSettings(false)
      }
    }
    window.addEventListener('momai:sidebar-click', handleSidebarClick)
    return () => window.removeEventListener('momai:sidebar-click', handleSidebarClick)
  }, [])

  // Check pending article in sessionStorage or CustomEvent (e.g. from widgets or direct links)
  useEffect(() => {
    const checkPendingArticle = () => {
      try {
        const stored = sessionStorage.getItem('momai_noticias_pending_article')
        if (stored) {
          sessionStorage.removeItem('momai_noticias_pending_article')
          const parsed = JSON.parse(stored) as NewsArticle
          if (parsed && (parsed.id || parsed.url || parsed.title)) {
            setSelectedArticle(parsed)
            setShowSettings(false)
            setShowOnboarding(false)
          }
        }
      } catch (err) {
        console.error('[momai-noticias:page] Failed to parse pending article:', err)
      }
    }

    checkPendingArticle()

    const handleOpenArticle = (e: Event) => {
      const customEv = e as CustomEvent<{ article?: NewsArticle }>
      if (customEv.detail?.article) {
        setSelectedArticle(customEv.detail.article)
        setShowSettings(false)
        setShowOnboarding(false)
      }
    }

    window.addEventListener('momai_noticias_open_article', handleOpenArticle)
    return () => {
      window.removeEventListener('momai_noticias_open_article', handleOpenArticle)
    }
  }, [])


  // 1. Initial Load: Profile, Curated Sources, Saved Articles AND first feed in parallel
  useEffect(() => {
    let isMounted = true

    async function initialize() {
      setIsLoading(true)
      try {
        const [profRes, srcRes, savedRes, feedResult] = await Promise.all([
          newsApi.getProfile(),
          newsApi.listSources(),
          newsApi.listSavedArticles(),
          loadFirstPage()
        ])

        if (!isMounted) return
        let loadedProfile = DEFAULT_USER_PROFILE
        if (profRes.ok && profRes.profile) {
          loadedProfile = profRes.profile
          setProfile(loadedProfile)
          if (!loadedProfile.onboardingCompleted) {
            setShowOnboarding(true)
          }
        } else {
          setShowOnboarding(true)
        }

        if (srcRes.ok && Array.isArray(srcRes.sources)) {
          setCuratedSources(srcRes.sources)
        }

        if (savedRes.ok && Array.isArray(savedRes.articles)) {
          setSavedArticles(savedRes.articles)
          setSavedArticleIds(new Set(savedRes.articles.map((a) => a.id || a.url)))
        }

        if (feedResult && !feedResult.ok) {
          setError(feedResult.error || t('app.errorLoading'))
        }

        // Load feedback in background without blocking paint
        newsApi.getFeedFeedback().then((feedbackRes) => {
          if (isMounted && feedbackRes?.ok && feedbackRes.feedback) {
            setFeedback(feedbackRes.feedback)
          }
        }).catch(() => {})
      } catch (err: any) {
        console.error('[momai-noticias:page] Initialization error:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
          initialLoadDone.current = true
        }
      }
    }

    initialize()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Load Feed Articles on Tab / Search change (skips first mount)
  const loadArticles = useCallback(async (topic = activeTab, query = searchQuery) => {
    if (topic === 'saved') return
    const normalizedTopic = topic === 'geral' ? 'paravoce' : topic

    setError(null)
    try {
      if (query.trim()) {
        // Busca em todas as notícias do cache, independente da seção ativa.
        const res = await newsApi.searchNews(query.trim())
        if (res.ok && Array.isArray(res.articles)) {
          setStatic(res.articles, Number(res.total) || res.articles.length)
        }
      } else {
        const result = await loadFirstPage({ topic: normalizedTopic !== 'paravoce' ? normalizedTopic : undefined })
        if (!result.ok) {
          setError(result.error || t('app.errorLoading'))
        }
      }
    } catch (err: any) {
      setError(err?.message || t('app.errorLoading'))
    }
  }, [activeTab, searchQuery, loadFirstPage, setStatic, t])

  useEffect(() => {
    if (showOnboarding) return
    if (!initialLoadDone.current) return // skip first render, initialize handles it

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    if (searchQuery.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        loadArticles(activeTab, searchQuery)
      }, 350)
    } else {
      loadArticles(activeTab, '')
    }

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [activeTab, searchQuery, showOnboarding])

  // 3. Handlers
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await newsApi.refreshFeeds()
      await loadArticles()
    } catch (err) {
      console.error('[momai-noticias:page] Refresh error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handlePageChange = useCallback(
    async (nextPage: number) => {
      if (nextPage === page) return
      scrollFeedToTop(scrollContainerRef.current)
      const result = await goToPage(nextPage)
      if (!result.ok) {
        setError(result.error || t('app.errorLoading'))
      }
      scrollFeedToTop(scrollContainerRef.current)
    },
    [goToPage, page, t]
  )

  const handleToggleSave = async (article: NewsArticle) => {
    const isSaved = savedArticleIds.has(article.id) || savedArticleIds.has(article.url)
    try {
      if (isSaved) {
        await newsApi.removeSavedArticle(article.id)
        setSavedArticleIds((prev) => {
          const next = new Set(prev)
          next.delete(article.id)
          next.delete(article.url)
          return next
        })
        setSavedArticles((prev) => prev.filter((a) => a.id !== article.id && a.url !== article.url))
      } else {
        await newsApi.saveArticle(article.id)
        setSavedArticleIds((prev) => new Set([...prev, article.id, article.url]))
        const newSaved: SavedArticle = { ...article, savedAt: Date.now() }
        setSavedArticles((prev) => [newSaved, ...prev])
        // Record affinity
        newsApi.recordInteraction({
          type: 'save',
          articleId: article.id,
          sourceId: article.sourceId,
          topics: article.canonicalTopics
        })
      }
    } catch (err) {
      console.error('[momai-noticias:page] Save toggle error:', err)
    }
  }

  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticle(article)
    newsApi.recordInteraction({
      type: 'click',
      articleId: article.id,
      sourceId: article.sourceId,
      topics: article.canonicalTopics,
      title: article.title
    })
  }

  // Like/dislike only shifts how much the feed recommends this kind of material
  // (source, topic and headline terms) — nothing is removed from the list.
  const handleFeedback = useCallback(
    async (article: NewsArticle, type: ArticleFeedback) => {
      const next: ArticleFeedback | null = feedback[article.id] === type ? null : type

      setFeedback((current) => {
        const updated = { ...current }
        if (next) updated[article.id] = next
        else delete updated[article.id]
        return updated
      })

      try {
        await newsApi.setArticleFeedback({
          articleId: article.id,
          type: next,
          sourceId: article.sourceId,
          topics: article.canonicalTopics,
          title: article.title
        })
      } catch (err: any) {
        console.error('[momai-noticias:page] Feedback error:', err)
      }
    },
    [feedback]
  )

  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    setShowOnboarding(false)
    setProfile(newProfile)
    await newsApi.updateProfile(newProfile)
    handleRefresh()
  }

  const handleSettingsSave = async (updated: UserProfile) => {
    setProfile(updated)
    await newsApi.updateProfile(updated)
    handleRefresh()
  }

  if (showOnboarding) {
    return (
      <OnboardingModal
        initialProfile={profile}
        curatedSources={curatedSources}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  // Full-Screen Settings View
  if (showSettings) {
    return (
      <SourcesSettingsModal
        profile={profile}
        curatedSources={curatedSources}
        onSave={handleSettingsSave}
        onResetOnboarding={() => {
          setShowSettings(false)
          setShowOnboarding(true)
        }}
        onClose={() => setShowSettings(false)}
      />
    )
  }

  // In-App Article Full-Screen Reader
  if (selectedArticle) {
    return (
      <ArticleReaderView
        article={selectedArticle}
        isSaved={savedArticleIds.has(selectedArticle.id) || savedArticleIds.has(selectedArticle.url)}
        feedback={feedback[selectedArticle.id] || null}
        onFeedback={handleFeedback}
        onToggleSave={handleToggleSave}
        onBack={() => setSelectedArticle(null)}
      />
    )
  }

  const handleTabChange = (newTab: string) => {
    const normalizedTab = newTab === 'geral' ? 'paravoce' : newTab
    setSelectedArticle(null)
    setActiveTab(normalizedTab)
    if (searchQuery) {
      setSearchQuery('')
    }
    scrollFeedToTop(scrollContainerRef.current)
  }

  return (
    <div ref={scrollContainerRef} className={THEME_CLASSES.container}>
      {/* Top Header & Navigation */}
      <NewsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenSettings={() => setShowSettings(true)}
        savedCount={savedArticles.length}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto mt-8 bg-card border border-border rounded-2xl shadow-xs">
            <p className="text-accent font-semibold mb-4">{error}</p>
            <button onClick={() => loadArticles()} className={THEME_CLASSES.buttonPrimary}>
              {t('app.retry')}
            </button>
          </div>
        ) : activeTab === 'saved' ? (
          <SavedArticlesView
            articles={savedArticles}
            onRemoveSaved={handleToggleSave}
            onArticleClick={handleArticleClick}
          />
        ) : (
          <NewsFeed
            articles={articles}
            savedArticleIds={savedArticleIds}
            feedback={feedback}
            isLoading={isLoading}
            isSearching={Boolean(searchQuery.trim())}
            searchQuery={searchQuery}
            onToggleSave={handleToggleSave}
            onFeedback={handleFeedback}
            onArticleClick={handleArticleClick}
            onRefresh={handleRefresh}
            total={total}
            page={page}
            pageCount={pageCount}
            isLoadingPage={isLoadingPage}
            isSyncing={syncing}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  )
}

export default NewsPage
