/** Database surface: title (full page), view tabs with overflow, toolbar, split 新建 button, and the active view. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Block } from '../store/model';
import { plain } from '../store/model';
import { store } from '../store/store';
import { useBlock, useStoreVersion } from '../hooks/useStore';
import { Icon, type IconName } from '../ui/icons';
import { tip } from '../ui/overlay';
import { openPeek } from '../app/state';
import { viewsOf, addRow, type View, type ViewType } from './model';
import { TableView } from './TableView';
import { BoardView, ListView, GalleryView } from './CardViews';
import { CalendarView, TimelineView } from './TimeViews';
import { openViewsMenu, openNewViewMenu, openViewTabMenu, openFilterMenu, openSortMenu, openSettingsMenu, openNewMenu, openFilterRule } from './menus';
import { schemaOf } from './model';

export const VIEW_ICON: Record<ViewType, IconName> = { table: 'table', board: 'board', list: 'listView', gallery: 'gallery', calendar: 'calendar', timeline: 'timeline' };

const activeViews = new Map<string, string>();
const viewSubs = new Set<() => void>();
export function setActiveView(dbId: string, viewId: string) { activeViews.set(dbId, viewId); viewSubs.forEach((f) => f()); }
export function getActiveView(db: Block): View | undefined { const vs = viewsOf(db); return vs.find((v) => v.id === activeViews.get(db.id)) || vs[0]; }

export interface DbCtx { db: Block; view: View; search: string; inline: boolean; openRow: (rowId: string) => void; locked: boolean }

export function Database({ dbId, inline = false, locked = false }: { dbId: string; inline?: boolean; locked?: boolean }) {
  const db = useBlock(dbId);
  useStoreVersion();
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); viewSubs.add(f); return () => { viewSubs.delete(f); }; }, []);
  const [search, setSearch] = useState<string | null>(null);
  if (!db) return null;
  const view = getActiveView(db);
  if (!view) return null;
  const openRow = (rowId: string) => openPeek(rowId, view.openIn || 'side');
  const ctx: DbCtx = { db, view, search: search || '', inline, openRow, locked };
  return (
    <div className={'ink-db' + (inline ? ' is-inline' : ' is-page')} data-db-id={db.id} data-view-type={view.type}>
      {inline && <DbInlineTitle db={db} />}
      <DbBar db={db} view={view} search={search} setSearch={setSearch} />
      {(view.filter?.length || 0) + (view.sort?.length || 0) > 0 && <DbChips db={db} view={view} />}
      <div className="ink-db-body">
        {view.type === 'table' && <TableView ctx={ctx} />}
        {view.type === 'board' && <BoardView ctx={ctx} />}
        {view.type === 'list' && <ListView ctx={ctx} />}
        {view.type === 'gallery' && <GalleryView ctx={ctx} />}
        {view.type === 'calendar' && <CalendarView ctx={ctx} />}
        {view.type === 'timeline' && <TimelineView ctx={ctx} />}
      </div>
    </div>
  );
}

function DbInlineTitle({ db }: { db: Block }) {
  const ref = useRef<HTMLDivElement>(null);
  const text = plain(db.title);
  useLayoutEffect(() => { const el = ref.current!; if (document.activeElement !== el && el.textContent !== text) el.textContent = text; }, [text]);
  return <div className="ink-db-inline-title" ref={ref} contentEditable suppressContentEditableWarning data-placeholder="新数据库"
    onInput={(e) => { const v = (e.currentTarget.textContent || '').replace(/\n/g, ''); store.transact('title', (tx) => tx.update(db.id, { title: v ? [[v]] : [] }), { coalesce: 'title:' + db.id }); }}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }} />;
}

const OPL: Record<string, string> = { contains: '包含', not_contains: '不包含', is: '', is_not: '不是', empty: '为空', not_empty: '不为空', eq: '=', gt: '>', lt: '<', checked: '已勾选', unchecked: '未勾选', before: '早于', after: '晚于' };
function DbChips({ db, view }: { db: Block; view: View }) {
  const s = schemaOf(db);
  return (
    <div className="ink-db-chips">
      {!!view.sort?.length && <button className="ink-db-chip is-sort" onClick={(e) => openSortMenu(e.currentTarget, db, view)}><Icon name="sort" size={14} />{view.sort.length === 1 ? s[view.sort[0].prop]?.name : `${view.sort.length} 个排序`}<Icon name="chevronDown" size={12} /></button>}
      {!!view.sort?.length && !!view.filter?.length && <span className="ink-db-chip-sep" />}
      {(view.filter || []).map((f, i) => {
        const p = s[f.prop]; if (!p) return null;
        const v = Array.isArray(f.value) ? f.value.join(', ') : f.value || '';
        const has = !!v || ['empty', 'not_empty', 'checked', 'unchecked'].includes(f.op);
        return <button key={i} data-filter-index={i} className={'ink-db-chip' + (has ? ' is-on' : '')} onClick={(e) => openFilterRule(e.currentTarget, db.id, view.id, i)}>
          <span className="ink-db-chip-name">{p.name}{has ? ': ' : ''}</span>{has && <span className="ink-db-chip-val">{OPL[f.op]} {v}</span>}<Icon name="chevronDown" size={12} /></button>;
      })}
      <button className="ink-db-chip is-add" onClick={(e) => openFilterMenu(e.currentTarget, db, view)}><Icon name="plus" size={14} />筛选</button>
    </div>
  );
}

/* ---------- tabs + toolbar ---------- */
function DbBar({ db, view, search, setSearch }: { db: Block; view: View; search: string | null; setSearch: (s: string | null) => void }) {
  const views = viewsOf(db);
  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(views.length);
  useLayoutEffect(() => {
    const calc = () => {
      const bar = barRef.current, m = measureRef.current, tools = toolsRef.current; if (!bar || !m || !tools) return;
      const avail = bar.clientWidth - tools.offsetWidth - 16;
      const widths = [...m.children].map((c) => (c as HTMLElement).offsetWidth);
      const more = 80, add = 28 + 24;
      const all = widths.reduce((a, w) => a + w + 1, 0);
      if (all + add <= avail) { setFit(widths.length); return; }
      let n = 0, used = 0;
      for (let i = 0; i < widths.length; i++) {
        if (used + widths[i] + more > avail) break;
        used += widths[i] + 1; n++;
      }
      setFit(Math.max(1, n));
    };
    calc();
    const ro = new ResizeObserver(calc); if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [views.map((v) => v.name + v.type).join('|'), search != null]);
  // keep the active view visible: if it would overflow, show it in the last visible slot
  let shown = views.slice(0, fit);
  const ai = views.findIndex((v) => v.id === view.id);
  if (ai >= fit && fit > 0) shown = [...views.slice(0, fit - 1), view];
  const hidden = views.length - shown.length;
  const hasFilter = !!view.filter?.length; const hasSort = !!view.sort?.length;
  return (
    <div className="ink-db-bar" ref={barRef}>
      <div className="ink-db-tabs" role="tablist">
        {shown.map((v) => <ViewTab key={v.id} db={db} v={v} active={v.id === view.id} />)}
        {hidden > 0 && <button className="ink-db-tab is-more" onClick={(e) => openViewsMenu(e.currentTarget, db)}>其他 {hidden} 个…</button>}
        {hidden === 0 && <button className="ink-db-addview" aria-label="添加视图" onClick={(e) => openNewViewMenu(e.currentTarget, db)} {...tip('添加视图')}><Icon name="plus" size={16} /></button>}
      </div>
      <div className="ink-db-measure" ref={measureRef} aria-hidden>
        {views.map((v) => <span key={v.id} className="ink-db-tab"><Icon name={VIEW_ICON[v.type]} size={16} /><span>{v.name}</span></span>)}
      </div>
      <div className="ink-db-tools" ref={toolsRef}>
        <button className={'ink-db-tool' + (hasFilter ? ' is-on' : '')} aria-label="筛选" onClick={(e) => openFilterMenu(e.currentTarget, db, view)} {...tip('筛选')}><Icon name="filter" size={16} /></button>
        <button className={'ink-db-tool' + (hasSort ? ' is-on' : '')} aria-label="排序" onClick={(e) => openSortMenu(e.currentTarget, db, view)} {...tip('排序')}><Icon name="sort" size={16} /></button>
        <button className="ink-db-tool" aria-label="自动化" {...tip('自动化')}><Icon name="zap" size={16} /></button>
        <button className="ink-db-tool" aria-label="AI 自动填充" {...tip('AI 自动填充')}><Icon name="wand" size={16} /></button>
        {search == null
          ? <button className="ink-db-tool" aria-label="搜索" onClick={() => setSearch('')} {...tip('搜索')}><Icon name="search" size={16} /></button>
          : <div className="ink-db-search"><Icon name="search" size={16} /><input autoFocus value={search} placeholder="输入以搜索…" onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (!search) setSearch(null); }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSearch(null); } }} /></div>}
        <button className="ink-db-tool" aria-label="设置" onClick={(e) => openSettingsMenu(e.currentTarget, db, view)} {...tip('视图设置')}><Icon name="sliders" size={16} /></button>
        <div className="ink-db-new">
          <button className="ink-db-new-main" onClick={() => { const id = addRow(db.id, { values: defaultsFor(view) }); openPeek(id, view.openIn || 'side'); }}>新建</button>
          <button className="ink-db-new-more" aria-label="更多新建选项" onClick={(e) => openNewMenu(e.currentTarget, db, view)}><Icon name="chevronDown" size={16} /></button>
        </div>
      </div>
    </div>
  );
}
/** new rows inherit simple "is" filters so they stay visible */
export function defaultsFor(view: View, extra: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const f of view.filter || []) if (f.op === 'is' && f.value) out[f.prop] = Array.isArray(f.value) ? f.value[0] : f.value;
  return { ...out, ...extra } as Record<string, never>;
}

function ViewTab({ db, v, active }: { db: Block; v: View; active: boolean }) {
  return (
    <button className={'ink-db-tab' + (active ? ' is-active' : '')} role="tab" aria-selected={active}
      onClick={(e) => { if (active) openViewTabMenu(e.currentTarget, db, v); else setActiveView(db.id, v.id); }}
      onContextMenu={(e) => { e.preventDefault(); openViewTabMenu(e.currentTarget, db, v); }}>
      <Icon name={VIEW_ICON[v.type]} size={16} /><span>{v.name}</span>
    </button>
  );
}

/** "+ 新页面" footer shared by table / list */
export function NewRowButton({ onClick, label = '新页面', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return <div className={'ink-db-newrow ' + className} role="button" onClick={onClick}><Icon name="plus" size={16} /><span>{label}</span></div>;
}
