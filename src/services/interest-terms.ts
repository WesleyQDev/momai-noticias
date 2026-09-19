// src/services/interest-terms.ts
// Termos do título: o sinal mais específico do que o usuário gosta. A categoria
// é grossa demais para separar "inteligência artificial" de "smartphone".

const STOPWORDS = new Set([
  // pt-BR
  'a', 'as', 'o', 'os', 'ao', 'aos', 'de', 'da', 'das', 'do', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas', 'que', 'para', 'por', 'com', 'sem', 'sobre', 'entre',
  'ate', 'apos', 'desde', 'como', 'quando', 'onde', 'seu', 'sua', 'seus', 'suas', 'este', 'esta',
  'estes', 'estas', 'esse', 'essa', 'esses', 'essas', 'isso', 'isto', 'aquele', 'aquela', 'foi', 'sao',
  'ser', 'esta', 'estao', 'tem', 'ter', 'havia', 'ja', 'nao', 'sim', 'mais', 'menos', 'muito', 'muita',
  'tambem', 'apenas', 'ainda', 'depois', 'antes', 'durante', 'contra', 'pelo', 'pela', 'pelos', 'pelas',
  'num', 'numa', 'aqui', 'agora', 'hoje', 'ontem', 'amanha', 'diz', 'dizem', 'afirma', 'pode', 'podem',
  'deve', 'vai', 'vao', 'faz', 'fazem', 'fez', 'novo', 'nova', 'novos', 'novas', 'primeiro', 'ultimo',
  'meio', 'partir', 'todo', 'toda', 'todos', 'todas', 'outro', 'outra', 'outros', 'outras',
  // en (feeds em inglês)
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'after', 'before', 'about', 'over',
  'under', 'while', 'when', 'where', 'will', 'would', 'could', 'should', 'have', 'has', 'had', 'are',
  'was', 'were', 'been', 'being', 'not', 'but', 'you', 'your', 'his', 'her', 'their', 'they', 'what'
])

const MIN_TERM_LENGTH = 4
const MAX_TERMS = 8

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractInterestTerms(text: string, maxTerms = MAX_TERMS): string[] {
  const normalized = normalize(text)
  if (!normalized) return []

  const terms: string[] = []
  const seen = new Set<string>()

  for (const word of normalized.split(' ')) {
    if (word.length < MIN_TERM_LENGTH) continue
    if (/^\d+$/.test(word)) continue
    if (STOPWORDS.has(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    terms.push(word)
    if (terms.length >= maxTerms) break
  }

  return terms
}
