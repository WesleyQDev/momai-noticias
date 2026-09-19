// src/services/categories.ts
import type { CanonicalTopic } from './types'

export const TOPIC_SYNONYMS: Record<CanonicalTopic, string[]> = {
  tecnologia: [
    'tecnologia', 'tech', 'gadgets', 'gadget', 'software', 'hardware', 'inteligencia artificial', 'ia', 'ai',
    'smartphones', 'smartphone', 'celulares', 'celular', 'apple', 'google', 'microsoft', 'android', 'ios',
    'internet', 'apps', 'aplicativo', 'aplicativos', 'ciberseguranca', 'computador', 'computadores', 'notebook',
    'chips', 'semicondutores', 'nvidia', 'amd', 'intel', 'chatgpt', 'openai', 'deepmind', 'meta', 'redes sociais',
    'algoritmo', 'startup', 'startups', 'robotica', 'robos', 'samsung', 'xiaomi', 'motorola', 'qualcomm',
    'windows 11', 'macbook', 'iphone', 'ipad'
  ],
  economia: [
    'economia', 'mercado financeiro', 'financas', 'bolsa de valores', 'ibovespa', 'dolar', 'investimentos',
    'investimento', 'negocios', 'inflacao', 'ipca', 'selic', 'criptomoedas', 'cripto', 'bitcoin', 'ethereum',
    'acoes', 'fundos imobiliarios', 'bancos', 'pib', 'impostos', 'receita federal', 'copom', 'taxa de juros',
    'lucro liquido', 'dividendo', 'dividendos', 'balanco financeiro', 'wall street', 'fed', 'banco central',
    'fii', 'fiis', 'tesouro direto', 'varejo', 'comercio exterior'
  ],
  politica: [
    'politica', 'governo federal', 'governo', 'congresso nacional', 'congresso', 'senado federal', 'senado',
    'camara dos deputados', 'camara', 'eleicoes', 'eleicao', 'stf', 'supremo tribunal', 'brasilia',
    'presidente da republica', 'lula', 'bolsonaro', 'ministerio', 'ministro', 'ministros', 'planalto',
    'palacio do planalto', 'itamaraty', 'parlamentares', 'deputado', 'deputados', 'senador', 'senadores',
    'governador', 'prefeito', 'partido politico', 'votacao', 'reforma tributaria', 'cpi', 'judiciario',
    'procuradoria', 'pgr', 'tse', 'tribunal superior eleitoral', 'diplomacia', 'relacoes exteriores'
  ],
  ciencia: [
    'ciencia', 'ciencias', 'cientifico', 'cientistas', 'cientista', 'astronomia', 'astronomos', 'espaco sideral',
    'nasa', 'telescopio', 'james webb', 'hubble', 'pesquisa cientifica', 'artigo cientifico', 'meio ambiente',
    'biologia', 'fisica quantica', 'fisica', 'descoberta cientifica', 'planeta', 'planetas', 'asteroide',
    'marte', 'lua', 'buraco negro', 'galaxia', 'galaxias', 'dna', 'genetica', 'arqueologia', 'paleontologia',
    'aquecimento global', 'mudancas climaticas', 'fossil'
  ],
  esportes: [
    'esportes', 'esporte', 'futebol', 'brasileirao', 'serie a', 'serie b', 'libertadores', 'sul-americana',
    'champions league', 'premier league', 'la liga', 'nba', 'formula 1', 'f1', 'olimpiadas', 'tenis',
    'copa do mundo', 'selecao brasileira', 'flamengo', 'palmeiras', 'corinthians', 'sao paulo fc', 'santos fc',
    'gremio', 'internacional', 'atletico-mg', 'atletico-go', 'cruzeiro', 'botafogo', 'fluminense', 'vasco',
    'real madrid', 'barcelona', 'gol', 'gols', 'artilheiro', 'tecnico', 'escalacao', 'estadio', 'volei',
    'basquete', 'ufc', 'mma', 'atleta', 'atletas', 'campeonato'
  ],
  cultura: [
    'cultura', 'cinema', 'filmes', 'filme', 'series', 'serie', 'musica', 'artes plasticas', 'livros', 'livro',
    'literatura', 'entretenimento', 'shows', 'show', 'streaming', 'netflix', 'prime video', 'disney+', 'max',
    'oscar', 'emmy', 'grammy', 'teatro', 'novela', 'novelas', 'celebridades', 'famosos', 'ator', 'atriz',
    'cantor', 'cantora', 'album', 'turne', 'estreia'
  ],
  games: [
    'games', 'game', 'videogame', 'videogames', 'video game', 'video games', 'gamer', 'gamers', 'gameplay',
    'playstation', 'ps5', 'ps4', 'psvr', 'xbox', 'xbox series', 'nintendo', 'nintendo switch', 'steam',
    'steam deck', 'pc gamer', 'esports', 'e-sports', 'rpg', 'mmorpg', 'gta', 'gta 6', 'zelda', 'mario bros',
    'fortnite', 'counter-strike', 'cs2', 'valorant', 'league of legends', 'jogos eletronicos', 'jogos digitais',
    'ubisoft', 'epic games', 'rockstar games', 'capcom', 'square enix', 'blizzard', 'ea sports', 'game pass',
    'ps plus', 'jogos gratis', 'jogos do mes', 'lancamento de jogos'
  ],
  saude: [
    'saude', 'medicina', 'medico', 'medicos', 'hospital', 'hospitais', 'vacina', 'vacinacao', 'vacinas',
    'doenca', 'doencas', 'sintomas', 'tratamento', 'alimentacao saudavel', 'bem-estar', 'psicologia',
    'psiquiatria', 'nutricao', 'nutricionista', 'fitness', 'sus', 'cancer', 'dengue', 'diabetes', 'colesterol',
    'pressao alta', 'ansiedade', 'depressao', 'sono', 'exercicios fisicos', 'anvisa', 'oms', 'remedio',
    'medicamento', 'medicamentos'
  ],
  mundo: [
    'internacional', 'noticias internacionais', 'oriente medio', 'casa branca', 'uniao europeia', 'onu',
    'otan', 'guerra na ucrania', 'guerra em gaza', 'russia', 'ucrania', 'israel', 'palestina', 'china',
    'taiwan', 'estados unidos', 'governo americano', 'embaixada', 'geopolitica', 'diplomatas',
    'presidente dos eua', 'reino unido', 'franca', 'alemanha', 'argentina', 'coreia do norte', 'acordo de paz'
  ],
  geral: [
    'geral', 'cotidiano', 'cidades', 'brasil', 'urgente', 'plantao', 'transito', 'rodovia', 'clima',
    'previsao do tempo', 'chuva', 'temporal', 'acidente', 'defesa civil', 'loteria', 'mega-sena',
    'horoscopo', 'astrologia', 'signos', 'signo'
  ]
}

