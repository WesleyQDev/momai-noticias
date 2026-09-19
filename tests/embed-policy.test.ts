import { describe, it, expect } from 'vitest'
import { evaluateEmbedPolicy, isKnownBlockedDomain } from '../src/services/embed-policy'

describe('Embed policy', () => {
  it('allows embedding when the site sends no blocking header', () => {
    expect(evaluateEmbedPolicy({}).embeddable).toBe(true)
    expect(evaluateEmbedPolicy({ contentSecurityPolicy: "default-src 'self'" }).embeddable).toBe(true)
  })

  it('blocks X-Frame-Options deny (BBC and similar sites)', () => {
    const policy = evaluateEmbedPolicy({ xFrameOptions: 'DENY' })

    expect(policy.embeddable).toBe(false)
    expect(policy.reason).toContain('x-frame-options')
  })

  it('blocks X-Frame-Options sameorigin', () => {
    expect(evaluateEmbedPolicy({ xFrameOptions: 'sameorigin' }).embeddable).toBe(false)
  })

  it('ignores X-Frame-Options values that still allow frames', () => {
    expect(evaluateEmbedPolicy({ xFrameOptions: 'allow-from https://example.com' }).embeddable).toBe(true)
  })

  it('blocks CSP frame-ancestors none and self', () => {
    expect(evaluateEmbedPolicy({ contentSecurityPolicy: "frame-ancestors 'none'" }).embeddable).toBe(false)
    expect(evaluateEmbedPolicy({ contentSecurityPolicy: "default-src 'self'; frame-ancestors 'self'" }).embeddable).toBe(false)
  })

  it('allows CSP frame-ancestors wildcard', () => {
    expect(evaluateEmbedPolicy({ contentSecurityPolicy: 'frame-ancestors *' }).embeddable).toBe(true)
  })

  it('reads frame-ancestors case-insensitively from a longer policy', () => {
    const policy = evaluateEmbedPolicy({
      contentSecurityPolicy: "script-src 'self'; Frame-Ancestors https://partner.example; style-src 'self'"
    })

    expect(policy.embeddable).toBe(false)
  })

  it('identifies known publishers that always block embedding', () => {
    expect(isKnownBlockedDomain('https://g1.globo.com/sp/campinas/noticia.ghtml')).toBe(true)
    expect(isKnownBlockedDomain('https://economia.uol.com.br/noticias/')).toBe(true)
    expect(isKnownBlockedDomain('https://www.bbc.com/portuguese/articles/c00')).toBe(true)
    expect(isKnownBlockedDomain('https://tecnoblog.net/noticias/teste')).toBe(false)
    expect(isKnownBlockedDomain('')).toBe(false)
  })
})

