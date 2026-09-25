// src/components/NewsLead.tsx
// Manchete principal: imagem grande à esquerda, texto editorial à direita.
import React, { useState, useEffect } from 'react'
import type { ArticleFeedback, NewsArticle } from '../services/types'
import { useExtensionLocale, formatRelativeTime } from '../services/i18n'

interface NewsLeadProps {
  article: NewsArticle
  isSaved: boolean
  feedback?: ArticleFeedback | null
  onFeedback?: (article: NewsArticle, type: ArticleFeedback) => void
  onToggleSave: (article: NewsArticle) => void
  onArticleClick: (article: NewsArticle) => void
}

export const NewsLead: React.FC<NewsLeadProps> = ({
  article,
  isSaved,
  feedback = null,
  onFeedback,
  onToggleSave,
  onArticleClick
}) => {
  const { t } = useExtensionLocale()
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [article.id, article.image])

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!article.url) return
    navigator.clipboard.writeText(article.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = (event: React.MouseEvent) => {
    event.stopPropagation()
    onToggleSave(article)
  }

  const handleFeedback = (event: React.MouseEvent, type: ArticleFeedback) => {
    event.stopPropagation()
    onFeedback?.(article, type)
  }

  const topic = article.canonicalTopics?.[0] || 'geral'
  const hasImage = Boolean(article.image) && !imageError

  return (
    <article
      onClick={() => onArticleClick(article)}
      className={`group cursor-pointer ${hasImage ? 'grid grid-cols-1 sm:grid-cols-2 gap-5' : 'block'} pt-6 pb-8 border-b border-border`}
    >
      {hasImage && (
        <div className="w-full h-52 overflow-hidden rounded-lg bg-sidebar">
          <img
            src={article.image}
            alt={article.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-accent">{t(`topics.${topic}`)}</span>
          <span className="text-text-muted/70">•</span>
          <span className="text-text-muted truncate">{article.sourceName}</span>
        </div>

        <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-text group-hover:text-accent transition-colors line-clamp-3">
          {article.title}
        </h2>

        {article.summary && (
          <p className="mt-3 text-[13px] leading-relaxed text-text-muted line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between text-[11px] text-text-muted">
          <time className="tabular-nums">{formatRelativeTime(article.publishedAt, t)}</time>
          <div className="flex items-center gap-1">
            <button
              onClick={(event) => handleFeedback(event, 'like')}
              title={t('app.like')}
              className={`p-1.5 transition-colors ${feedback === 'like' ? 'text-accent' : 'text-text-muted hover:text-text'}`}
            >
              <svg className="w-3.5 h-3.5" fill={feedback === 'like' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>
            <button
              onClick={(event) => handleFeedback(event, 'dislike')}
              title={t('app.dislike')}
              className={`p-1.5 transition-colors ${feedback === 'dislike' ? 'text-error' : 'text-text-muted hover:text-text'}`}
            >
              <svg className="w-3.5 h-3.5" fill={feedback === 'dislike' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
            <button
              onClick={handleCopy}
              title={copied ? t('app.copied') : t('app.copyLink')}
              className="p-1.5 text-text-muted hover:text-text transition-colors"
            >
              {copied ? (
                <span className="text-accent font-bold text-xs">✓</span>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              )}
            </button>
            <button
              onClick={handleSave}
              title={isSaved ? t('app.removeSaved') : t('app.save')}
              className={`p-1.5 transition-colors ${isSaved ? 'text-accent' : 'text-text-muted hover:text-text'}`}
            >
              <svg className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
