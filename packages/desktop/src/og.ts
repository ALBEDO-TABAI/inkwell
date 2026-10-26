/** Local Open Graph lookup for bookmark blocks: the main process fetches the page itself (no third-party service). */
import { net } from 'electron';

export interface Og { title: string; description: string; image?: string; favicon?: string }
const MAX = 1_500_000;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();

export function parseOg(html: string, base: string): Og {
  const head = html.slice(0, 300_000);
  const meta = (keys: string[]) => {
    for (const k of keys) {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i');
      const tag = head.match(re)?.[0]; const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
      if (c) return decode(c);
    }
    return '';
  };
  const abs = (u: string) => { try { return u ? new URL(u, base).href : undefined; } catch { return undefined; } };
  const title = meta(['og:title', 'twitter:title']) || decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '') || new URL(base).hostname;
  const icon = head.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1];
  return { title, description: meta(['og:description', 'description', 'twitter:description']), image: abs(meta(['og:image', 'twitter:image'])), favicon: abs(icon || '/favicon.ico') };
}

export async function fetchOg(url: string): Promise<Og | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await net.fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Inkwell/0.4 link-preview', accept: 'text/html,*/*;q=0.5' } });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') || 'text/html')) return null;
    const reader = res.body?.getReader(); if (!reader) return null;
    let html = ''; const dec = new TextDecoder();
    for (;;) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); if (html.length > MAX || /<\/head>/i.test(html)) { void reader.cancel(); break; } }
    return parseOg(html, res.url || url);
  } catch { return null; } finally { clearTimeout(timer); }
}
