// src/components/NewsHeader.tsx
// Cabeçalho editorial: marca, busca em fio, ações discretas e faixa de seções.
import React from 'react'
import { useExtensionLocale } from '../services/i18n'
import { NEWS_SECTIONS } from '../services/sections'

interface NewsHeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  onOpenSettings: () => void
  savedCount: number
}

const SECTIONS = NEWS_SECTIONS

export const NewsHeader: React.FC<NewsHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  savedCount
}) => {
  const { t } = useExtensionLocale()

  const searchField = (
    <div className="flex items-center gap-2 border-b border-border">
      <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('app.searchPlaceholder')}
        className="flex-1 bg-transparent py-2 text-xs text-text placeholder:text-text-muted focus:outline-none"
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange('')}
          className="text-text-muted hover:text-text text-xs pr-4"
        >
          ✕
        </button>
      )}
    </div>
  )

  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-border shrink-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center gap-4">
          <button
            onClick={() => onTabChange('paravoce')}
            className="flex items-baseline gap-1.5 shrink-0"
            title={t('app.title')}
          >
            <span className="text-lg font-extrabold tracking-tight text-text">MomAI</span>
            <span className="text-lg font-extrabold tracking-tight text-accent">Notícias</span>
          </button>

          <div className="hidden sm:block flex-1 max-w-md mx-auto">{searchField}</div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t('app.refresh')}
              className="flex items-center gap-1.5 px-2 py-2 text-xs font-semibold text-text-muted hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{t('app.refresh')}</span>
            </button>

            <button
              onClick={() => onTabChange('saved')}
              title={t('app.saved')}
              className={`flex items-center gap-1.5 px-2 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'saved' ? 'text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-4 h-4" fill={activeTab === 'saved' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="hidden sm:inline">{t('app.saved')}</span>
              {savedCount > 0 && <span className="tabular-nums">({savedCount})</span>}
            </button>

            <button
              onClick={onOpenSettings}
              title={t('app.settings')}
              className="p-2 text-text-muted hover:text-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="sm:hidden pb-3">{searchField}</div>

        {/* Faixa de seções: cabe em uma linha no desktop; em janelas estreitas
            rola na horizontal sem exibir a barra de rolagem. */}
        <nav
          className="flex items-center gap-5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {SECTIONS.map((section) => {
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => onTabChange(section.id)}
                className={`relative shrink-0 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                  isActive ? 'text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                {t(section.labelKey)}
                {isActive && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent" />}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
