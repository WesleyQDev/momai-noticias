// src/services/image-utils.ts
// Intelligent image URL upgrader for news providers and feeds.

/**
 * Detects low-resolution thumbnails from news providers (UOL, BBC, WordPress,
 * InfoMoney, Tecnoblog, etc.) and converts them to high-definition URLs.
 */
export function upgradeImageUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined
  let url = rawUrl.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) return undefined

  // 1. UOL: replace thumbnail dimensions (_v2_142x100, _142x100, _300x200, etc.) with HD 900x506
  if (url.includes('imguol.com.br') || url.includes('.imguol.com')) {
    url = url.replace(/(_v2)?_\d+x\d+(\.[a-zA-Z0-9]+)$/i, (_match, _v2, ext) => `_v2_900x506${ext}`)
  }

  // 2. BBC: upgrade low-res thumbnail paths (/ws/240/, /standard/240/) to HD (/standard/976/)
  if (url.includes('ichef.bbci.co.uk')) {
    url = url.replace(/\/(ws|standard)\/\d+\/cpsprodpb\//i, '/standard/976/cpsprodpb/')
  }

  // 3. WordPress / Tecnoblog / InfoMoney / Superinteressante uploads: strip thumbnail suffixes like -340x191.png and query params
  if (url.includes('/wp-content/uploads/') || url.includes('files.tecnoblog.net') || url.includes('infomoney.com.br')) {
    try {
      const parsed = new URL(url)
      if (parsed.searchParams.has('fit') || parsed.searchParams.has('resize') || parsed.searchParams.has('w') || parsed.searchParams.has('crop')) {
        parsed.searchParams.delete('fit')
        parsed.searchParams.delete('resize')
        parsed.searchParams.delete('w')
        parsed.searchParams.delete('crop')
        parsed.searchParams.delete('quality')
        parsed.searchParams.delete('strip')
        url = parsed.toString()
      }
    } catch {}
    url = url.replace(/-\d{2,4}x\d{2,4}(\.[a-zA-Z0-9]+)$/i, (_match, ext) => ext)
  }

  return url
}
