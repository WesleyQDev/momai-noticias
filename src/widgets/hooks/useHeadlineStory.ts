import { useCallback, useEffect, useRef, useState } from 'react'
import { useExtensionEvents } from 'momai:events'
import { fetchHeadlineStories } from '../services/widgetNews'
import { orderStoriesByPhoto, pickNextStory } from '../services/storyRotation'
import type { HeadlineRow } from '../services/headlineItems'

const BATCH_SIZE = 20
const QUEUE_REFRESH_MS = 5 * 60_000

interface HeadlineStoryState {
  loading: boolean
  error: string
  story: HeadlineRow | null
}

/**
 * Keeps one story on display and swaps it for a new one whenever this
 * instance becomes the visible item of its group (generic `widget_activated`
 * hook), so rotating carousels always land on fresh content. Stories with a
 * photo are preferred; the batch is refreshed in the background so the queue
 * does not go stale in long sessions.
 */
export function useHeadlineStory(
  instanceId?: string,
  widgetId?: string,
  topic?: string
): HeadlineStoryState {
  const key = instanceId || widgetId || 'headlines'
  const activeTopic = topic || ''
  const [story, setStory] = useState<HeadlineRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const queueRef = useRef<HeadlineRow[]>([])
  const storyIdRef = useRef<string | null>(null)
  const requestRef = useRef(0)
  const topicRef = useRef(activeTopic)
  const seedRef = useRef(`${key}:${activeTopic}:${new Date().toISOString().slice(0, 10)}`)

  const fillQueue = useCallback(async () => {
    const rows = orderStoriesByPhoto(
      await fetchHeadlineStories(BATCH_SIZE, activeTopic || undefined, seedRef.current),
      seedRef.current
    )
    queueRef.current = rows
    return rows
  }, [activeTopic, key])

  const advance = useCallback(async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    try {
      let pick = pickNextStory(queueRef.current, storyIdRef.current)
      if (!pick.story) {
        pick = pickNextStory(await fillQueue(), storyIdRef.current)
      }
      if (requestId !== requestRef.current) return
      queueRef.current = pick.remaining
      if (pick.story) {
        storyIdRef.current = pick.story.id
        setStory(pick.story)
      }
      setLoading(false)
      setError('')
    } catch (err) {
      if (requestId !== requestRef.current) return
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Load failed.')
    }
  }, [fillQueue])

  useEffect(() => {
    void advance()
  }, [advance])

  // A topic change from the customize flow restarts the queue so the widget
  // immediately reflects the new filter instead of draining old stories.
  useEffect(() => {
    if (topicRef.current === activeTopic) return
    topicRef.current = activeTopic
    seedRef.current = `${key}:${activeTopic}:${new Date().toISOString().slice(0, 10)}`
    queueRef.current = []
    storyIdRef.current = null
    setStory(null)
    setLoading(true)
    setError('')
    void advance()
  }, [activeTopic, advance, key])

  useEffect(() => {
    const timer = setInterval(() => {
      void fillQueue().catch(() => {
        // Background refresh only: the story on screen stays untouched.
      })
    }, QUEUE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [fillQueue])

  const handleEvent = useCallback(
    (event: any) => {
      if (!event || event.eventType !== 'widget_activated') return
      const data = event.data ?? {}
      const mine = key !== 'headlines' && (data.instanceId === key || data.widgetId === key)
      if (!mine) return
      void advance()
    },
    [key, advance]
  )
  useExtensionEvents({ onEvent: handleEvent })

  return { loading, error, story }
}
