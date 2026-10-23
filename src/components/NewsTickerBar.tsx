// src/components/NewsTickerBar.tsx
// Faixa de cotações de mercado e notícias urgentes/pesquisas em letreiro contínuo
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { newsApi } from '../services/api'
import { useExtensionLocale } from '../services/i18n'
import type { TickerItem, NewsArticle } from '../services/types'

interface NewsTickerBarProps {
  onArticleClick?: (article: NewsArticle) => void
  onQuoteClick?: (quoteLabel: string) => void
  isRefreshing?: boolean
}

export const NewsTickerBar: React.FC<NewsTickerBarProps> = ({
  onArticleClick,
  onQuoteClick,
  isRefreshing
}) => {
  const { t } = useExtensionLocale()
  const [items, setItems] = useState<TickerItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)

  const loadTicker = useCallback(async () => {
    try {
      const res = await newsApi.getTickerData()
      if (isMountedRef.current && res.ok && Array.isArray(res.items) && res.items.length > 0) {
        setItems(res.items)
      }
    } catch {
      // Graceful offline fallback
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadTicker()

    // Refresh ticker every 5 minutes
    const interval = setInterval(loadTicker, 5 * 60 * 1000)
    return () => {
      isMountedRef.current = false
      clearInterval(interval)
    }
  }, [loadTicker])

  useEffect(() => {
    if (isRefreshing) {
      loadTicker()
    }
  }, [isRefreshing, loadTicker])

  if (isLoading && items.length === 0) {
    return null
  }

  if (items.length === 0) {
    return null
  }

  // Duplicate items array once to achieve seamless continuous loop
  const displayItems = [...items, ...items]

  return (
    <div
      className="group relative w-full h-9 overflow-hidden bg-sidebar/95 border-y border-border/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] flex items-center select-none text-xs"
      role="region"
      aria-label={t('app.ticker.ariaLabel')}
    >
      <style>{`
        @keyframes ticker-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ticker-marquee {
          animation: ticker-marquee 115s linear infinite;
        }
        .animate-ticker-marquee:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-ticker-marquee {
            animation: none;
            overflow-x: auto;
          }
        }
      `}</style>

      {/* Fade masks on both ends for smooth visual ingress/egress */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-sidebar to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-sidebar to-transparent z-10" />

      {/* Scrolling track */}
      <div className="flex items-center whitespace-nowrap animate-ticker-marquee cursor-default will-change-transform">
        {displayItems.map((item, idx) => {
          const isClickable = Boolean(item.article && onArticleClick)

          return (
            <div
              key={`${item.id}-${idx}`}
              className="inline-flex items-center mx-5 transition-colors"
            >
              {/* Separator Diamond */}
              <span className="text-text-muted/40 text-[9px] mr-3.5 select-none" aria-hidden="true">
                ◆
              </span>

              {/* Item content */}
              {item.type === 'quote' ? (
                <button
                  type="button"
                  onClick={() => onQuoteClick?.(item.label)}
                  className="inline-flex items-center gap-2 font-mono text-[11px] px-2 py-0.5 rounded-md border border-transparent transition-all duration-200 cursor-pointer hover:bg-card hover:border-border hover:shadow-xs hover:scale-[1.03] active:scale-[0.98]"
                  title={t('app.ticker.quoteTitle', { quote: item.label }) || `${item.label}: ${item.value}`}
                >
                  <span className="font-black tracking-wider text-text-muted text-[10px] uppercase">
                    {item.label}
                  </span>
                  <span className="font-semibold text-text">
                    {item.value}
                  </span>
                  {item.direction === 'up' && (
                    <span className="text-success font-bold text-[10px]">▲</span>
                  )}
                  {item.direction === 'down' && (
                    <span className="text-error font-bold text-[10px]">▼</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (item.article && onArticleClick) {
                      onArticleClick(item.article)
                    }
                  }}
                  disabled={!isClickable}
                  className={`inline-flex items-center gap-1.5 text-left text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md border border-transparent transition-all duration-200 ${
                    isClickable
                      ? 'text-text cursor-pointer hover:bg-card hover:border-border hover:shadow-xs hover:scale-[1.03] active:scale-[0.98]'
                      : 'text-text/90'
                  }`}
                  title={item.text}
                >
                  {/* Category Prefix without boxed highlight */}
                  {item.type === 'poll' && (
                    <span className="font-black text-text-muted text-[10px] uppercase tracking-wider shrink-0">
                      {t('app.ticker.poll') || 'PESQUISA'} •
                    </span>
                  )}
                  {item.type === 'urgent_news' && (
                    <span className="font-black text-error text-[10px] uppercase tracking-wider shrink-0">
                      {t('app.ticker.urgent') || 'URGENTE'} •
                    </span>
                  )}
                  {item.type === 'headline' && (
                    <span className="font-bold text-text-muted text-[10px] uppercase tracking-wider shrink-0">
                      {t('app.ticker.headline') || 'DESTAQUE'} •
                    </span>
                  )}

                  {/* Title / Headline text */}
                  <span className="truncate max-w-[380px] sm:max-w-[460px] md:max-w-[560px]">
                    {item.text}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NewsTickerBar
