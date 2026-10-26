/** Search modal (Cmd+K / Cmd+P): query row, filter chips, results list, preview pane, footer hints. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { plain, type Block } from '../store/model';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openPopover } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { pageTitle, breadcrumbPath, isInTrash, createPage } from '../app/pages';
import { navigate, getUi } from '../app/state';
import { kvGet, kvPut } from '../store/persistence';
import { toHtml } from '../editor/richtext';
import { inlineCtx } from '../editor/render-inline';
import { copyPageLink } from './RowMenu';
import { shellSend, onShellCommand } from '../platform/bridge';
import { OverlayHost } from '../ui/overlay';

/** `newTab`: the palette a freshly opened tab shows (placeholder "open in new tab…", new chat / new page first). */
/** Stand-alone quick-search window (⇧⌘K from anywhere): the same palette, filling a 755×700 frameless window. */
export function QuickSearchApp() {
  const [k, setK] = useState(0);
  useEffect(() => onShellCommand((cmd) => { if (cmd === 'focus') setK((x) => x + 1); }), []);
  const close = () => { shellSend('inkwell:quick-close'); setK((x) => x + 1); };
  return <div className="ink-quick-root"><SearchModal key={k} close={close} newTab={false} quick /><OverlayHost /></div>;
}
export function openSearch(o: { newTab?: boolean } = {}) {
  openPopover({ id: 'search', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', topFraction: 0.09, modal: true, clearBackdrop: !!o.newTab, className: 'ink-search-pop', render: (close) => <SearchModal close={close} newTab={!!o.newTab} /> });
}
const ACTIONS = [{ id: '__chat', icon: 'chat', label: 'sidebar.newChat' }, { id: '__page', icon: 'page', label: 'search.newPage' }, { id: '__tpl', icon: 'layoutTemplate', label: 'search.templates' }] as const;

type Sort = 'best' | 'edited' | 'created';
interface Hit { id: string; score: number }

const isSearchable = (b: Block) => b.alive && (b.type === 'page' || b.type === 'collection_view_page') && !isInTrash(b.id);

export function relTime(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return t('time.justNow');
  if (m < 60) return t('time.minutes', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('time.hours', { n: h });
  return t('time.days', { n: Math.round(h / 24) });
}

/** Wrap case-insensitive matches of q in <mark>. */
function highlight(text: string, q: string): ReactNode {
  const s = q.trim(); if (!s) return text;
  const out: ReactNode[] = []; const lower = text.toLowerCase(), ls = s.toLowerCase();
  let i = 0, k = 0;
  for (;;) {
    const j = lower.indexOf(ls, i);
    if (j < 0) { out.push(text.slice(i)); break; }
    if (j > i) out.push(text.slice(i, j));
    out.push(<mark key={k++} className="ink-search-hl">{text.slice(j, j + s.length)}</mark>);
    i = j + s.length;
  }
  return out;
}

function SearchModal({ close, newTab, quick }: { close: () => void; newTab: boolean; quick?: boolean }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [titleOnly, setTitleOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('best');
  const [preview, setPreview] = useState(() => !quick && kvGet('searchPreview', true));
  const listRef = useRef<HTMLDivElement>(null);
  const current = getUi().pageId;
  const query = q.trim().toLowerCase();

  const recents = useMemo(() => kvGet<string[]>('recentPages', []).map((id) => store.get(id)).filter((b): b is Block => !!b && isSearchable(b)).slice(0, 12), []);
  const hits = useMemo<Hit[]>(() => {
    if (!query) return [];
    const out: Hit[] = [];
    for (const b of store.blocks.values()) {
      if (!isSearchable(b)) continue;
      const title = pageTitle(b).toLowerCase();
      let score = 0;
      if (title.startsWith(query)) score = 3; else if (title.includes(query)) score = 2;
      else if (!titleOnly && store.children(b.id).some((c) => plain(c.title).toLowerCase().includes(query))) score = 1;
      else if (!titleOnly && ancestorsMatch(b, query)) score = 0.5;
      if (!score) continue;
      if (b.id === current) score += 0.5;
      out.push({ id: b.id, score });
    }
    const by = (f: (b: Block) => number) => (a: Hit, c: Hit) => f(store.get(c.id)!) - f(store.get(a.id)!);
    if (sort === 'edited') out.sort(by((b) => b.edited || 0));
    else if (sort === 'created') out.sort(by((b) => b.created || 0));
    else out.sort((a, c) => c.score - a.score || (store.get(c.id)!.edited || 0) - (store.get(a.id)!.edited || 0));
    return out;
  }, [query, titleOnly, sort, current]);
  const actions = newTab && !query ? ACTIONS.map((a) => a.id as string) : [];
  const ids = query ? hits.map((h) => h.id) : [...actions, ...recents.map((b) => b.id)];
  const sel = ids[Math.min(active, ids.length - 1)];
  useEffect(() => { listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const go = (id: string, newTab = false) => {
    if (id === '__page') { createPage('private'); close(); return; }
    if (id === '__tpl') { close(); void import('./Templates').then((m) => m.openTemplates()); return; }
    if (id === '__chat') { close(); return; }
    if (quick) { shellSend('inkwell:quick-open', { pageId: id, newTab }); close(); return; }
    if (newTab) shellSend('inkwell:new-tab', { url: `#/p/${id}` }); else navigate(id);
    close();
  };
  const togglePreview = () => { setPreview((v) => { kvPut('searchPreview', !v); return !v; }); };
  const space = store.space.name;
  const sortLabel = sort === 'best' ? t('search.bestMatch') : sort === 'edited' ? t('search.lastEditedSort') : t('search.createdSort');

  return (
    <div className={'ink-search' + (preview ? ' has-preview' : '')} onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(ids.length - 1, a + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === 'Enter' && sel) { e.preventDefault(); go(sel, e.metaKey || e.ctrlKey); }
      else if ((e.key === 'l' || e.key === 'L') && (e.metaKey || e.ctrlKey) && sel) { e.preventDefault(); copyPageLink(sel); }
    }}>
      <div className="ink-search-head">
        <span className="ink-search-glass"><Icon name="search" size={20} stroke={1.6} /></span>
        <input data-autofocus autoFocus={quick} placeholder={newTab ? t('search.newTabPlaceholder') : t('search.placeholder', { space })} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} />
        <span className="ink-search-head-actions">
          <span role="button" className={'ink-search-iconbtn' + (preview ? ' is-on' : '')} aria-label={t('search.togglePreview')} onClick={togglePreview}><Icon name="panelRight" size={20} stroke={1.5} /></span>
          <span role="button" className="ink-search-iconbtn is-on" aria-label={t('search.filters')}><Icon name="filterCircle" size={20} stroke={1.5} /></span>
        </span>
      </div>
      <div className="ink-search-filters">
        <span role="button" className={'ink-search-chip' + (titleOnly ? ' is-on' : '')} onClick={() => setTitleOnly((v) => !v)}><Icon name="caseSensitive" size={16} stroke={1.6} /><span>{t('search.titleOnly')}</span></span>
        <span role="button" className="ink-search-chip"><Icon name="user" size={16} stroke={1.6} /><span>{t('search.createdBy')}</span><Icon name="chevronDown" size={12} stroke={2} /></span>
        <span role="button" className="ink-search-chip"><Icon name="page" size={16} stroke={1.6} /><span>{t('search.inPage')}</span><Icon name="chevronDown" size={12} stroke={2} /></span>
        <span role="button" className="ink-search-chip is-muted"><Icon name="plus" size={14} stroke={1.8} /><span>{t('search.filter')}</span></span>
      </div>
      <div className="ink-search-main">
        <div className="ink-search-list" ref={listRef}>
          {actions.map((id, i) => {
            const a = ACTIONS.find((x) => x.id === id)!;
            return (
              <div key={id} role="option" aria-selected={i === active} className={'ink-search-row' + (i === active ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={() => go(id)}>
                <span className="ink-search-icon"><Icon name={a.icon} size={18} stroke={1.6} /></span>
                <span className="ink-search-title">{t(a.label)}</span>
                {i === active && <span className="ink-search-enter"><Icon name="cornerDownLeft" size={14} stroke={1.6} /></span>}
              </div>
            );
          })}
          <div className="ink-search-label">
            <span>{query ? t('search.results', { n: hits.length }) : t('search.today')}</span>
            {query && <span role="button" className="ink-search-sort" onClick={(e) => openMenu((e.currentTarget as HTMLElement).getBoundingClientRect(), { width: 180, groups: [(['best', 'edited', 'created'] as Sort[]).map((s) => ({ id: s, label: s === 'best' ? t('search.bestMatch') : s === 'edited' ? t('search.lastEditedSort') : t('search.createdSort'), checked: sort === s, onSelect: () => setSort(s) }))] }, { placement: 'bottom-end' })}>{sortLabel}<Icon name="chevronDown" size={12} stroke={2} /></span>}
          </div>
          {ids.map((id, i) => {
            if (i < actions.length) return null;
            const b = store.get(id)!;
            const path = breadcrumbPath(id).slice(0, -1);
            const onRow = { onMouseMove: () => setActive(i), onClick: (e: React.MouseEvent) => go(id, e.metaKey || e.ctrlKey) };
            if (!query) {
              return (
                <div key={id} role="option" aria-selected={i === active} className={'ink-search-row' + (i === active ? ' is-active' : '')} {...onRow}>
                  <span className="ink-search-icon"><PageIcon block={b} size={20} emojiSize={16} /></span>
                  <span className="ink-search-title">{pageTitle(b)}</span>
                  {path.length > 0 && <span className="ink-search-path">— {pathText(path)}</span>}
                </div>
              );
            }
            const u = store.users.get(b.editedBy || store.currentUser);
            return (
              <div key={id} role="option" aria-selected={i === active} className={'ink-search-row is-two-line' + (i === active ? ' is-active' : '')} {...onRow}>
                <span className="ink-search-icon"><PageIcon block={b} size={20} emojiSize={16} /></span>
                <span className="ink-search-lines">
                  <span className="ink-search-line1">
                    <span className="ink-search-title">{pageTitle(b)}</span>
                    {id === current && <span className="ink-search-tag">{t('search.currentPage')}</span>}
                    {b.type === 'collection_view_page' && <span className="ink-search-tag">{t('search.database')}</span>}
                  </span>
                  <span className="ink-search-meta">
                    {path.length > 0 && <><span>{path.length > 2 ? <>{highlight(pageTitle(path[0]), q)} / … / {highlight(pageTitle(path[path.length - 1]), q)}</> : path.map((p, k) => <span key={p.id}>{k > 0 && ' / '}{highlight(pageTitle(p), q)}</span>)}</span><span className="ink-search-dot">•</span></>}
                    <span>{u?.name}</span><span className="ink-search-dot">•</span>
                    <span>{t('search.edited', { ago: relTime(b.edited || Date.now()) })}</span>
                  </span>
                </span>
              </div>
            );
          })}
          {query && !hits.length && <div className="ink-search-empty">{t('search.noResults')}</div>}
        </div>
        {preview && sel && sel.startsWith('__') && <div className="ink-search-preview is-skeleton"><div className="ink-search-preview-cover" /><div className="ink-search-preview-body"><span className="ink-skel-dot" />{[88, 72, 88, 72, 30].map((w, k) => <span key={k} className="ink-skel-line" style={{ width: w + '%' }} />)}</div></div>}
        {preview && sel && !sel.startsWith('__') && <SearchPreview id={sel} onOpen={() => go(sel)} />}
      </div>
      <div className="ink-search-footer">
        <span className="ink-search-hint"><kbd>⌘ ↵</kbd>{t('search.openNewTab')}</span>
        <span className="ink-search-hint"><kbd>⌘ L</kbd>{t('search.copyLink')}</span>
        <span className="ink-search-hint"><kbd>⇧ ⌘ K</kbd>{t('search.commandSearch')}</span>
        <span className="ink-search-spacer" />
        <span role="button" className="ink-search-iconbtn is-small"><Icon name="sliders" size={16} stroke={1.6} /></span>
      </div>
    </div>
  );
}

function pathText(path: Block[]) {
  if (path.length > 2) return `${pageTitle(path[0])} / … / ${pageTitle(path[path.length - 1])}`;
  return path.map((p) => pageTitle(p)).join(' / ');
}

function SearchPreview({ id, onOpen }: { id: string; onOpen: () => void }) {
  const b = store.get(id); if (!b) return null;
  const path = breadcrumbPath(id).slice(0, -1);
  const kids = store.children(id).filter((c) => c.alive).slice(0, 24);
  return (
    <div className="ink-search-preview">
      <div className="ink-search-preview-cover">
        <span className="ink-search-preview-actions">
          <span role="button" aria-label={t('search.copyLinkBtn')} onClick={() => copyPageLink(id)}><Icon name="link" size={16} stroke={1.6} /></span>
          <span role="button" aria-label={t('search.openPage')} onClick={onOpen}><Icon name="arrowUpRight" size={16} stroke={1.6} /></span>
        </span>
      </div>
      <div className="ink-search-preview-body">
        {path.length > 0 && <div className="ink-search-preview-path">{pathText(path)}</div>}
        <div className="ink-search-preview-title">{pageTitle(b)}</div>
        <div className="ink-search-preview-content">{kids.map((c) => <PreviewBlock key={c.id} b={c} depth={0} />)}</div>
      </div>
    </div>
  );
}

const HEAD: Record<string, string> = { header: 'is-h1', sub_header: 'is-h2', sub_sub_header: 'is-h3', header_4: 'is-h4' };
function PreviewBlock({ b, depth }: { b: Block; depth: number }) {
  if (depth > 3) return null;
  const html = { __html: toHtml(b.title, inlineCtx) };
  const kids = b.type === 'toggle' && !b.props?.expanded ? [] : store.children(b.id).filter((c) => c.alive && c.type !== 'page');
  let el: ReactNode;
  if (HEAD[b.type]) el = <div className={'ink-pv-h ' + HEAD[b.type]} dangerouslySetInnerHTML={html} />;
  else if (b.type === 'bulleted_list' || b.type === 'numbered_list' || b.type === 'to_do' || b.type === 'toggle') el = <div className="ink-pv-li"><span className="ink-pv-mark">{b.type === 'bulleted_list' ? '•' : b.type === 'numbered_list' ? '1.' : b.type === 'to_do' ? (b.props?.checked ? '☑' : '☐') : '▸'}</span><span dangerouslySetInnerHTML={html} /></div>;
  else if (b.type === 'text' || b.type === 'quote' || b.type === 'callout') el = <div className={'ink-pv-p' + (b.type === 'quote' ? ' is-quote' : '')} dangerouslySetInnerHTML={html} />;
  else if (b.type === 'divider') el = <div className="ink-pv-hr" />;
  else if (b.type === 'code') el = <pre className="ink-pv-code">{plain(b.title)}</pre>;
  else return null;
  return <>{el}{kids.length > 0 && <div className="ink-pv-kids">{kids.map((c) => <PreviewBlock key={c.id} b={c} depth={depth + 1} />)}</div>}</>;
}

/** A page also matches when one of its ancestor pages does (its path shows the hit). */
function ancestorsMatch(b: Block, q: string): boolean {
  let p = b.parent ? store.get(b.parent) : undefined;
  for (let i = 0; p && i < 8; i++) {
    if ((p.type === 'page' || p.type === 'collection_view_page') && plain(p.title).toLowerCase().includes(q)) return true;
    p = p.parent ? store.get(p.parent) : undefined;
  }
  return false;
}
