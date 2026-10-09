// src/services/url-safety.ts
// Guards user/assistant supplied URLs from reaching private network targets
// (SSRF). Hostnames are checked literally; a public name that resolves to a
// private address inside the network remains a residual risk without DNS
// resolution.

const PRIVATE_HOSTS = new Set(['localhost', '0.0.0.0', '::1', '::'])

export function isPrivateNetworkUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!host) return false
    if (PRIVATE_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) return true

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4) {
      const a = Number(ipv4[1])
      const b = Number(ipv4[2])
      if (a === 0 || a === 10 || a === 127) return true
      if (a === 172 && b >= 16 && b <= 31) return true
      if (a === 192 && b === 168) return true
      if (a === 169 && b === 254) return true
    }

    if (host.includes(':')) {
      // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
      if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true
    }

    return false
  } catch {
    return false
  }
}
