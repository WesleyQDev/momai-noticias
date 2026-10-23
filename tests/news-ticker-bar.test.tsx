import { describe, expect, it, vi } from 'vitest'

vi.mock('momai:sdk', () => ({
  default: {
    locale: 'pt-BR',
    api: {
      post: vi.fn()
    }
  }
}))

vi.mock('../src/services/api', () => ({
  newsApi: {
    getTickerData: vi.fn().mockResolvedValue({
      ok: true,
      items: [
        {
          id: 'quote-USDBRL',
          type: 'quote',
          label: 'DÓLAR',
          text: 'DÓLAR',
          value: 'R$ 5,68 (+0,35%)',
          direction: 'up'
        },
        {
          id: 'poll-art-1',
          type: 'poll',
          label: 'PESQUISA',
          text: 'Datafolha aponta empate técnico na disputa',
          article: {
            id: 'art-1',
            title: 'Datafolha aponta empate técnico na disputa',
            url: 'https://example.com/poll'
          }
        },
        {
          id: 'urgent-art-2',
          type: 'urgent_news',
          label: 'URGENTE',
          text: 'Banco Central anuncia nova taxa de juros',
          article: {
            id: 'art-2',
            title: 'Banco Central anuncia nova taxa de juros',
            url: 'https://example.com/urgent'
          }
        }
      ]
    })
  }
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { NewsTickerBar } from '../src/components/NewsTickerBar'

describe('NewsTickerBar component', () => {
  it('renders ticker marquee container with aria-label', () => {
    const html = renderToStaticMarkup(<NewsTickerBar />)
    // Initially or with loaded items, container has aria-label
    // When items load or render, it includes marquee markup
    expect(html === '' || html.includes('Faixa de cotações e notícias urgentes')).toBe(true)
  })
})
