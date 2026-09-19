import { describe, it, expect } from 'vitest'
import { parseFeedXml, sanitizeUrl, stripHtml, upgradeImageUrl, extractMediaImage } from '../src/services/feed-parser'

describe('Feed Parser', () => {
  it('should upgrade low-res and thumbnail image URLs to HD versions', () => {
    // UOL thumbnail
    expect(
      upgradeImageUrl(
        'https://conteudo.imguol.com.br/c/esporte/2d/2026/03/06/vista-aerea-do-morumbis-em-sao-paulo-1772816075162_v2_142x100.jpg'
      )
    ).toBe(
      'https://conteudo.imguol.com.br/c/esporte/2d/2026/03/06/vista-aerea-do-morumbis-em-sao-paulo-1772816075162_v2_900x506.jpg'
    )

    // BBC thumbnail
    expect(
      upgradeImageUrl(
        'https://ichef.bbci.co.uk/ace/ws/240/cpsprodpb/a1d9/live/919d1120-b3ad-11f1-baa2-f576e6b1431d.jpg'
      )
    ).toBe(
      'https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/a1d9/live/919d1120-b3ad-11f1-baa2-f576e6b1431d.jpg'
    )

    // WordPress uploads thumbnail
    expect(
      upgradeImageUrl(
        'https://files.tecnoblog.net/wp-content/uploads/2026/09/edifier-guia-de-compras-340x191.png'
      )
    ).toBe('https://files.tecnoblog.net/wp-content/uploads/2026/09/edifier-guia-de-compras.png')

    // InfoMoney query param fit/quality
    expect(
      upgradeImageUrl(
        'https://www.infomoney.com.br/wp-content/uploads/2026/09/Bjorn-Reynolds-da-SafeGuard.jpg?fit=300%2C225&quality=70&strip=all'
      )
    ).toBe('https://www.infomoney.com.br/wp-content/uploads/2026/09/Bjorn-Reynolds-da-SafeGuard.jpg')
  })

  it('should parse a standard RSS 2.0 feed', () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Tecnoblog</title>
        <link>https://tecnoblog.net</link>
        <description>Tecnologia que move o mundo</description>
        <item>
          <title><![CDATA[Nova IA do Google é lançada]]></title>
          <link>https://tecnoblog.net/noticias/nova-ia/?utm_source=rss&amp;utm_medium=feed</link>
          <description><![CDATA[<p>O Google anunciou hoje sua nova inteligência artificial...</p>]]></description>
          <pubDate>Wed, 16 Sep 2026 14:00:00 -0300</pubDate>
          <guid>https://tecnoblog.net/noticias/nova-ia/</guid>
          <category>Inteligência Artificial</category>
          <media:content url="https://tecnoblog.net/wp-content/uploads/ia.jpg" />
        </item>
      </channel>
    </rss>`

    const source = {
      id: 'tecnoblog',
      title: 'Tecnoblog',
      language: 'pt-BR',
      topics: ['tecnologia'] as any[]
    }

    const articles = parseFeedXml(rssXml, source)
    expect(articles).toHaveLength(1)
    const art = articles[0]
    expect(art.title).toBe('Nova IA do Google é lançada')
    expect(art.url).toBe('https://tecnoblog.net/noticias/nova-ia/')
    expect(art.summary).toContain('O Google anunciou hoje')
    expect(art.image).toBe('https://tecnoblog.net/wp-content/uploads/ia.jpg')
    expect(art.canonicalTopics).toContain('tecnologia')
    expect(art.sourceId).toBe('tecnoblog')
    expect(art.language).toBe('pt-BR')
  })

  it('should parse a standard Atom feed', () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>The Verge</title>
      <link href="https://www.theverge.com"/>
      <updated>2026-09-16T14:00:00Z</updated>
      <entry>
        <title>Apple announces new event</title>
        <link rel="alternate" type="text/html" href="https://www.theverge.com/apple-event?utm_campaign=frontpage"/>
        <id>urn:verge:entry:12345</id>
        <summary>Apple announced its next big hardware event for next month.</summary>
        <published>2026-09-16T12:00:00Z</published>
        <category term="Apple"/>
      </entry>
    </feed>`

    const source = {
      id: 'the-verge',
      title: 'The Verge',
      language: 'en-US',
      topics: ['tecnologia'] as any[]
    }

    const articles = parseFeedXml(atomXml, source)
    expect(articles).toHaveLength(1)
    const art = articles[0]
    expect(art.title).toBe('Apple announces new event')
    expect(art.url).toBe('https://www.theverge.com/apple-event')
    expect(art.canonicalTopics).toContain('tecnologia')
    expect(art.language).toBe('en-US')
  })

  it('should correctly strip HTML tags and unescape entities', () => {
    const raw = '<p>Texto com <b>negrito</b> &amp; &quot;aspas&quot; e &lt;tag&gt;.</p>'
    expect(stripHtml(raw)).toBe('Texto com negrito & "aspas" e <tag>.')
  })

  it('should generate a distinct id for every article sharing the same site prefix', () => {
    const links = [
      'https://g1.globo.com/mg/vales-mg/noticia/2026/09/16/homem-e-preso-em-fuga.ghtml',
      'https://g1.globo.com/pa/santarem-regiao/noticia/2026/09/16/santarem-decreta-emergencia.ghtml',
      'https://g1.globo.com/rj/rio-de-janeiro/noticia/2026/09/16/mp-volta-a-prender-procurador.ghtml',
      'https://g1.globo.com/sc/santa-catarina/noticia/2026/09/16/homem-e-preso-com-cannabis.ghtml'
    ]
    const items = links
      .map((link, index) => `<item><title>Notícia ${index + 1}</title><link>${link}</link><guid>${link}</guid></item>`)
      .join('')
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>G1</title>${items}</channel></rss>`

    const source = { id: 'g1-geral', title: 'G1 — Notícias', language: 'pt-BR', topics: ['geral'] as any[] }
    const articles = parseFeedXml(rssXml, source)

    expect(articles).toHaveLength(links.length)
    const ids = articles.map((article) => article.id)
    expect(new Set(ids).size).toBe(links.length)
  })

  it('should disambiguate sports match news away from games, and horoscope away from politica', () => {
    const sportsRss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>UOL</title><item><title>São Bernardo quebra jejum em casa depois de 10 jogos</title><link>https://uol.com.br/esporte/1</link><guid>1</guid><description>Pela 29a rodada da Série B do Brasileirão</description><category>Esporte</category></item></channel></rss>`
    const sportsSource = { id: 'uol', title: 'UOL', language: 'pt-BR', topics: ['geral', 'politica', 'mundo'] as any[] }
    const sportsArticles = parseFeedXml(sportsRss, sportsSource)
    expect(sportsArticles[0].canonicalTopics).toContain('esportes')
    expect(sportsArticles[0].canonicalTopics).not.toContain('games')
    expect(sportsArticles[0].canonicalTopics).not.toContain('politica')

    const horoscopeRss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>UOL</title><item><title>Horóscopo do dia: veja a previsão para o seu signo</title><link>https://uol.com.br/horoscopo/1</link><guid>2</guid><description>Confira o que os astros revelam para você hoje</description><category>Astrologia</category></item></channel></rss>`
    const horoscopeArticles = parseFeedXml(horoscopeRss, sportsSource)
    expect(horoscopeArticles[0].canonicalTopics).toContain('geral')
    expect(horoscopeArticles[0].canonicalTopics).not.toContain('politica')
  })
})
