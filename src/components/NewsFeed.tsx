// src/components/NewsFeed.tsx
// Layout editorial: uma manchete principal e a lista de matérias com fios
// finos, mais os controles de página no rodapé.
import React from 'react'
import type { ArticleFeedback, NewsArticle } from '../services/types'
import { NewsLead } from './NewsLead'
import { NewsListItem } from './NewsListItem'
import { NewsReadAlso } from './NewsReadAlso'
import { FeedPagination } from './FeedPagination'
import { useExtensionLocale } from '../services/i18n'
import { THEME_CLASSES } from '../services/theme'

interface NewsFeedProps {
  articles: NewsArticle[]
  savedArticleIds: Set<string>
  feedback: Record<string, ArticleFeedback>
  isLoading: boolean
  isSearching: boolean
  searchQuery: string
  onToggleSave: (article: NewsArticle) => void
  onFeedback: (article: NewsArticle, type: ArticleFeedback) => void
  onArticleClick: (article: NewsArticle) => void
  onRefresh: () => void
  total?: number
  page?: number
  pageCount?: number
  isLoadingPage?: boolean
  isSyncing?: boolean
  onPageChange?: (page: number) => void
}

export const NewsFeed: React.FC<NewsFeedProps> = ({
  articles,
  savedArticleIds,
  feedback,
  isLoading,
  isSearching,
  searchQuery,
  onToggleSave,
  onFeedback,
  onArticleClick,
  onRefresh,
  total = 0,
  page = 1,
  pageCount = 1,
  isLoadingPage = false,
  isSyncing = false,
  onPageChange
}) => {
  const { t } = useExtensionLocale()

  if (isLoading && articles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-8 border-b border-border">
          <div className="h-52 rounded-lg bg-sidebar animate-pulse" />
          <div className="space-y-3 py-3">
            <div className="h-3 w-32 bg-sidebar rounded animate-pulse" />
            <div className="h-6 w-full bg-sidebar rounded animate-pulse" />
            <div className="h-6 w-64 bg-sidebar rounded animate-pulse" />
            <div className="h-3 w-40 bg-sidebar rounded animate-pulse" />
          </div>
        </div>
        <div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-start gap-4 py-5 border-b border-border/60">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-40 bg-sidebar rounded animate-pulse" />
                <div className="h-4 w-full bg-sidebar rounded animate-pulse" />
                <div className="h-4 w-56 bg-sidebar rounded animate-pulse" />
              </div>
              <div className="w-32 h-20 shrink-0 rounded-md bg-sidebar animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h3 className="text-base font-bold text-text mb-1">
          {isSearching ? t('app.emptySearch') : t('app.emptyFeed')}
        </h3>
        <p className="text-xs text-text-muted mb-5">
          {isSearching ? `"${searchQuery}"` : t('app.subtitle')}
        </p>
        <button onClick={onRefresh} className={THEME_CLASSES.buttonPrimary}>
          {t('app.refresh')}
        </button>
      </div>
    )
  }

  const showLead = !isSearching
  const withImage = articles.filter((article) => Boolean(article.image))
  const withoutImage = articles.filter((article) => !article.image)
  // A manchete principal só entra com imagem; sem nenhuma, cai para o topo.
  const lead = showLead ? withImage[0] || articles[0] : null
  const listArticles = showLead ? withImage.filter((article) => article !== lead) : articles
  const readAlso = showLead ? withoutImage : []
  const hasReadAlso = readAlso.length > 0
  const totalLabel = t('app.totalArticles', { count: total })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
      {lead && (
        <NewsLead
          key={lead.id || lead.url}
          article={lead}
          isSaved={savedArticleIds.has(lead.id) || savedArticleIds.has(lead.url)}
          feedback={feedback[lead.id] || null}
          onFeedback={onFeedback}
          onToggleSave={onToggleSave}
          onArticleClick={onArticleClick}
        />
      )}

      <div className={`grid grid-cols-1 gap-10 mt-8 ${hasReadAlso ? 'sm:grid-cols-3' : ''}`}>
        <div className={hasReadAlso ? 'sm:col-span-2' : ''}>
          <div className="flex items-center justify-between border-t-2 border-accent pt-3">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-text">
              {isSearching ? t('app.searchResults') : t('app.moreNews')}
            </h2>
            <span className="flex items-center gap-2 text-[11px] text-text-muted tabular-nums">
              {isSyncing && !isSearching && (
                <span className="flex items-center gap-1.5 text-accent">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('app.updatingFeed')}
                </span>
              )}
              {totalLabel}
            </span>
          </div>

          <div>
            {listArticles.map((article) => (
              <NewsListItem
                key={article.id || article.url}
                article={article}
                isSaved={savedArticleIds.has(article.id) || savedArticleIds.has(article.url)}
                feedback={feedback[article.id] || null}
                onFeedback={onFeedback}
                onToggleSave={onToggleSave}
                onArticleClick={onArticleClick}
              />
            ))}
            {isSyncing && !isSearching && listArticles.length < 4 && (
              <div className="space-y-4 pt-1 opacity-70">
                {[...Array(Math.max(1, 4 - listArticles.length))].map((_, i) => (
                  <div key={`sync-slot-${i}`} className="flex items-start gap-4 py-5 border-b border-border/60 animate-pulse">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-32 bg-sidebar rounded" />
                      <div className="h-4 w-full bg-sidebar rounded" />
                      <div className="h-4 w-48 bg-sidebar rounded" />
                    </div>
                    <div className="w-32 h-20 shrink-0 rounded-md bg-sidebar" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isSearching && (
            <>
              {isLoadingPage && (
                <div className="flex items-center justify-center gap-2 pt-6 text-[11px] text-text-muted">
                  <svg className="w-3.5 h-3.5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t('app.loadingMore')}</span>
                </div>
              )}
              {onPageChange && (
                <FeedPagination
                  page={page}
                  pageCount={pageCount}
                  isLoading={isLoadingPage}
                  onPageChange={onPageChange}
                />
              )}
            </>
          )}
        </div>

        <NewsReadAlso articles={readAlso} onArticleClick={onArticleClick} />
      </div>
    </div>
  )
}
