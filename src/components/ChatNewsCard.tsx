// src/components/ChatNewsCard.tsx
import React from 'react'
import type { NewsArticle } from '../services/types'
import { useExtensionLocale, formatRelativeTime } from '../services/i18n'
import { navigateTo } from '../registry-bridge'
import { THEME_CLASSES } from '../services/theme'
import sdk from 'momai:sdk'

export const ChatNewsCard: React.FC<{ data?: { articles?: NewsArticle[]; query?: string; total?: number } }> = ({ data }) => {
  const { t } = useExtensionLocale()
  const articles = data?.articles || []
  const query = data?.query

  if (articles.length === 0) {
    return (
      <div className={`p-4 rounded-xl border border-border bg-card text-xs text-text-muted`}>
        {query ? t('app.emptySearch') : t('app.emptyFeed')}
      </div>
    )
  }

  return (
    <div className={`p-3.5 rounded-xl border border-border bg-card max-w-lg shadow-sm flex flex-col gap-3 text-xs`}>
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="font-bold text-text flex items-center gap-1.5">
          <span>📰</span> {query ? t('chat.newsAbout', { query }) : t('app.title')}
        </span>
        <span className="text-[11px] text-text-muted">
          {t('app.totalArticles', { count: articles.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {articles.slice(0, 4).map((art) => (
          <a
            key={art.id || art.url}
            href={art.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2.5 p-2 rounded-lg bg-sidebar hover:bg-input transition-colors"
          >
            {art.image && (
              <img
                src={art.image}
                alt=""
                className="w-14 h-14 rounded-md object-cover shrink-0 bg-input"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-text group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                {art.title}
              </h4>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-muted">
                <span className="text-accent font-medium">{art.sourceName}</span>
                <span>•</span>
                <span>{formatRelativeTime(art.publishedAt, t)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                sdk.share?.open({
                  title: art.title,
                  text: art.summary || art.title,
                  url: art.url
                })
              }}
              title={t('app.share')}
              className="p-1.5 self-center text-text-muted hover:text-accent transition-colors shrink-0 rounded-md hover:bg-input"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>
          </a>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigateTo('/extensions/momai-noticias')}
        className={`w-full py-1.5 text-center font-semibold rounded-lg text-xs transition-colors ${THEME_CLASSES.buttonSecondary}`}
      >
        {t('chat.openInApp')} →
      </button>
    </div>
  )
}
