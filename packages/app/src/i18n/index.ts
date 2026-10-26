import { zhCN } from './zh-CN';
import { en } from './en';
import { BRAND } from '@shared/brand';

export type Locale = 'zh-CN' | 'en';
export type MessageKey = keyof typeof zhCN;
const tables: Record<Locale, Record<string, string | undefined>> = { 'zh-CN': zhCN, en };

let current: Locale = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh-CN') return q;
    const saved = localStorage.getItem('inkwell.locale');
    if (saved === 'en' || saved === 'zh-CN') return saved;
  } catch {}
  return 'zh-CN';
})();
const listeners = new Set<() => void>();

export function getLocale(): Locale { return current; }
export function setLocale(l: Locale) {
  current = l;
  try { localStorage.setItem('inkwell.locale', l); } catch {}
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}
export function onLocaleChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); }

/** Translate. `{name}` placeholders are filled from vars; `{brand}` is always available. */
export function t(key: MessageKey | string, vars?: Record<string, string | number>): string {
  const raw = tables[current][key] ?? tables['zh-CN'][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (k === 'brand' ? BRAND.name : String(vars?.[k] ?? `{${k}}`)));
}
