/** System-emoji catalogue built from emojibase (MIT). Rendering uses the OS emoji font. */
import en from 'emojibase-data/en/compact.json';
import zh from 'emojibase-data/zh/compact.json';
import { kvGet, kvPut } from '../store/persistence';

export interface EmojiEntry { char: string; name: string; zh: string; tags: string[]; group: number; skins?: string[] }

const zhByHex = new Map<string, { label: string; tags?: string[] }>();
for (const z of zh as any[]) zhByHex.set(z.hexcode, { label: z.label, tags: z.tags });

export const EMOJI: EmojiEntry[] = (en as any[])
  .filter((e) => e.group !== undefined && e.group !== 2)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map((e) => {
    const z = zhByHex.get(e.hexcode);
    return { char: e.unicode, name: e.label, zh: z?.label || '', tags: [...(e.tags || []), ...(z?.tags || [])], group: e.group, skins: e.skins?.map((s: any) => s.unicode) };
  });

/** group ids from emojibase → our category keys */
export const CATEGORIES: { key: string; groups: number[]; icon: string }[] = [
  { key: 'people', groups: [0, 1], icon: 'smile' },
  { key: 'nature', groups: [3], icon: 'leaf' },
  { key: 'food', groups: [4], icon: 'carrot' },
  { key: 'activity', groups: [6], icon: 'ball' },
  { key: 'travel', groups: [5], icon: 'plane' },
  { key: 'objects', groups: [7], icon: 'bulb' },
  { key: 'symbols', groups: [8], icon: 'symbols' },
  { key: 'flags', groups: [9], icon: 'flag' },
];

export function searchEmoji(q: string): EmojiEntry[] {
  const s = q.toLowerCase().replace(/_/g, ' ');
  const starts: EmojiEntry[] = [], contains: EmojiEntry[] = [];
  for (const e of EMOJI) {
    if (e.name.startsWith(s) || e.zh.startsWith(s) || e.tags.some((t) => t.startsWith(s))) starts.push(e);
    else if (e.name.includes(s) || e.zh.includes(s)) contains.push(e);
  }
  return [...starts, ...contains];
}
const byChar = new Map(EMOJI.map((e) => [e.char, e]));
export function recentEmoji(): EmojiEntry[] { return kvGet<string[]>('recentEmoji', []).map((c) => byChar.get(c) || { char: c, name: c, zh: '', tags: [], group: 0 }); }
export function pushRecentEmoji(c: string) { kvPut('recentEmoji', [c, ...kvGet<string[]>('recentEmoji', []).filter((x) => x !== c)].slice(0, 24)); }
export function randomEmoji(): string { return EMOJI[Math.floor(Math.random() * Math.min(EMOJI.length, 1400))].char; }
