import { useEffect, type JSX } from 'react'
import { useExtensionLocale } from '../services/i18n'
import type { WidgetProps } from './types'
import { useHeadlineStory } from './hooks/useHeadlineStory'
import { useWidgetLayout } from './hooks/useWidgetLayout'
import { WidgetLoading, WidgetState } from './components/WidgetState'
import StoryCard from './components/StoryCard'
import type { HeadlineRow } from './services/headlineItems'
import type { NewsArticle } from '../services/types'

export function openStoryInApp(story: HeadlineRow): void {
  const article: NewsArticle = story.article || {
    id: story.id,
    title: story.title,
    url: story.url || '',
    summary: story.summary || '',
    image: story.image,
    publishedAt: story.publishedAt,
    categories: story.categories || [],
    canonicalTopics: story.canonicalTopics || ['geral'],
    sourceId: story.sourceId || '',
    sourceName: story.sourceName || story.source || '',
    language: story.language || 'pt-BR'
  }

  try {
    sessionStorage.setItem('momai_noticias_pending_article', JSON.stringify(article))
    sessionStorage.setItem('momai_noticias_last_active_story', JSON.stringify(article))
  } catch {}

  window.dispatchEvent(new CustomEvent('momai_noticias_open_article', { detail: { article } }))
  window.dispatchEvent(
    new CustomEvent('momai_navigate', {
      detail: { path: '/extensions/momai-noticias', state: { article } }
    })
  )
}

export default function NoticiasHeadlinesWidget({ instanceId, widgetId }: WidgetProps): JSX.Element {
  const { t } = useExtensionLocale()
  const { loading, error, story } = useHeadlineStory(instanceId, widgetId)
  const { ref, mode, thumbWidth } = useWidgetLayout()

  useEffect(() => {
    if (story) {
      try {
        const article = story.article || story
        sessionStorage.setItem('momai_noticias_last_active_story', JSON.stringify(article))
      } catch {}
    }
  }, [story])

  useEffect(() => {
    const handleWidgetAction = (e: Event) => {
      const customEv = e as CustomEvent<{
        actionId?: string
        instanceId?: string
        widgetId?: string
      }>
      const matchAction = customEv.detail?.actionId === 'view_news'
      const matchInstance =
        !customEv.detail?.instanceId || customEv.detail.instanceId === instanceId
      const matchWidget =
        !customEv.detail?.widgetId ||
        customEv.detail.widgetId === widgetId ||
        customEv.detail.widgetId === 'headlines' ||
        customEv.detail.widgetId === 'momai-noticias-headlines-widget'

      if (matchAction && (matchInstance || matchWidget) && story) {
        openStoryInApp(story)
      }
    }

    window.addEventListener('momai_widget_action', handleWidgetAction)
    return () => {
      window.removeEventListener('momai_widget_action', handleWidgetAction)
    }
  }, [instanceId, widgetId, story])

  return (
    <div ref={ref} className="w-full h-full min-h-0 overflow-hidden">
      {loading ? (
        <WidgetLoading message={t('widget.headlines.loading')} />
      ) : error ? (
        <WidgetState title={t('widget.headlines.title')} message={error} />
      ) : story ? (
        <StoryCard
          story={story}
          mode={mode}
          thumbWidth={thumbWidth}
          onClick={() => openStoryInApp(story)}
        />
      ) : (
        <WidgetState title={t('widget.headlines.title')} message={t('widget.headlines.empty')} />
      )}
    </div>
  )
}

import { translate } from '../services/i18n'

NoticiasHeadlinesWidget.contextMenu = [
  {
    id: 'view_news',
    label: translate('widget.headlines.viewNews'),
    action: 'view_news'
  }
]

// Keep the host contract explicit: widgets receive these props.
export type { WidgetProps }

