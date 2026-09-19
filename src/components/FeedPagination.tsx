// src/components/FeedPagination.tsx
// Controles de página discretos, no estilo de rodapé de portal.
import React from 'react'
import { buildPageWindow } from '../services/feed-pages'
import { useExtensionLocale } from '../services/i18n'

interface FeedPaginationProps {
  page: number
  pageCount: number
  isLoading: boolean
  onPageChange: (page: number) => void
}

export const FeedPagination: React.FC<FeedPaginationProps> = ({ page, pageCount, isLoading, onPageChange }) => {
  const { t } = useExtensionLocale()

  if (pageCount <= 1) return null

  const numbers = buildPageWindow(page, pageCount)
  const firstNumber = numbers[0]
  const lastNumber = numbers[numbers.length - 1]
  const isFirst = page <= 1
  const isLast = page >= pageCount

  const numberClass = (isActive: boolean) =>
    `relative px-2.5 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      isActive ? 'text-text font-extrabold' : 'text-text-muted hover:text-text'
    }`

  return (
    <nav
      className="flex items-center justify-center gap-0.5 pt-8"
      aria-label={t('app.pageOf', { page, pages: pageCount })}
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={isFirst || isLoading}
        className="px-2.5 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ‹ {t('app.previous')}
      </button>

      {firstNumber > 1 && (
        <>
          <button onClick={() => onPageChange(1)} disabled={isLoading} className={numberClass(page === 1)}>
            1
          </button>
          {firstNumber > 2 && <span className="px-1 text-xs text-text-muted">…</span>}
        </>
      )}

      {numbers.map((number) => (
        <button
          key={number}
          onClick={() => onPageChange(number)}
          disabled={isLoading}
          aria-current={number === page ? 'page' : undefined}
          className={numberClass(number === page)}
        >
          {number}
          {number === page && <span className="absolute left-1.5 right-1.5 bottom-0 h-0.5 bg-accent" />}
        </button>
      ))}

      {lastNumber < pageCount && (
        <>
          {lastNumber < pageCount - 1 && <span className="px-1 text-xs text-text-muted">…</span>}
          <button onClick={() => onPageChange(pageCount)} disabled={isLoading} className={numberClass(page === pageCount)}>
            {pageCount}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={isLast || isLoading}
        className="px-2.5 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('app.next')} ›
      </button>
    </nav>
  )
}