function normalizeStr(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function classifyTextToTopics(
  title: string,
  summary: string,
  articleCategories: string[] = [],
  fallbackSourceTopics: CanonicalTopic[] = []
): CanonicalTopic[] {
  const normTitle = normalizeStr(title)
  const normSummary = normalizeStr(summary)
  const normCats = articleCategories.map(normalizeStr)

  const scores: Record<CanonicalTopic, number> = {
    tecnologia: 0,
    economia: 0,
    politica: 0,
    ciencia: 0,
    esportes: 0,
    cultura: 0,
    games: 0,
    saude: 0,
    mundo: 0,
    geral: 0
  }

  // 1. Direct article category matches (highest weight)
  for (const cat of normCats) {
    for (const [topic, keywords] of Object.entries(TOPIC_SYNONYMS) as [CanonicalTopic, string[]][]) {
      if (cat === topic || keywords.some((kw) => cat === kw || cat.includes(kw))) {
        scores[topic] += 5
      }
    }
  }

  // 2. Title matches (weight = 3) and summary matches (weight = 1)
  for (const [topic, keywords] of Object.entries(TOPIC_SYNONYMS) as [CanonicalTopic, string[]][]) {
    for (const kw of keywords) {
      const normKw = normalizeStr(kw)
      const regex = new RegExp(`\\b${normKw}\\b`, 'i')
      if (regex.test(normTitle)) {
        scores[topic] += 3
      } else if (regex.test(normSummary)) {
        scores[topic] += 1
      }
    }
  }

  // 3. Disambiguation rules
  // Rule A: Astrology/Horoscope/Lottery must never be in Politica or Ciencia
  const isAstrologyOrLottery = /\b(horoscopo|signo|signos|astrologia|mega-sena|loteria)\b/i.test(
    `${normTitle} ${normSummary}`
  )
  if (isAstrologyOrLottery) {
    scores.politica = 0
    scores.ciencia = 0
    scores.geral += 10
  }

  // Rule B: Sports / Soccer championship news must never be tagged as Games
  const isSportsMatch =
    scores.esportes >= 2 ||
    /\b(futebol|brasileirao|libertadores|serie a|serie b|campeonato|estadio|escalacao|artilheiro|tecnico|gols?)\b/i.test(
      `${normTitle} ${normSummary} ${normCats.join(' ')}`
    )
  if (isSportsMatch) {
    scores.games = 0
    scores.esportes = Math.max(scores.esportes, 6)
  }

  // Find top matching topics
  const sortedTopics = (Object.keys(scores) as CanonicalTopic[])
    .filter((topic) => scores[topic] >= 2)
    .sort((a, b) => scores[b] - scores[a])

  if (sortedTopics.length > 0) {
    return sortedTopics.slice(0, 2)
  }

  // 4. If no specific topic matched, use source fallback or 'geral'
  if (fallbackSourceTopics.length > 0) {
    return fallbackSourceTopics.slice(0, 2)
  }

  return ['geral']
}

