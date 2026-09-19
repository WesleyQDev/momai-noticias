// src/components/ChatNewsCard.tsx
import React from 'react'
import type { NewsArticle } from '../services/types'
import { useExtensionLocale, formatRelativeTime } from '../services/i18n'
import { navigateTo } from '../registry-bridge'
import { THEME_CLASSES } from '../services/theme'

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
          <span>📰</span> {query ? `Notícias sobre "${query}"` : t('app.title')}
        </span>
        <span className="text-[11px] text-text-muted">
          {articles.length} notícias
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
