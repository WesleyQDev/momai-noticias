import React, { useState, useEffect, useRef } from 'react'
import type { ArticleFeedback, NewsArticle } from '../services/types'
import { useExtensionLocale } from '../services/i18n'
import { THEME_CLASSES } from '../services/theme'

interface ArticleReaderViewProps {
  article: NewsArticle
  isSaved?: boolean
  feedback?: ArticleFeedback | null
  onFeedback?: (article: NewsArticle, type: ArticleFeedback) => void
  onToggleSave: (article: NewsArticle) => void
  onBack: () => void
}

export const ArticleReaderView: React.FC<ArticleReaderViewProps> = ({
  article,
  isSaved = false,
  feedback = null,
  onFeedback,
  onToggleSave,
  onBack
}) => {
  const { t } = useExtensionLocale()
  const [copied, setCopied] = useState(false)
  const [isLoadingIframe, setIsLoadingIframe] = useState(true)
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Escape key handler to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack])

  const handleCopyLink = () => {
    if (article.url) {
      navigator.clipboard.writeText(article.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenExternal = () => {
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleReload = () => {
    setIsLoadingIframe(true)
    setIframeKey((k) => k + 1)
  }

  let domain = article.sourceName
  try {
    if (article.url) {
      domain = new URL(article.url).hostname.replace(/^www\./, '')
    }
  } catch {}


  return (
    <div className="w-full h-full flex flex-col bg-bg text-text overflow-hidden font-sans">
      {/* Top Browser Bar */}
      <div className="bg-card border-b border-border shadow-xs px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Back & Refresh buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBack}
            className={`${THEME_CLASSES.buttonSecondary} !py-1.5 !px-3 text-xs flex items-center gap-1.5`}
            title={t('app.backToFeed')}
          >
            <span>←</span>
            <span className="font-semibold hidden sm:inline">{t('app.back')}</span>
          </button>

          <button
            onClick={handleReload}
            className={`${THEME_CLASSES.buttonGhost} p-1.5`}
            title={t('app.reload')}
          >
            <svg className={`w-3.5 h-3.5 ${isLoadingIframe ? 'animate-spin text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Center: Address / Page Title pill */}
        <div className="flex-1 max-w-xl flex items-center justify-center min-w-0">
          <div className="w-full bg-sidebar border border-border/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs min-w-0">
            <span className="text-accent text-[11px] shrink-0">🔒</span>
            <span className="font-semibold text-text truncate">
              {article.title}
            </span>
            <span className="text-text-muted shrink-0 text-[10px] hidden sm:inline">
              ({domain})
            </span>
          </div>
        </div>

        {/* Right: Feedback, Share, Save, and External Open */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onFeedback?.(article, 'like')}
            title={t('app.like')}
            className={`${THEME_CLASSES.buttonGhost} p-1.5 ${feedback === 'like' ? 'text-accent' : ''}`}
          >
            <svg className="w-3.5 h-3.5" fill={feedback === 'like' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button
            onClick={() => onFeedback?.(article, 'dislike')}
            title={t('app.dislike')}
            className={`${THEME_CLASSES.buttonGhost} p-1.5 ${feedback === 'dislike' ? 'text-error' : ''}`}
          >
            <svg className="w-3.5 h-3.5" fill={feedback === 'dislike' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>

          <button
            onClick={handleCopyLink}
            title={copied ? t('app.copied') : t('app.copyLink')}
            className={`${THEME_CLASSES.buttonGhost} p-1.5`}
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
            onClick={() => onToggleSave(article)}
            className={`${THEME_CLASSES.buttonGhost} p-1.5 ${isSaved ? 'text-accent' : ''}`}
            title={isSaved ? t('app.removeSaved') : t('app.save')}
          >
            <svg className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          <button
            onClick={handleOpenExternal}
            className={`${THEME_CLASSES.buttonPrimary} !py-1 !px-2.5 text-xs flex items-center gap-1`}
            title={t('app.openInBrowser')}
          >
            <span className="hidden sm:inline">{t('app.browser')}</span>
            <span>↗</span>
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {isLoadingIframe && (
        <div className="w-full h-0.5 bg-sidebar overflow-hidden shrink-0">
          <div className="w-full h-full bg-accent animate-pulse" />
        </div>
      )}

      {/* Direct In-App Live Article Viewer */}
      <div className="flex-1 w-full h-full relative bg-white">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={article.url}
          title={article.title}
          onLoad={() => setIsLoadingIframe(false)}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-read; clipboard-write; encrypted-media; gyroscope; accelerometer; web-share"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-downloads"
        />
      </div>
    </div>
  )
}
