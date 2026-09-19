// src/components/ChatBriefingCard.tsx
import React from 'react'
import type { BriefingResponse } from '../services/types'
import { useExtensionLocale, formatRelativeTime } from '../services/i18n'
import { navigateTo } from '../registry-bridge'
import { THEME_CLASSES } from '../services/theme'

export const ChatBriefingCard: React.FC<{ data?: BriefingResponse }> = ({ data }) => {
  const { t } = useExtensionLocale()
  const briefing = data?.briefing || []

  if (briefing.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-border bg-card text-xs text-text-muted">
        {t('app.emptyFeed')}
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card max-w-xl shadow-sm flex flex-col gap-3.5 text-xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">☕</span>
          <h3 className="font-bold text-text text-sm">
            {t('chat.briefingTitle')}
          </h3>
        </div>
        <span className="text-[10px] text-text-muted">
          {new Date().toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-3">
        {briefing.map((section) => (
          <div key={section.topic} className="space-y-1.5">
            <h4 className="font-bold text-accent text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span>•</span> {section.topicLabel}
            </h4>
            <div className="space-y-1 pl-2">
              {section.articles.map((art) => (
                <a
                  key={art.id || art.url}
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group p-1.5 rounded bg-sidebar hover:bg-input transition-colors"
                >
                  <div className="font-medium text-text group-hover:text-accent transition-colors line-clamp-1">
                    {art.title}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {art.sourceName} • {formatRelativeTime(art.publishedAt, t)}
                  </div>
                </a>
              ))}
            </div>
          </div>
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
