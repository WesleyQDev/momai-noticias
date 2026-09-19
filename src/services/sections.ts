// src/services/sections.ts
// Single source of truth for the feed section tabs shown in the header.
// For You is the only general feed; every other entry maps to a filterable topic.

export interface NewsSection {
  id: string
  labelKey: string
}

export const NEWS_SECTIONS: NewsSection[] = [
  { id: 'paravoce', labelKey: 'app.forYou' },
  { id: 'tecnologia', labelKey: 'topics.tecnologia' },
  { id: 'economia', labelKey: 'topics.economia' },
  { id: 'politica', labelKey: 'topics.politica' },
  { id: 'ciencia', labelKey: 'topics.ciencia' },
  { id: 'esportes', labelKey: 'topics.esportes' },
  { id: 'cultura', labelKey: 'topics.cultura' },
  { id: 'games', labelKey: 'topics.games' },
  { id: 'saude', labelKey: 'topics.saude' },
  { id: 'mundo', labelKey: 'topics.mundo' }
]
