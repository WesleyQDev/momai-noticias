import { useEffect, useState, type JSX } from 'react'
import { formatRelativeTime, useExtensionLocale } from '../../services/i18n'
import type { HeadlineRow } from '../services/headlineItems'
import type { StoryLayoutMode } from '../services/storyLayout'

interface Props {
  story: HeadlineRow
  mode: StoryLayoutMode
  thumbWidth: number
  onClick?: () => void
}

/**
 * One story, laid out for the space available: thumbnail beside the text when
 * the box is wide, photo over the text when it is square or tall. A photo that
 * fails to load is dropped instead of leaving a broken frame.
 */
export default function StoryCard({ story, mode, thumbWidth, onClick }: Props): JSX.Element {
  const { t } = useExtensionLocale()
  const [brokenImageId, setBrokenImageId] = useState<string | null>(null)

  // A different story deserves a fresh attempt at its photo.
  useEffect(() => {
    setBrokenImageId(null)
  }, [story.id])

  const photo = story.image && brokenImageId !== story.id ? story.image : null
  const relativeTime = story.publishedAt ? formatRelativeTime(story.publishedAt, t) : ''

  const text = (
    <div
      className={`flex flex-col gap-1 min-w-0 ${
        mode === 'row' ? 'flex-1 justify-center px-3 py-2' : 'shrink-0 px-3 py-2'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wide text-accent truncate">
          {story.source}
        </span>
        {relativeTime ? (
          <span className="text-[10px] text-text-muted shrink-0">{relativeTime}</span>
        ) : null}
      </div>
      <span
        className={`text-xs font-semibold text-text leading-snug ${
          mode === 'row' ? 'line-clamp-4' : 'line-clamp-3'
        }`}
      >
        {story.title}
      </span>
    </div>
  )

  if (mode === 'row') {
    return (
      <div
        onClick={onClick}
        className={`w-full h-full flex items-stretch min-h-0 overflow-hidden rounded-xl ${
          onClick ? 'cursor-pointer select-none hover:opacity-95 transition-opacity' : ''
        }`}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            draggable={false}
            onError={() => setBrokenImageId(story.id)}
            style={{ width: thumbWidth }}
            className="h-full object-cover shrink-0 bg-input/40"
          />
        ) : null}
        {text}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`w-full h-full flex flex-col min-h-0 overflow-hidden rounded-xl ${
        photo ? '' : 'justify-center'
      } ${onClick ? 'cursor-pointer select-none hover:opacity-95 transition-opacity' : ''}`}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setBrokenImageId(story.id)}
          className="w-full flex-1 min-h-0 object-cover bg-input/40"
        />
      ) : null}
      {text}
    </div>
  )
}

