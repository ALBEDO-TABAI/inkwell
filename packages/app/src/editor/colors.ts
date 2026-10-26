import { kvGet, kvPut } from '../store/persistence';
import { t } from '../i18n';
import { BLOCK_COLORS } from '../store/model';

export const COLORS = BLOCK_COLORS;
export const colorName = (c: string) => t('color.' + c);
export function lastUsedColor(): string { return kvGet('lastColor', 'red_background'); }
export function recentColors(): string[] { return kvGet<string[]>('recentColors', []); }
export function pushColor(c: string) {
  kvPut('lastColor', c);
  kvPut('recentColors', [c, ...recentColors().filter((x) => x !== c)].slice(0, 5));
}
export function colorLabel(c: string): string {
  if (c === 'default') return t('color.defaultText');
  if (c === 'default_background') return t('color.defaultBg');
  if (c.endsWith('_background')) return t('color.bg', { c: colorName(c.replace('_background', '')) });
  return t('color.text', { c: colorName(c) });
}
