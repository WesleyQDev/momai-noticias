import { describe, expect, it, vi } from 'vitest'

vi.mock('momai:sdk', () => ({ default: { locale: 'pt-BR' } }))

import { renderToStaticMarkup } from 'react-dom/server'
import StoryCard from '../src/widgets/components/StoryCard'

const story = {
  id: 'story-1',
  title: 'EUA e China propõem regras de segurança para IA',
  source: 'INFOMONEY',
  image: 'https://example.com/photo.jpg',
  publishedAt: Date.now() - 2 * 60 * 60 * 1000
}

describe('headlines story card corners', () => {
  it('rounds the photo card in side-by-side mode so it follows the widget card', () => {
    const markup = renderToStaticMarkup(<StoryCard story={story} mode="row" thumbWidth={99} />)

    expect(markup).toContain('overflow-hidden')
    expect(markup).toContain('rounded-xl')
    expect(markup).toContain('object-cover')
  })

  it('rounds the photo card in stacked mode so it follows the widget card', () => {
    const markup = renderToStaticMarkup(<StoryCard story={story} mode="stack" thumbWidth={99} />)

    expect(markup).toContain('overflow-hidden')
    expect(markup).toContain('rounded-xl')
    expect(markup).toContain('object-cover')
  })
})
