/** Fixture media: original procedurally generated SVG artwork (no third-party images). */
const svg = (w: number, h: number, body: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${body}</svg>`);
function landscape(w: number, h: number, seed: number) {
  const hue = (seed * 47) % 360;
  const layers = [0.55, 0.68, 0.8].map((y, i) => {
    let d = `M0 ${h}`; const n = 7 + i * 3;
    for (let k = 0; k <= n; k++) { const x = (k / n) * w; const yy = h * y + Math.sin(k * 1.7 + seed + i) * h * (0.09 - i * 0.02); d += ` L${x.toFixed(1)} ${yy.toFixed(1)}`; }
    d += ` L${w} ${h} Z`;
    return `<path d="${d}" fill="hsl(${(hue + 90 + i * 12) % 360} ${28 - i * 4}% ${48 - i * 10}%)"/>`;
  }).join('');
  return svg(w, h, `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 82%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 35% 70%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/><circle cx="${w * 0.72}" cy="${h * 0.3}" r="${h * 0.09}" fill="hsl(${(hue + 40) % 360} 60% 92%)" opacity=".85"/>${layers}<rect y="${h * 0.86}" width="${w}" height="${h * 0.14}" fill="hsl(${(hue + 190) % 360} 20% 40%)" opacity=".55"/>`);
}
const MEDIA: Record<string, () => string> = {
  'fixture://landscape': () => landscape(1408, 632, 3),
  'fixture://cover-1': () => landscape(1600, 500, 7),
  'fixture://cover-2': () => landscape(1600, 500, 11),
  'fixture://cover-3': () => svg(1600, 500, '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f2c1a8"/><stop offset="1" stop-color="#8fb3d9"/></linearGradient></defs><rect width="1600" height="500" fill="url(#g)"/>'),
  'fixture://cover-4': () => svg(1600, 500, '<rect width="1600" height="500" fill="#2f3a4a"/><g fill="none" stroke="#e8d9b0" stroke-width="3" opacity=".5">' + Array.from({ length: 12 }, (_, i) => `<circle cx="800" cy="250" r="${30 + i * 40}"/>`).join('') + '</g>'),
  'fixture://favicon': () => svg(32, 32, '<rect width="32" height="32" rx="6" fill="#ddd"/><text x="16" y="22" font-size="16" text-anchor="middle" font-family="Georgia" fill="#333">W</text>'),
};
export const COVER_GALLERY = ['fixture://cover-1', 'fixture://cover-2', 'fixture://cover-3', 'fixture://cover-4'];
const cache = new Map<string, string>();
export function resolveMedia(src?: string): string | undefined {
  if (!src) return undefined;
  if (!src.startsWith('fixture://')) return src;
  let v = cache.get(src); if (!v) { v = (MEDIA[src] || MEDIA['fixture://landscape'])(); cache.set(src, v); }
  return v;
}
