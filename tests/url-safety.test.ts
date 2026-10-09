import { describe, expect, it } from 'vitest'
import { isPrivateNetworkUrl } from '../src/services/url-safety'

describe('isPrivateNetworkUrl', () => {
  it('flags localhost and local names', () => {
    expect(isPrivateNetworkUrl('http://localhost:8050/feed')).toBe(true)
    expect(isPrivateNetworkUrl('https://printer.local/feed')).toBe(true)
    expect(isPrivateNetworkUrl('https://service.internal/feed')).toBe(true)
  })

  it('flags private and link-local IPv4 ranges', () => {
    expect(isPrivateNetworkUrl('http://127.0.0.1/feed')).toBe(true)
    expect(isPrivateNetworkUrl('http://10.1.2.3/feed')).toBe(true)
    expect(isPrivateNetworkUrl('http://172.16.0.9/feed')).toBe(true)
    expect(isPrivateNetworkUrl('http://172.32.0.9/feed')).toBe(false)
    expect(isPrivateNetworkUrl('http://192.168.1.10/feed')).toBe(true)
    expect(isPrivateNetworkUrl('http://169.254.1.1/feed')).toBe(true)
  })

  it('flags IPv6 loopback and unique-local addresses', () => {
    expect(isPrivateNetworkUrl('http://[::1]:8050/feed')).toBe(true)
    expect(isPrivateNetworkUrl('http://[fd00::1]/feed')).toBe(true)
  })

  it('allows public web addresses', () => {
    expect(isPrivateNetworkUrl('https://g1.globo.com/rss/g1/')).toBe(false)
    expect(isPrivateNetworkUrl('https://8.8.8.8/feed')).toBe(false)
  })

  it('treats unparseable input as not private', () => {
    expect(isPrivateNetworkUrl('')).toBe(false)
    expect(isPrivateNetworkUrl('not a url')).toBe(false)
  })
})
