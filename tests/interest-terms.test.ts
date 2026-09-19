import { describe, it, expect } from 'vitest'
import { extractInterestTerms } from '../src/services/interest-terms'

describe('Interest terms', () => {
  it('keeps meaningful words and drops stopwords, accents and short words', () => {
    const terms = extractInterestTerms('Lula e Flávio trocam ataques citando Vorcaro e Moraes em meio a caos no STF')

    expect(terms).toContain('lula')
    expect(terms).toContain('flavio')
    expect(terms).toContain('ataques')
    expect(terms).toContain('moraes')
    expect(terms).not.toContain('para')
    expect(terms).not.toContain('meio')
    expect(terms).not.toContain('stf') // short after normalization
  })

  it('normalizes case and punctuation', () => {
    expect(extractInterestTerms('IA generativa: o que muda?')).toEqual(
      expect.arrayContaining(['generativa', 'muda'])
    )
  })

  it('drops pure numbers and empty input', () => {
    expect(extractInterestTerms('2026 1234')).toEqual([])
    expect(extractInterestTerms('')).toEqual([])
  })

  it('limits the number of terms', () => {
    const terms = extractInterestTerms(
      'tecnologia inteligencia artificial plataforma aplicativo segurança privacidade inovacao mercado'
    )
    expect(terms.length).toBeLessThanOrEqual(8)
    expect(terms.length).toBeGreaterThan(3)
  })

  it('does not repeat the same term twice', () => {
    const terms = extractInterestTerms('bitcoin bitcoin cai e bitcoin sobe')
    expect(terms.filter((term) => term === 'bitcoin')).toHaveLength(1)
  })
})
