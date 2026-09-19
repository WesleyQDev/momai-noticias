// src/components/SavedArticlesView.tsx
import React from 'react'
import type { SavedArticle, NewsArticle } from '../services/types'
import { NewsListItem } from './NewsListItem'
import { useExtensionLocale } from '../services/i18n'

interface SavedArticlesViewProps {
  articles: SavedArticle[]
  onRemoveSaved: (article: NewsArticle) => void
  onArticleClick: (article: NewsArticle) => void
}

export const SavedArticlesView: React.FC<SavedArticlesViewProps> = ({
  articles,
  onRemoveSaved,
  onArticleClick
}) => {
  const { t } = useExtensionLocale()

  if (articles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h3 className="text-base font-bold text-text mb-1">{t('app.saved')}</h3>
        <p className="text-xs text-text-muted leading-relaxed">{t('app.emptySaved')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
      <div className="flex items-center justify-between border-t-2 border-accent pt-3 mt-6">
        <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-text">
          {t('app.saved')}
        </h2>
        <span className="text-[11px] text-text-muted tabular-nums">
          {t('app.totalArticles', { count: articles.length })}
        </span>
      </div>

      <div>
        {articles.map((article) => (
          <NewsListItem
            key={article.id || article.url}
            article={article}
            isSaved={true}
            onToggleSave={onRemoveSaved}
            onArticleClick={onArticleClick}
          />
        ))}
      </div>
    </div>
  )
}
