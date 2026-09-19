// src/services/theme.ts
// Semantic CSS helpers matching MomAI host tokens

export const THEME_CLASSES = {
  container: 'w-full h-full flex flex-col bg-bg text-text overflow-y-auto font-sans',
  card: 'bg-card border border-border rounded-2xl shadow-xs transition-all duration-200 hover:shadow-md hover:border-border',
  cardHighlight: 'bg-card border border-accent/40 rounded-2xl shadow-sm',
  buttonPrimary: 'bg-accent text-white font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed',
  buttonSecondary: 'bg-sidebar text-text border border-border font-medium px-4 py-2 rounded-lg transition-colors hover:bg-input focus:outline-none disabled:opacity-50',
  buttonGhost: 'text-text-muted hover:text-text hover:bg-sidebar p-2 rounded-lg transition-colors',
  badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sidebar text-text-muted border border-border/60',
  badgeAccent: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent border border-accent/30',
  input: 'bg-input text-text placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent'
}
