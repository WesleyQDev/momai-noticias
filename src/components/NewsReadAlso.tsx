// src/components/NewsReadAlso.tsx
// Coluna lateral "Leia também": as matérias sem imagem da página atual, em
// links compactos.
import React from 'react'
import type { NewsArticle } from '../services/types'
import { useExtensionLocale, formatRelativeTime } from '../services/i18n'

interface NewsReadAlsoProps {
  articles: NewsArticle[]
  onArticleClick: (article: NewsArticle) => void
}

export const NewsReadAlso: React.FC<NewsReadAlsoProps> = ({ articles, onArticleClick }) => {
  const { t } = useExtensionLocale()

  if (articles.length === 0) return null

  return (
    <aside className="sm:col-span-1">
      <div className="border-t-2 border-accent pt-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-text">
          {t('app.readAlso')}
        </h2>
      </div>

      <div>
        {articles.map((article) => (
          <button
            key={article.id || article.url}
            onClick={() => onArticleClick(article)}
            className="group block w-full text-left py-3 border-b border-border/60"
          >
            <h3 className="text-[13px] font-semibold leading-snug text-text group-hover:text-accent transition-colors line-clamp-2">
              {article.title}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className="truncate">{article.sourceName}</span>
              <span>•</span>
              <time className="tabular-nums shrink-0">{formatRelativeTime(article.publishedAt, t)}</time>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
