// src/services/embed-policy.ts
// Whether a news site allows being rendered inside an iframe. Chromium refuses
// the frame when the response carries X-Frame-Options deny/sameorigin or a CSP
// frame-ancestors directive that does not allow the app origin, and no in-app
// renderer can override that decision.

export interface EmbedPolicyInput {
  xFrameOptions?: string | null
  contentSecurityPolicy?: string | null
}

export interface EmbedPolicy {
  embeddable: boolean
  reason?: string
}

function firstDirectiveValue(value: string): string {
  return value.split(',')[0].trim().toLowerCase()
}

const KNOWN_BLOCKED_DOMAINS = [
  'globo.com',
  'g1.globo.com',
  'oglobo.globo.com',
  'ge.globo.com',
  'valor.globo.com',
  'uol.com.br',
  'folha.uol.com.br',
  'noticias.uol.com.br',
  'economia.uol.com.br',
  'esporte.uol.com.br',
  'tvefamosos.uol.com.br',
  'estadao.com.br',
  'bbc.com',
  'bbc.co.uk',
  'cnnbrasil.com.br',
  'r7.com',
  'terra.com.br',
  'olhardigital.com.br'
]

export function isKnownBlockedDomain(rawUrl: string): boolean {
  if (!rawUrl) return false
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '')
    return KNOWN_BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

export function evaluateEmbedPolicy(input: EmbedPolicyInput): EmbedPolicy {
  const xFrameOptions = String(input.xFrameOptions || '').trim()
  if (xFrameOptions) {
    const value = firstDirectiveValue(xFrameOptions)
    if (value === 'deny' || value === 'sameorigin') {
      return { embeddable: false, reason: `x-frame-options: ${value}` }
    }
  }

  const contentSecurityPolicy = String(input.contentSecurityPolicy || '')
  const frameAncestors = contentSecurityPolicy.match(/frame-ancestors([^;]*)/i)
  if (frameAncestors) {
    const value = frameAncestors[1].trim().toLowerCase()
    // 'self' and explicit host lists both exclude an app-owned frame; only a
    // wildcard leaves the embed possible.
    if (!value.startsWith('*')) {
      return { embeddable: false, reason: `csp frame-ancestors: ${value || 'none'}` }
    }
  }

  return { embeddable: true }
}

