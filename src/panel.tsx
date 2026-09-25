// src/panel.tsx
// MomAI Notícias side panel and structured chat card renderer registrations

import React, { useEffect, useState } from 'react'
import { registerRenderer, navigateTo } from './registry-bridge'
import { ChatNewsCard } from './components/ChatNewsCard'
import { ChatBriefingCard } from './components/ChatBriefingCard'
import { newsApi } from './services/api'
import { useExtensionLocale, formatRelativeTime } from './services/i18n'
import { THEME_CLASSES } from './services/theme'
import type { NewsArticle } from './services/types'

// Register rich cards for chat structured responses
registerRenderer('news_feed', ChatNewsCard)
registerRenderer('news_feed_card', ChatNewsCard)
registerRenderer('news_search', ChatNewsCard)
registerRenderer('news_briefing', ChatBriefingCard)
registerRenderer('news_briefing_card', ChatBriefingCard)

export default function MomAINoticiasPanel() {
  const { t } = useExtensionLocale()
  const [topHeadlines, setTopHeadlines] = useState<NewsArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const day = new Date().toISOString().slice(0, 10)
    newsApi.getFeed({ limit: 5, seed: `panel:${day}` }).then((res) => {
      if (isMounted && res.ok && Array.isArray(res.articles)) {
        setTopHeadlines(res.articles)
      }
      if (isMounted) setIsLoading(false)
    }).catch(() => {
      if (isMounted) setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="p-3.5 flex flex-col gap-3 text-xs bg-bg min-h-full">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-bold text-text">
          <span>📰</span>
          <span>{t('app.title')}</span>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('/extensions/momai-noticias')}
          className="text-[11px] text-accent font-semibold hover:underline"
        >
          {t('chat.viewMore')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-sidebar animate-pulse" />
          ))}
        </div>
      ) : topHeadlines.length === 0 ? (
        <p className="text-text-muted text-center py-4">
          {t('app.emptyFeed')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {topHeadlines.map((art) => (
            <a
              key={art.id || art.url}
              href={art.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-2 rounded-lg bg-card hover:bg-input border border-border transition-colors"
            >
              <h4 className="font-semibold text-text group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                {art.title}
              </h4>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-muted">
                <span className="text-accent">{art.sourceName}</span>
                <span>•</span>
                <span>{formatRelativeTime(art.publishedAt, t)}</span>
              </div>
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigateTo('/extensions/momai-noticias')}
        className={`w-full py-2 rounded-lg text-xs font-semibold text-center ${THEME_CLASSES.buttonPrimary}`}
      >
        {t('chat.openInApp')}
      </button>
    </div>
  )
}
