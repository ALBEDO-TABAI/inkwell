import katex from 'katex';
import { store } from '../store/store';
import type { Marks } from '../store/model';
import { escapeHtml, type RenderCtx } from './richtext';
import { pageTitle } from '../app/pages';
import { t } from '../i18n';

const eqCache = new Map<string, string>();
export function renderTex(tex: string, display = false): string {
  const k = (display ? 'D:' : 'I:') + tex;
  let h = eqCache.get(k);
  if (!h) {
    try { h = katex.renderToString(tex || '\\square', { displayMode: display, throwOnError: false, output: 'html' }); }
    catch { h = escapeHtml(tex); }
    eqCache.set(k, h);
  }
  return h;
}

export function mentionHtml(m: NonNullable<Marks['mention']>): string {
  if (m.kind === 'user') {
    const u = store.users.get(m.id || '');
    return `<span class="ink-mention-at">@</span>${escapeHtml(u?.name || '?')}`;
  }
  if (m.kind === 'date') {
    const d = m.value ? new Date(m.value + 'T00:00:00') : new Date();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const label = diff === 0 ? t('common.today') : diff === 1 ? t('common.tomorrow') : diff === -1 ? t('common.yesterday') : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    return `<span class="ink-mention-at">@</span>${escapeHtml(label)}`;
  }
  const p = store.get(m.id || '');
  const ic = p?.format?.page_icon;
  const icon = ic && !ic.startsWith('icon:') ? `<span class="ink-mention-icon">${escapeHtml(ic)}</span>` : `<span class="ink-mention-icon ink-mention-page"></span>`;
  return `${icon}<span class="ink-mention-title">${escapeHtml(pageTitle(p))}</span>`;
}

import { commentOpen } from '../comments/model';
export const inlineCtx: RenderCtx = { mention: mentionHtml, equation: (tex) => renderTex(tex), commentOpen };
