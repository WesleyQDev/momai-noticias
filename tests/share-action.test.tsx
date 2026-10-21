import { describe, expect, it, vi } from 'vitest'

const { mockShareOpen } = vi.hoisted(() => ({
  mockShareOpen: vi.fn().mockResolvedValue({ shared: true })
}))

vi.mock('momai:sdk', () => ({
  default: {
    locale: 'pt-BR',
    share: {
      open: mockShareOpen,
      close: vi.fn()
    }
  }
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { NewsLead } from '../src/components/NewsLead'
import { NewsListItem } from '../src/components/NewsListItem'
import { ArticleReaderView } from '../src/components/ArticleReaderView'
import { ChatNewsCard } from '../src/components/ChatNewsCard'
import type { NewsArticle } from '../src/services/types'

const sampleArticle: NewsArticle = {
  id: 'test-1',
  title: 'Novidades no MomAI',
  summary: 'Resumo sobre a nova funcionalidade de compartilhamento',
  url: 'https://momai.dev/news/1',
  publishedAt: Date.now(),
  categories: [],
  canonicalTopics: ['tecnologia'],
  sourceId: 'momai-blog',
  sourceName: 'MomAI Blog',
  language: 'pt-BR'
}

describe('momai-noticias share integration', () => {
  it('renders share button in NewsLead with title and icon', () => {
    const html = renderToStaticMarkup(
      <NewsLead
        article={sampleArticle}
        isSaved={false}
        onToggleSave={() => {}}
        onArticleClick={() => {}}
      />
    )
    expect(html).toContain('title="Compartilhar"')
    expect(html).toContain('Novidades no MomAI')
  })

  it('renders share button in NewsListItem with title and icon', () => {
    const html = renderToStaticMarkup(
      <NewsListItem
        article={sampleArticle}
        isSaved={false}
        onToggleSave={() => {}}
        onArticleClick={() => {}}
      />
    )
    expect(html).toContain('title="Compartilhar"')
  })

  it('renders share button in ArticleReaderView', () => {
    const html = renderToStaticMarkup(
      <ArticleReaderView
        article={sampleArticle}
        isSaved={false}
        onToggleSave={() => {}}
        onBack={() => {}}
      />
    )
    expect(html).toContain('title="Compartilhar"')
  })

  it('renders share button in ChatNewsCard for articles', () => {
    const html = renderToStaticMarkup(
      <ChatNewsCard data={{ articles: [sampleArticle] }} />
    )
    expect(html).toContain('title="Compartilhar"')
  })
})
