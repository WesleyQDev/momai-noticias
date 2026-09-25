import { describe, expect, it, vi } from 'vitest'

vi.mock('momai:sdk', () => ({ default: { locale: 'pt-BR' } }))
vi.mock('momai:events', () => ({ useExtensionEvents: () => {} }))

import NoticiasHeadlinesWidget from '../src/widgets/headlines'
import { isHeadlinesConfigCustomized } from '../src/widgets/headlinesCustomization'

describe('headlines widget customization', () => {
  it('exposes a declarative customization the host shell can render', () => {
    const customization = (NoticiasHeadlinesWidget as any).customization
    expect(customization).toBeDefined()
    expect(typeof customization.isCustomized).toBe('function')
    expect(customization.defaults).toEqual({})
    expect(Array.isArray(customization.options)).toBe(true)
    const topic = customization.options.find((option: any) => option.key === 'topic')
    expect(topic?.kind).toBe('select')
    expect(topic?.options?.some((choice: any) => choice.value === '')).toBe(true)
    expect(topic?.options?.some((choice: any) => choice.value === 'tecnologia')).toBe(true)
  })

  it('treats an empty topic as default and any topic as customized', () => {
    expect(isHeadlinesConfigCustomized(undefined)).toBe(false)
    expect(isHeadlinesConfigCustomized({})).toBe(false)
    expect(isHeadlinesConfigCustomized({ topic: '' })).toBe(false)
    expect(isHeadlinesConfigCustomized({ topic: 'tecnologia' })).toBe(true)
  })

  it('routes the static through the same predicate', () => {
    const customization = (NoticiasHeadlinesWidget as any).customization
    expect(customization.isCustomized({ topic: 'esportes' })).toBe(true)
    expect(customization.isCustomized({})).toBe(false)
  })
})
