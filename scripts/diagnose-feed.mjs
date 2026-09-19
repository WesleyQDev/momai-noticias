// Diagnostic script — traces article count through the feed pipeline
import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

const catalog = JSON.parse(readFileSync(new URL('../sources/catalog.json', import.meta.url), 'utf8'))
const ptSources = catalog.filter(s => s.language === 'pt-BR')

const UA = 'MomAI-News-Reader/1.0'
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  cdataPropName: '__cdata'
})

function extractString(val) {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    if (val.__cdata !== undefined) return extractString(val.__cdata)
    if (val['#text'] !== undefined) return extractString(val['#text'])
  }
  return String(val)
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseItems(xml, source) {
  const parsed = xmlParser.parse(xml)
  const articles = []

  const channel = parsed?.rss?.channel || parsed?.rdf?.channel || parsed?.channel
  if (channel) {
    const rawItems = channel.item || parsed?.['rdf:RDF']?.item || []
    const items = Array.isArray(rawItems) ? rawItems : [rawItems]
    for (const item of items) {
      if (!item) continue
      const title = stripHtml(extractString(item.title))
      let rawUrl = item.link
      if (typeof rawUrl === 'object') rawUrl = rawUrl?.['@_href'] || rawUrl?.__cdata || rawUrl?.['#text'] || ''
      const url = extractString(rawUrl).trim()
      if (!title || !url) continue
      articles.push({ id: `${source.id}-${articles.length}`, title, url, sourceId: source.id, sourceName: source.title })
    }
  }

  const feed = parsed?.feed
  if (feed) {
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : []
    for (const entry of entries) {
      if (!entry) continue
      const title = stripHtml(extractString(entry.title))
      let rawUrl = ''
      if (Array.isArray(entry.link)) {
        const alt = entry.link.find(l => l?.['@_rel'] === 'alternate') || entry.link[0]
        rawUrl = alt?.['@_href'] || ''
      } else if (typeof entry.link === 'object') {
        rawUrl = entry.link?.['@_href'] || ''
      } else {
        rawUrl = String(entry.link || '')
      }
      const url = extractString(rawUrl).trim()
      if (!title || !url) continue
      articles.push({ id: `${source.id}-${articles.length}`, title, url, sourceId: source.id, sourceName: source.title })
    }
  }

  return articles
}

function normalizeTitle(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function main() {
  console.log(`\n=== FEED PIPELINE DIAGNOSIS ===\n`)
  console.log(`Sources in catalog (pt-BR): ${ptSources.length}\n`)

  // Step 1: Fetch all feeds
  const allArticles = []
  for (const src of ptSources) {
    try {
      const res = await fetch(src.feed, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(9000) })
      if (!res.ok) { console.log(`  ❌ ${src.id}: HTTP ${res.status}`); continue }
      const xml = await res.text()
      const items = parseItems(xml, src)
      console.log(`  ✅ ${src.id}: ${items.length} items`)
      allArticles.push(...items)
    } catch (e) {
      console.log(`  ❌ ${src.id}: ${e.message}`)
    }
  }
  console.log(`\n📊 Step 1 — Raw parsed articles: ${allArticles.length}`)

  // Step 2: URL dedup
  const seenUrls = new Set()
  const urlDeduped = []
  for (const a of allArticles) {
    if (seenUrls.has(a.url)) continue
    seenUrls.add(a.url)
    urlDeduped.push(a)
  }
  console.log(`📊 Step 2 — After URL dedup: ${urlDeduped.length} (removed ${allArticles.length - urlDeduped.length})`)

  // Step 3: Title dedup (current: 60-char prefix)
  const seenTitles60 = new Map()
  const titleDeduped60 = []
  let titleDupes60 = 0
  for (const a of urlDeduped) {
    const norm = normalizeTitle(a.title)
    const key = norm.length > 15 ? norm.slice(0, 60) : norm
    if (key.length > 10 && seenTitles60.has(key)) {
      titleDupes60++
      continue
    }
    if (key.length > 10) seenTitles60.set(key, a)
    titleDeduped60.push(a)
  }
  console.log(`📊 Step 3 — After title dedup (60-char prefix): ${titleDeduped60.length} (removed ${titleDupes60})`)

  // Step 3b: Title dedup with FULL match for comparison
  const seenTitlesFull = new Map()
  const titleDedupedFull = []
  let titleDupesFull = 0
  for (const a of urlDeduped) {
    const norm = normalizeTitle(a.title)
    if (norm.length > 10 && seenTitlesFull.has(norm)) {
      titleDupesFull++
      continue
    }
    if (norm.length > 10) seenTitlesFull.set(norm, a)
    titleDedupedFull.push(a)
  }
  console.log(`📊 Step 3b — After title dedup (full match): ${titleDedupedFull.length} (removed ${titleDupesFull})`)

  // Step 3c: Title dedup with 80-char prefix
  const seenTitles80 = new Map()
  const titleDeduped80 = []
  let titleDupes80 = 0
  for (const a of urlDeduped) {
    const norm = normalizeTitle(a.title)
    const key = norm.length > 15 ? norm.slice(0, 80) : norm
    if (key.length > 10 && seenTitles80.has(key)) {
      titleDupes80++
      continue
    }
    if (key.length > 10) seenTitles80.set(key, a)
    titleDeduped80.push(a)
  }
  console.log(`📊 Step 3c — After title dedup (80-char prefix): ${titleDeduped80.length} (removed ${titleDupes80})`)

  // Show some examples of 60-char prefix collisions that are NOT actual dupes
  console.log(`\n🔍 Checking false-positive collisions with 60-char prefix...`)
  let falsePositives = 0
  const seen60check = new Map()
  for (const a of urlDeduped) {
    const norm = normalizeTitle(a.title)
    const key = norm.length > 15 ? norm.slice(0, 60) : norm
    if (key.length > 10 && seen60check.has(key)) {
      const existing = seen60check.get(key)
      const existingFull = normalizeTitle(existing.title)
      if (existingFull !== norm) {
        falsePositives++
        if (falsePositives <= 5) {
          console.log(`  FALSE POSITIVE:`)
          console.log(`    Kept:    "${existing.title}" [${existing.sourceId}]`)
          console.log(`    Removed: "${a.title}" [${a.sourceId}]`)
          console.log(`    Key:     "${key}"`)
        }
      }
    }
    if (key.length > 10 && !seen60check.has(key)) seen60check.set(key, a)
  }
  console.log(`  Total false positives with 60-char: ${falsePositives}`)

  console.log(`\n=== SUMMARY ===`)
  console.log(`Raw:              ${allArticles.length}`)
  console.log(`After URL dedup:  ${urlDeduped.length}`)
  console.log(`Dedup 60-char:    ${titleDeduped60.length}`)
  console.log(`Dedup 80-char:    ${titleDeduped80.length}`)
  console.log(`Dedup full match: ${titleDedupedFull.length}`)
  console.log(`\nRecommendation: use full-match dedup → ${titleDedupedFull.length} unique articles`)
}

main().catch(console.error)
