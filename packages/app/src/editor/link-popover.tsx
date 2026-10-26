import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openPopover, closePopover } from '../ui/overlay';
import { setLink, linkRangeAt } from './richtext';
import { focusBlock, editables } from './registry';
import { setTitle, pageIdOf } from './commands';
import { pageTitle, isInTrash, breadcrumbPath } from '../app/pages';
import { kvGet } from '../store/persistence';
import { BRAND } from '@shared/brand';
import { offsetToDom } from './caret';

function rangeRect(blockId: string, start: number, end: number): DOMRect {
  const el = editables.get(blockId);
  if (!el) return new DOMRect(400, 300, 0, 0);
  const a = offsetToDom(el, start), b = offsetToDom(el, end);
  const r = document.createRange(); r.setStart(a.node, a.offset); r.setEnd(b.node, b.offset);
  return r.getBoundingClientRect();
}

/** Cmd+K popover: paste a URL or search pages. */
export function openLinkPopover(blockId: string, start: number, end: number) {
  const b = store.get(blockId)!;
  const existing = linkRangeAt(b.title || [], start);
  const rect = rangeRect(blockId, start, end);
  // keep a visual selection highlight while focus is in the popover
  const el = editables.get(blockId); el?.classList.add('has-fake-selection');
  openPopover({ id: 'link', anchor: rect, placement: 'bottom', offset: 8,
    onClose: () => { el?.classList.remove('has-fake-selection'); focusBlock(blockId, end); },
    render: (close) => <LinkBox blockId={blockId} start={start} end={end} initial={existing?.href || ''} close={close} /> });
}

function LinkBox({ blockId, start, end, initial, close }: { blockId: string; start: number; end: number; initial: string; close: () => void }) {
  const [v, setV] = useState(initial);
  const [active, setActive] = useState(0);
  const apply = (href: string | undefined) => {
    const cur = store.get(blockId)!;
    setTitle(blockId, setLink(cur.title || [], start, end, href), false, { start, end });
    close();
  };
  const isUrl = /^(https?:\/\/|www\.|mailto:|[\w-]+\.[a-z]{2,})/i.test(v.trim());
  const pages = v && !isUrl ? [...store.blocks.values()].filter((p) => p.alive && p.type === 'page' && !isInTrash(p.id) && pageTitle(p).toLowerCase().includes(v.toLowerCase())).slice(0, 6) : [];
  const rows: { key: string; node: React.ReactNode; run: () => void; sub?: boolean }[] = [];
  if (isUrl) rows.push({ key: 'url', node: <><span className="ink-menu-icon"><Icon name="link" size={20} /></span><span className="ink-menu-text">{v}</span><span className="ink-slash-hint">{t('ed.pageLink')}</span></>, run: () => apply(/^https?:|^mailto:/.test(v.trim()) ? v.trim() : 'https://' + v.trim()) });
  const recents = !v ? [...new Set([pageIdOf(blockId), ...kvGet<string[]>('recentPages', [])])].map((id) => store.get(id)).filter((p): p is NonNullable<typeof p> => !!p && p.alive && p.type === 'page' && store.get(p.parent)?.type !== 'collection_view_page' && !isInTrash(p.id)).slice(0, 3) : [];
  const pageRow = (p: NonNullable<ReturnType<typeof store.get>>) => {
    const path = breadcrumbPath(p.id).slice(0, -1);
    const sub = path.length > 2 ? `${pageTitle(path[0])} / … / ${pageTitle(path[path.length - 1])}` : path.map((x) => pageTitle(x)).join(' / ');
    return { key: p.id, sub: !!sub, node: <><span className="ink-menu-icon"><PageIcon block={p} size={20} /></span><span className="ink-link-pop-lines"><span className="ink-menu-text">{pageTitle(p)}</span>{sub && <span className="ink-link-pop-sub">{sub}</span>}</span></>, run: () => apply(`${BRAND.scheme}://page/${p.id}`) };
  };
  for (const p of [...pages, ...recents]) rows.push(pageRow(p));
  return (
    <div className="ink-menu ink-link-pop" style={{ width: 330 }}>
      <div className="ink-menu-search-wrap">
        <input data-autofocus className="ink-menu-search" placeholder={t('ed.linkPlaceholder')} value={v} onChange={(e) => { setV(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); (rows[active] || (v ? { run: () => apply(v) } : null))?.run(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          }} />
      </div>
      {(rows.length > 0 || initial) && (
        <div className="ink-menu-body"><div className="ink-menu-group">
          {recents.length > 0 && <div className="ink-menu-label">{t('ed.linkRecent')}</div>}
          {rows.map((r, i) => <div key={r.key} className={'ink-menu-item' + (r.sub ? ' has-sub' : '') + (i === active ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={r.run}>{r.node}</div>)}
          {initial && <div className="ink-menu-item" onClick={() => apply(undefined)}><span className="ink-menu-icon"><Icon name="trash" size={20} /></span><span className="ink-menu-text">{t('ed.linkRemove')}</span></div>}
        </div></div>
      )}
    </div>
  );
}

/** Hover preview for links (B05b link_hover). */
let hoverTimer: number | undefined;
export function attachLinkHover(root: HTMLElement) {
  const over = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.('a.ink-link') as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      if (!a.matches(':hover')) return;
      const href = a.getAttribute('href') || '';
      openPopover({ id: 'link-hover', anchor: a.getBoundingClientRect(), placement: 'bottom-start', offset: 4, noFocus: true, render: () => (
        <div className="ink-link-hover" onMouseLeave={() => closePopover('link-hover')}>
          <Icon name="globe" size={14} stroke={1.7} />
          <span className="ink-link-hover-url">{href.replace(/^https?:\/\//, '')}</span>
          <span className="ink-link-hover-btn" role="button" onClick={() => { navigator.clipboard?.writeText(href).catch(() => {}); }}><Icon name="copy" size={14} /></span>
          <span className="ink-link-hover-btn" role="button" onClick={() => {
            const ed = a.closest<HTMLElement>('[data-editable-id]'); if (!ed) return;
            const id = ed.dataset.editableId!; const b = store.get(id)!;
            const text = a.textContent || ''; const all = (b.title || []).map((s) => s[0]).join('');
            const s = all.indexOf(text); closePopover('link-hover'); if (s >= 0) openLinkPopover(id, s, s + text.length);
          }}><Icon name="pencil" size={14} /></span>
        </div>
      ) });
    }, 450);
  };
  const out = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.('a.ink-link'); if (!a) return;
    clearTimeout(hoverTimer);
    setTimeout(() => { const pop = document.querySelector('[data-popover-id="link-hover"]'); if (pop && !pop.matches(':hover') && !a.matches(':hover')) closePopover('link-hover'); }, 300);
  };
  const click = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.('a.ink-link') as HTMLAnchorElement | null; if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') || '';
    if (e.metaKey || e.ctrlKey || !a.closest('[contenteditable="true"]')) {
      const m = new RegExp('^' + BRAND.scheme + '://page/(.+)$').exec(href);
      if (m) import('../app/state').then((s) => s.navigate(m[1]));
      else window.open(href, '_blank', 'noopener');
    }
  };
  root.addEventListener('mouseover', over); root.addEventListener('mouseout', out); root.addEventListener('click', click);
  return () => { root.removeEventListener('mouseover', over); root.removeEventListener('mouseout', out); root.removeEventListener('click', click); };
}
