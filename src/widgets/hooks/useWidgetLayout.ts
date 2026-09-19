import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveStoryLayout, resolveThumbWidth, type StoryLayoutMode } from '../services/storyLayout'

export interface WidgetLayout {
  ref: (node: HTMLElement | null) => void
  mode: StoryLayoutMode
  thumbWidth: number
}

const EMPTY_BOX = { width: 0, height: 0 }

/**
 * Measures the real box of the widget so the card adapts to whatever space
 * the host gives it — size presets and free resizes included. Until the first
 * measurement (or without ResizeObserver) the stacked layout is used.
 */
export function useWidgetLayout(): WidgetLayout {
  const [box, setBox] = useState(EMPTY_BOX)
  const observerRef = useRef<ResizeObserver | null>(null)

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect()
    observerRef.current = null
  }, [])

  const ref = useCallback(
    (node: HTMLElement | null) => {
      disconnect()
      if (!node || typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect
        if (!rect) return
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        setBox((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height }
        )
      })
      observer.observe(node)
      observerRef.current = observer
    },
    [disconnect]
  )

  useEffect(() => disconnect, [disconnect])

  return {
    ref,
    mode: resolveStoryLayout(box.width, box.height),
    thumbWidth: resolveThumbWidth(box.width)
  }
}
