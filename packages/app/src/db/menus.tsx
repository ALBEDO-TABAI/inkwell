/** Database menus: views, new view, tab menu, property header + type menus, filter / sort / group panels, calculations, settings, cards. */
import { useEffect, useState, type ReactNode } from 'react';
import type { Block } from '../store/model';
import { store } from '../store/store';
import { openMenu, type MenuEntry, type MenuItemSpec, type MenuSpec } from '../ui/menu';
import { openPopover, closePopover } from '../ui/overlay';
import { Icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { openPeek } from '../app/state';
import { duplicateBlock, pageTitle } from '../app/pages';
import {
  schemaOf, viewsOf, propIds, updateDb, updateView, addProp, addRow, deleteRow, VIEW_NAMES, PROP_DEFAULT_NAME, STATUS_DEFAULT,
  ROLLUP_LABEL, templatesOf, addTemplate, deleteTemplate, addRowFromTemplate, type Prop, type RollupFn,
  type View, type ViewType, type PropType, type CalcFn, type FilterRule, type FilterOp, type SortRule,
} from './model';
import { PropIcon, Tag, StatusPill } from './cells';
import { DatePicker } from './editors';
import { setActiveView, VIEW_ICON, setBarOpen, defaultsFor } from './Database';
import { PageIcon } from '../ui/PageIcon';

const R = (el: HTMLElement) => el.getBoundingClientRect();
const live = (f: () => void) => { const [, set] = useState(0); useEffect(() => store.subscribe(() => set((x) => x + 1)), []); void f; };
const sortedProps = (db: Block) => { const s = schemaOf(db); const ids = Object.keys(s); return ['title', ...ids.filter((k) => k !== 'title').sort((a, b) => s[a].name.localeCompare(s[b].name, 'en'))].filter((k) => s[k]); };

/* ---------- views ---------- */
export function openViewsMenu(anchor: HTMLElement, db: Block) {
  const views = viewsOf(db);
  openMenu(R(anchor), {
    width: 290, search: '搜索视图…',
    groups: [
      views.map((v) => ({ id: v.id, label: v.name, text: v.name, icon: <span className="ink-vm-lead"><span className="ink-vm-grip"><Icon name="grip" size={14} /></span><Icon name={VIEW_ICON[v.type]} size={16} /></span>,
        right: <span className="ink-vm-more" role="button" onClick={(e) => { e.stopPropagation(); openViewTabMenu(e.currentTarget as HTMLElement, store.get(db.id)!, v); }}><Icon name="more" size={16} /></span>,
        onSelect: () => setActiveView(db.id, v.id) })),
      [{ id: 'new', label: '新视图', icon: 'plus', onSelect: () => setTimeout(() => openNewViewMenu(anchor, store.get(db.id)!), 0) },
        { id: 'src', label: '新数据源', icon: 'duplicate', onSelect: () => toast('多数据源将在后续版本提供') }],
    ],
  }, { placement: 'bottom-start', anchorEl: anchor });
}

const NEW_VIEW_TYPES: { type: ViewType | null; label: string; icon: IconName }[] = [
  { type: 'table', label: '表格', icon: 'table' }, { type: 'board', label: '看板', icon: 'board' }, { type: 'gallery', label: '画廊', icon: 'gallery' }, { type: 'list', label: '列表', icon: 'listView' },
  { type: null, label: '图表', icon: 'chart' }, { type: null, label: '管理面板', icon: 'dashboard' }, { type: 'timeline', label: '时间轴', icon: 'timeline' }, { type: null, label: '动态', icon: 'feed' },
  { type: null, label: '地图', icon: 'map' }, { type: 'calendar', label: '日历', icon: 'calendar' }, { type: null, label: '表单', icon: 'form' },
];
export function createView(db: Block, type: ViewType) {
  const id = 'v' + Math.random().toString(36).slice(2, 8);
  const s = schemaOf(db);
  const names = new Set(viewsOf(db).map((v) => v.name));
  let name = VIEW_NAMES[type]; let i = 2; while (names.has(name)) name = `${VIEW_NAMES[type]} ${i++}`;
  const dateProp = Object.keys(s).find((k) => s[k].type === 'date');
  const group = Object.keys(s).find((k) => s[k].type === 'status') || Object.keys(s).find((k) => s[k].type === 'select');
  const v: View = { id, name, type, ...(type === 'board' ? { group } : {}), ...(type === 'calendar' || type === 'timeline' ? { dateProp } : {}), ...(type === 'gallery' ? { gallerySize: 'M' as const } : {}) };
  updateDb(db.id, ({ views }) => ({ views: [...views, v] }), 'new view');
  setActiveView(db.id, id);
}
export function openNewViewMenu(anchor: HTMLElement, db: Block) {
  openPopover({ id: 'db-newview', anchor: R(anchor), placement: 'bottom-end', offset: 4, render: (close) => (
    <div className="ink-menu ink-newview" role="dialog">
      <div className="ink-menu-label" style={{ margin: '12px 0 6px' }}>添加新视图</div>
      <div className="ink-newview-grid">
        {NEW_VIEW_TYPES.map((t) => (
          <button key={t.label} className={'ink-newview-item' + (t.type ? '' : ' is-disabled')} disabled={!t.type} onClick={() => { if (t.type) { createView(store.get(db.id)!, t.type); close(); } }}>
            <Icon name={t.icon} size={16} /><span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  ) });
}

export function openViewTabMenu(anchor: HTMLElement, db: Block, v: View) {
  const views = viewsOf(db);
  openMenu(R(anchor), {
    width: 265,
    groups: [
      [{ kind: 'custom', key: 'name', render: () => <NameInput value={v.name} onCommit={(name) => name && updateView(db.id, v.id, { name }, 'rename view')} lead={<Icon name={VIEW_ICON[v.type]} size={16} />} /> }],
      [{ id: 'edit', label: '编辑视图', icon: 'sliders', onSelect: () => setTimeout(() => openSettingsMenu(anchor, store.get(db.id)!, viewsOf(store.get(db.id)!).find((x) => x.id === v.id)!), 0) },
        { id: 'link', label: '拷贝视图链接', icon: 'link', onSelect: () => { navigator.clipboard?.writeText(`inkwell://p/${db.id}?v=${v.id}`).catch(() => {}); toast('已拷贝链接到剪贴板'); } },
        { id: 'dup', label: '创建副本', icon: 'copy', onSelect: () => { const id = 'v' + Math.random().toString(36).slice(2, 8); updateDb(db.id, ({ views }) => ({ views: [...views.slice(0, views.findIndex((x) => x.id === v.id) + 1), { ...v, id, name: v.name + ' (1)' }, ...views.slice(views.findIndex((x) => x.id === v.id) + 1)] }), 'duplicate view'); setActiveView(db.id, id); } },
        { id: 'del', label: '删除视图', icon: 'trash', danger: true, disabled: views.length <= 1, onSelect: () => { updateDb(db.id, ({ views }) => ({ views: views.filter((x) => x.id !== v.id) }), 'delete view'); setActiveView(db.id, views.find((x) => x.id !== v.id)!.id); } }],
    ],
  }, { anchorEl: anchor });
}

function NameInput({ value, onCommit, lead, info }: { value: string; onCommit: (v: string) => void; lead?: ReactNode; info?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => () => { if (v.trim() !== value) onCommit(v.trim()); }, [v]);
  return (
    <div className="ink-hm-name">
      {lead && <span className="ink-hm-type">{lead}</span>}
      <span className="ink-hm-input"><input className="ink-menu-search" data-autofocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit(v.trim()); closePopover(e.currentTarget.closest('[data-popover-id]')!.getAttribute('data-popover-id')!); } }} />
      {info && <span className="ink-hm-info" title="属性说明"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="6.5" fill="currentColor" /><path d="M7 6.2v3.6M7 4.2v.1" stroke="var(--ink-background-elevated)" strokeWidth="1.6" strokeLinecap="round" /></svg></span>}</span>
    </div>
  );
}

/* ---------- property types ---------- */
const TYPE_ORDER: { type: PropType | null; label: string; icon?: IconName }[] = [
  { type: 'text', label: '文本' }, { type: 'number', label: '数字' }, { type: 'select', label: '选择' }, { type: 'multi_select', label: '多选' }, { type: 'status', label: '状态' },
  { type: 'date', label: '日期' }, { type: 'person', label: '人员' }, { type: null, label: '文件和媒体', icon: 'image' }, { type: 'checkbox', label: '复选框' }, { type: 'url', label: '网址' },
  { type: 'email', label: '电子邮件' }, { type: 'phone_number', label: '电话' }, { type: 'formula', label: '函数' }, { type: 'relation', label: '关联关系' }, { type: 'rollup', label: '汇总' },
  { type: 'created_time', label: '创建时间' },
];
const typeItems = (onPick: (t: PropType) => void, current?: PropType): MenuItemSpec[] => TYPE_ORDER.map((t) => ({
  id: 't-' + t.label, label: t.label, text: t.label, keywords: t.type ? [t.type] : [],
  icon: t.type ? <PropIcon type={t.type} /> : <Icon name={t.icon!} size={16} />, checked: !!t.type && t.type === current, onSelect: () => (t.type ? onPick(t.type) : toast(`“${t.label}”属性将在后续版本提供`)),
}));
export function openAddPropMenu(anchor: HTMLElement, db: Block, view: View, at?: { after?: string; before?: string }) {
  openMenu(R(anchor), { width: 265, search: '搜索或添加新属性', maxHeight: 520,
    groups: [[{ kind: 'label', label: '类型' }, ...typeItems((t) => { const id = addProp(db.id, t, { at: at ? { viewId: view.id, ...at } : undefined }); setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-db-id="${db.id}"] .ink-tv-hcell[data-prop="${id}"]`); if (el) openHeaderMenu(el, store.get(db.id)!, viewsOf(store.get(db.id)!).find((x) => x.id === view.id)!, id); }, 30); })]] },
  { placement: 'bottom-start', anchorEl: anchor });
}
function changeType(db: Block, propId: string, type: PropType) {
  updateDb(db.id, ({ schema }) => {
    const p = schema[propId];
    const options = type === 'status' ? (p.options?.length ? p.options.map((o, i) => ({ ...o, group: o.group || (i === 0 ? 'todo' : 'doing') })) : STATUS_DEFAULT) : (type === 'select' || type === 'multi_select') ? (p.options || []) : undefined;
    return { schema: { ...schema, [propId]: { ...p, type, ...(options ? { options } : {}), ...(type === 'formula' && !p.formula ? { formula: '' } : {}) } } };
  }, 'change type');
}

/* ---------- property header menu ---------- */
export const CALC_LABEL: Record<CalcFn, string> = { none: '无', count_all: '全部计数', count_values: '值计数', count_empty: '空白计数', count_not_empty: '非空白计数', percent_empty: '空白百分比', percent_not_empty: '非空白百分比', sum: '求和', average: '平均值', median: '中位数', min: '最小值', max: '最大值', range: '范围', checked: '已勾选', unchecked: '未勾选' };
function calcGroups(db: Block, view: View, propId: string): MenuSpec {
  const p = schemaOf(db)[propId];
  const set = (fn: CalcFn) => updateView(db.id, view.id, (v) => ({ calcs: { ...v.calcs, [propId]: fn } }), 'calculate');
  const cur = view.calcs?.[propId] || 'none';
  const it = (fn: CalcFn): MenuItemSpec => ({ id: fn, label: CALC_LABEL[fn], checked: cur === fn, onSelect: () => set(fn) });
  const numeric = p.type === 'number' || p.type === 'formula' || p.type === 'rollup';
  return { width: 220, groups: [[
    it('none'),
    { id: 'count', label: '总数', sub: () => ({ width: 200, groups: [[it('count_all'), it('count_values'), it('count_empty'), it('count_not_empty')]] }) },
    { id: 'pct', label: '百分比', sub: () => ({ width: 200, groups: [[it('percent_empty'), it('percent_not_empty')]] }) },
    ...(p.type === 'checkbox' ? [it('checked'), it('unchecked')] : []),
    { id: 'more', label: '更多选择', disabled: !numeric, sub: numeric ? () => ({ width: 200, groups: [[it('sum'), it('average'), it('median'), it('min'), it('max'), it('range')]] }) : undefined },
  ]] };
}
export function openCalcMenu(anchor: HTMLElement, db: Block, view: View, propId: string) { openMenu(R(anchor), calcGroups(db, view, propId), { placement: 'top-start', anchorEl: anchor }); }

export function openHeaderMenu(anchor: HTMLElement, db: Block, view: View, propId: string) {
  const s = schemaOf(db); const p = s[propId]; if (!p) return;
  const isTitle = p.type === 'title';
  const order = propIds(db, view); const idx = order.indexOf(propId);
  const frozenHere = (view.frozen || 0) === idx + 1;
  anchor.classList.add('is-open');
  const groups: MenuEntry[][] = [
    [{ kind: 'custom', key: 'name', render: () => <NameInput value={p.name} info lead={<PropIcon type={p.type} />} onCommit={(name) => name && updateDb(db.id, ({ schema }) => ({ schema: { ...schema, [propId]: { ...schema[propId], name } } }), 'rename property')} /> },
      { id: 'access', label: '属性访问权限', icon: 'lock', onSelect: () => toast('属性访问权限需要团队空间') },
      ...(!isTitle ? [{ id: 'type', label: '更改类型', icon: 'sortDown' as IconName, sub: () => ({ width: 265, search: '搜索属性类型…', maxHeight: 480, groups: [typeItems((t) => changeType(db, propId, t), p.type)] }) }] : []),
      { id: 'ai', label: 'AI 自动填充', icon: 'wand', right: <span className="ink-badge-blue">现已支持代理</span>, sub: () => ({ width: 220, groups: [[{ id: 'off', label: 'AI 功能未启用', disabled: true }]] }) },
      ...(p.type === 'formula' ? [{ kind: 'custom' as const, key: 'formula', render: () => <FormulaInput db={db} propId={propId} /> }] : []),
      ...relationItems(db, propId),
    ],
    [
      { id: 'filter', label: '筛选', icon: 'filter', onSelect: () => setTimeout(() => addFilter(store.get(db.id)!, view, propId, anchor), 0) },
      { id: 'sort', label: '排序', icon: 'sort', sub: () => ({ width: 200, groups: [[
        { id: 'asc', label: '升序', icon: 'arrowUp' as IconName, onSelect: () => updateView(db.id, view.id, (v) => ({ sort: [{ prop: propId, dir: 'asc' }] }), 'sort') },
        { id: 'desc', label: '降序', icon: 'arrowDown' as IconName, onSelect: () => updateView(db.id, view.id, (v) => ({ sort: [{ prop: propId, dir: 'desc' }] }), 'sort') }]] }) },
      { id: 'group', label: '群组', icon: 'dashboard', checked: view.group === propId, onSelect: () => updateView(db.id, view.id, (v) => ({ group: v.group === propId ? undefined : propId }), 'group') },
      { id: 'calc', label: '计算', icon: 'sigma', sub: () => calcGroups(store.get(db.id)!, viewsOf(store.get(db.id)!).find((x) => x.id === view.id)!, propId) },
      { id: 'freeze', label: frozenHere ? '取消冻结' : '冻结', icon: 'pin', onSelect: () => updateView(db.id, view.id, { frozen: frozenHere ? 0 : idx + 1 }, 'freeze') },
      ...(!isTitle ? [{ id: 'hide', label: '隐藏', icon: 'eyeOff' as IconName, onSelect: () => updateView(db.id, view.id, (v) => ({ hidden: [...(v.hidden || []), propId] }), 'hide property') }] : []),
      { id: 'wrap', label: p.wrap ? '取消内容自动换行' : '内容自动换行', icon: 'wrap', onSelect: () => updateDb(db.id, ({ schema }) => ({ schema: { ...schema, [propId]: { ...schema[propId], wrap: !schema[propId].wrap } } }), 'wrap') },
    ],
    [
      { id: 'left', label: '在左侧插入', icon: 'insertLeft', onSelect: () => setTimeout(() => openAddPropMenu(anchor, store.get(db.id)!, view, { before: propId }), 0) },
      { id: 'right', label: '在右侧插入', icon: 'insertRight', onSelect: () => setTimeout(() => openAddPropMenu(anchor, store.get(db.id)!, view, { after: propId }), 0) },
      ...(!isTitle ? [
        { id: 'dup', label: '创建属性副本', icon: 'copy' as IconName, onSelect: () => duplicateProp(db, view, propId) },
        { id: 'del', label: '删除属性', icon: 'trash' as IconName, danger: true, onSelect: () => { updateDb(db.id, ({ schema, views }) => { const n = { ...schema }; delete n[propId]; return { schema: n, views: views.map((v) => ({ ...v, sort: v.sort?.filter((r) => r.prop !== propId), filter: v.filter?.filter((r) => r.prop !== propId), group: v.group === propId ? undefined : v.group })) }; }, 'delete property'); toast('已删除属性'); } },
      ] : []),
    ],
  ];
  openMenu(() => R(anchor), { width: 232, groups }, { placement: 'bottom-start', anchorEl: anchor, offset: 4 });
}
function FormulaInput({ db, propId }: { db: Block; propId: string }) {
  const [v, setV] = useState(schemaOf(db)[propId]?.formula || '');
  useEffect(() => () => updateDb(db.id, ({ schema }) => (schema[propId] ? { schema: { ...schema, [propId]: { ...schema[propId], formula: v } } } : {}), 'formula'), [v]);
  return <div className="ink-hm-formula"><Icon name="sigma" size={16} /><input className="ink-menu-search" value={v} placeholder='prop("Score") * 2' onChange={(e) => setV(e.target.value)} spellCheck={false} /></div>;
}
function duplicateProp(db: Block, view: View, propId: string) {
  const s = schemaOf(db); const p = s[propId];
  const id = addProp(db.id, p.type, { name: p.name + ' (1)', at: { viewId: view.id, after: propId } });
  updateDb(db.id, ({ schema }) => ({ schema: { ...schema, [id]: { ...p, name: schema[id].name } } }), 'duplicate property');
  store.transact('duplicate property', (tx) => { for (const r of store.children(db.id)) if (r.props?.[propId] !== undefined) tx.update(r.id, { props: { ...r.props, [id]: r.props[propId] } }); });
}

/* relation / rollup configuration rows in the header menu */
function relationItems(db: Block, propId: string): MenuItemSpec[] {
  const p = schemaOf(db)[propId]; const s = schemaOf(db);
  const setP = (patch: Partial<Prop>, label: string) => updateDb(db.id, ({ schema }) => ({ schema: { ...schema, [propId]: { ...schema[propId], ...patch } } }), label);
  const dbs = [...new Set([db.id, ...allDbIds()])];
  if (p.type === 'relation') {
    const target = store.get(p.relation?.db || db.id);
    return [{ id: 'rel-db', label: '关联到', icon: 'arrowUpRight', right: <span className="ink-menu-value">{pageTitle(target)}</span>, sub: () => ({ width: 240, groups: [dbs.map((id) => ({ id: 'd' + id, label: pageTitle(store.get(id)), checked: id === (p.relation?.db || db.id), onSelect: () => setP({ relation: { db: id } }, 'relation target') }))] }) }];
  }
  if (p.type !== 'rollup') return [];
  const r = p.rollup || { fn: 'show' as RollupFn };
  const rels = Object.keys(s).filter((k) => s[k].type === 'relation');
  const rel = r.relation ? s[r.relation] : undefined;
  const target = store.get(rel?.relation?.db || db.id);
  const tSchema = target ? schemaOf(target) : {};
  return [
    { id: 'ru-rel', label: '关联关系', icon: 'arrowUpRight', right: <span className="ink-menu-value">{rel?.name || '选择'}</span>, sub: () => ({ width: 220, groups: [rels.length ? rels.map((k) => ({ id: 'r' + k, label: s[k].name, icon: <PropIcon type="relation" />, checked: k === r.relation, onSelect: () => setP({ rollup: { ...r, relation: k } }, 'rollup relation') })) : [{ id: 'none', label: '先添加一个关联关系属性', disabled: true }]] }) },
    { id: 'ru-prop', label: '属性', icon: 'listView', right: <span className="ink-menu-value">{tSchema[r.target || 'title']?.name || '—'}</span>, sub: () => ({ width: 220, search: '搜索属性…', groups: [Object.keys(tSchema).filter((k) => tSchema[k].type !== 'rollup').map((k) => ({ id: 'p' + k, label: tSchema[k].name, icon: <PropIcon type={tSchema[k].type} />, checked: k === (r.target || 'title'), onSelect: () => setP({ rollup: { ...r, target: k } }, 'rollup property') }))] }) },
    { id: 'ru-fn', label: '计算', icon: 'sigma', right: <span className="ink-menu-value">{ROLLUP_LABEL[r.fn]}</span>, sub: () => ({ width: 200, groups: [(Object.keys(ROLLUP_LABEL) as RollupFn[]).map((fn) => ({ id: 'f' + fn, label: ROLLUP_LABEL[fn], checked: fn === r.fn, onSelect: () => setP({ rollup: { ...r, fn } }, 'rollup function') }))] }) },
  ];
}
function allDbIds(): string[] {
  const out: string[] = [];
  for (const b of store.blocks.values()) if ((b.type === 'collection_view_page' || b.type === 'collection_view') && b.alive !== false && b.props?.schema) out.push(b.id);
  return out;
}

/* ---------- filter ---------- */
const OPS: Partial<Record<PropType, FilterOp[]>> = {
  title: ['contains', 'not_contains', 'is', 'is_not', 'empty', 'not_empty'], text: ['contains', 'not_contains', 'is', 'is_not', 'empty', 'not_empty'],
  url: ['contains', 'not_contains', 'empty', 'not_empty'], email: ['contains', 'not_contains', 'empty', 'not_empty'], phone_number: ['contains', 'not_contains', 'empty', 'not_empty'],
  number: ['eq', 'gt', 'lt', 'empty', 'not_empty'], formula: ['contains', 'eq', 'gt', 'lt', 'empty', 'not_empty'],
  select: ['is', 'is_not', 'empty', 'not_empty'], status: ['is', 'is_not', 'empty', 'not_empty'], multi_select: ['is', 'is_not', 'empty', 'not_empty'], person: ['contains', 'empty', 'not_empty'],
  date: ['is', 'before', 'after', 'empty', 'not_empty'], created_time: ['before', 'after'], checkbox: ['checked', 'unchecked'],
  relation: ['contains', 'empty', 'not_empty'], rollup: ['contains', 'eq', 'gt', 'lt', 'empty', 'not_empty'],
};
const OP_LABEL: Record<FilterOp, string> = { contains: '包含', not_contains: '不包含', is: '是', is_not: '不是', empty: '为空', not_empty: '不为空', eq: '=', gt: '>', lt: '<', checked: '已勾选', unchecked: '未勾选', before: '早于', after: '晚于' };

function propPicker(db: Block, title: string, onPick: (id: string) => void, extra: MenuEntry[][] = []): MenuSpec {
  const s = schemaOf(db);
  return { width: 290, search: title, maxHeight: 440, groups: [sortedProps(db).map((id) => ({ id, label: s[id].name, text: s[id].name, icon: <PropIcon type={s[id].type} />, onSelect: () => onPick(id) })), ...extra] };
}
export function openFilterMenu(anchor: HTMLElement, db: Block, view: View) {
  if (view.filter?.length && !anchor.closest('.ink-db-chips')) { setBarOpen(view.id, true); setTimeout(() => { const c = chipEl(db.id, '[data-filter-index="0"]'); if (c) openFilterRule(c, db.id, view.id, 0); }, 30); return; }
  openMenu(R(anchor), propPicker(db, '筛选方式…', (id) => setTimeout(() => addFilter(store.get(db.id)!, view, id, anchor), 0),
    [[{ id: 'adv', label: '添加高级筛选', icon: 'plus', disabled: true }]]), { placement: 'bottom-start', anchorEl: anchor });
}
function addFilter(db: Block, view: View, propId: string, anchor: HTMLElement) {
  const p = schemaOf(db)[propId];
  const op = (OPS[p.type] || ['contains'])[0];
  const idx = (viewsOf(db).find((v) => v.id === view.id)?.filter || []).length;
  updateView(db.id, view.id, (v) => ({ filter: [...(v.filter || []), { prop: propId, op }] }), 'filter');
  setBarOpen(view.id, true);
  setTimeout(() => {
    const chip = document.querySelector<HTMLElement>(`[data-db-id="${db.id}"] .ink-db-chip[data-filter-index="${idx}"]`);
    openFilterRule(chip || anchor, db.id, view.id, idx);
  }, 30);
}
export function openFilterRule(anchor: HTMLElement, dbId: string, viewId: string, index: number) {
  openPopover({ id: 'db-filter-rule', anchor: R(anchor), placement: 'bottom-start', offset: 4, render: (close) => <FilterRuleEditor dbId={dbId} viewId={viewId} index={index} close={close} /> });
}
function FilterRuleEditor({ dbId, viewId, index, close }: { dbId: string; viewId: string; index: number; close: () => void }) {
  live(() => {});
  const db = store.get(dbId); const view = db && viewsOf(db).find((v) => v.id === viewId);
  const rule = view?.filter?.[index];
  if (!db || !view || !rule) return null;
  const p = schemaOf(db)[rule.prop]; if (!p) return null;
  const set = (patch: Partial<FilterRule>) => updateView(dbId, viewId, (v) => ({ filter: (v.filter || []).map((r, i) => (i === index ? { ...r, ...patch } : r)) }), 'filter');
  const needsValue = !['empty', 'not_empty', 'checked', 'unchecked'].includes(rule.op);
  const vals = Array.isArray(rule.value) ? rule.value : rule.value ? [rule.value] : [];
  return (
    <div className="ink-menu ink-filter-rule" style={{ width: 290 }}>
      <div className="ink-fr-head">
        <span className="ink-fr-prop">{p.name}</span>
        <button className="ink-fr-op" onClick={(e) => openMenu(R(e.currentTarget), { width: 180, groups: [(OPS[p.type] || ['contains']).map((op) => ({ id: op, label: OP_LABEL[op], checked: op === rule.op, onSelect: () => set({ op }) }))] }, { parent: 'db-filter-rule' })}>{OP_LABEL[rule.op]}<Icon name="chevronDown" size={12} /></button>
        <span style={{ flex: 1 }} />
        <button className="ink-fr-more" aria-label="删除筛选" onClick={() => { updateView(dbId, viewId, (v) => ({ filter: (v.filter || []).filter((_, i) => i !== index) }), 'remove filter'); close(); }}><Icon name="trash" size={16} /></button>
      </div>
      {needsValue && (p.type === 'select' || p.type === 'status' || p.type === 'multi_select') ? (
        <div className="ink-fr-opts">
          {(p.options || []).map((o) => (
            <label key={o.v} className="ink-menu-item">
              <input type="checkbox" checked={vals.includes(o.v)} onChange={() => set({ value: vals.includes(o.v) ? vals.filter((x) => x !== o.v) : [...vals, o.v] })} />
              {p.type === 'status' ? <StatusPill label={o.v} color={o.c} /> : <Tag label={o.v} color={o.c} />}
            </label>
          ))}
        </div>
      ) : needsValue && (p.type === 'date' || p.type === 'created_time') ? (
        <DatePicker value={vals.length ? [vals[0]] : []} showEnd={false} onChange={(v) => set({ value: v[0] })} />
      ) : needsValue ? (
        <div className="ink-fr-input"><input className="ink-menu-search" data-autofocus value={vals[0] || ''} placeholder="输入一个值…" onChange={(e) => set({ value: e.target.value })} /></div>
      ) : <div style={{ height: 6 }} />}
    </div>
  );
}

/* ---------- sort ---------- */
const chipEl = (dbId: string, sel: string) => document.querySelector<HTMLElement>(`[data-db-id="${dbId}"] .ink-db-chips ${sel}`);
export function openSortMenu(anchor: HTMLElement, db: Block, view: View, fromChip = false) {
  const viaBar = () => { setBarOpen(view.id, true); setTimeout(() => openSortPanel(chipEl(db.id, '.is-sort') || anchor, db.id, view.id), 30); };
  if (fromChip) { openSortPanel(anchor, db.id, view.id); return; }
  if (!view.sort?.length) {
    openMenu(R(anchor), propPicker(db, '排序方式…', (id) => { updateView(db.id, view.id, { sort: [{ prop: id, dir: 'asc' }] }, 'sort'); viaBar(); }), { placement: 'bottom-start', anchorEl: anchor });
  } else viaBar();
}
function openSortPanel(anchor: HTMLElement, dbId: string, viewId: string) {
  openPopover({ id: 'db-sort', anchor: R(anchor), placement: 'bottom-start', offset: 5, render: (close) => <SortPanel dbId={dbId} viewId={viewId} close={close} /> });
}
const dirLabel = (t: PropType | undefined, d: 'asc' | 'desc') => (t === 'title' || t === 'text' || t === 'url' || t === 'email' ? (d === 'asc' ? '按“A → Z”排序' : '按“Z → A”排序') : t === 'number' || t === 'formula' ? (d === 'asc' ? '按“1 → 9”排序' : '按“9 → 1”排序') : d === 'asc' ? '升序' : '降序');
function SortPanel({ dbId, viewId, close }: { dbId: string; viewId: string; close: () => void }) {
  live(() => {});
  const db = store.get(dbId); const view = db && viewsOf(db).find((v) => v.id === viewId);
  if (!db || !view) return null;
  const s = schemaOf(db); const rules = view.sort || [];
  const set = (rs: SortRule[]) => updateView(dbId, viewId, { sort: rs }, 'sort');
  return (
    <div className="ink-menu ink-sort-panel" style={{ width: 328 }}>
      <div className="ink-sort-rules">
        {rules.map((r, i) => (
          <div key={i} className="ink-sort-rule">
            <span className="ink-sort-grip"><Icon name="grip" size={14} /></span>
            <button className="ink-sort-btn" onClick={(e) => openMenu(R(e.currentTarget), propPicker(db, '搜索属性…', (id) => set(rules.map((x, j) => (j === i ? { ...x, prop: id } : x)))), { parent: 'db-sort' })}>{s[r.prop] && <PropIcon type={s[r.prop].type} />}{s[r.prop]?.name}<Icon name="chevronDown" size={12} /></button>
            <button className="ink-sort-btn" onClick={(e) => openMenu(R(e.currentTarget), { width: 140, groups: [[{ id: 'asc', label: dirLabel(s[r.prop]?.type, 'asc'), checked: r.dir === 'asc', onSelect: () => set(rules.map((x, j) => (j === i ? { ...x, dir: 'asc' as const } : x))) }, { id: 'desc', label: dirLabel(s[r.prop]?.type, 'desc'), checked: r.dir === 'desc', onSelect: () => set(rules.map((x, j) => (j === i ? { ...x, dir: 'desc' as const } : x))) }]] }, { parent: 'db-sort' })}>{dirLabel(s[r.prop]?.type, r.dir)}<Icon name="chevronDown" size={12} /></button>
            <span style={{ flex: 1 }} />
            <button className="ink-sort-x" aria-label="删除排序" onClick={() => set(rules.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      <div className="ink-menu-group">
        <div className="ink-menu-item" onClick={(e) => openMenu(R(e.currentTarget), propPicker(db, '搜索属性…', (id) => set([...rules, { prop: id, dir: 'asc' }])), { parent: 'db-sort' })}><Icon name="plus" size={16} /> 添加排序</div>
        <div className="ink-menu-item" onClick={() => { set([]); close(); }}><Icon name="trash" size={16} /> 删除排序</div>
      </div>
    </div>
  );
}

/* ---------- settings / group ---------- */
export function openGroupPanel(anchor: HTMLElement, db: Block, view: View) {
  const s = schemaOf(db);
  const groupable = sortedProps(db).filter((id) => !['title', 'formula', 'relation', 'rollup'].includes(s[id].type));
  openPopover({ id: 'db-group', anchor: R(anchor), placement: 'bottom-end', offset: 4, className: 'ink-group-pop', render: (close) => (
    <div className="ink-menu ink-group-panel" style={{ width: 290 }}>
      <div className="ink-gp-head"><button className="ink-gp-back" aria-label="返回" onClick={close}><Icon name="arrowLeft" size={16} /></button><span>分组方式</span><span style={{ flex: 1 }} /><button className="ink-gp-back" aria-label="关闭" onClick={close}><Icon name="x" size={16} /></button></div>
      <GroupList db={db} view={view} ids={groupable} close={close} />
    </div>
  ) });
}
function GroupList({ db, view, ids, close }: { db: Block; view: View; ids: string[]; close: () => void }) {
  const [q, setQ] = useState(''); const s = schemaOf(db);
  const pick = (g?: string) => { updateView(db.id, view.id, { group: g }, 'group'); close(); };
  return <>
    <div className="ink-menu-search-wrap" style={{ paddingTop: 4 }}><input className="ink-menu-search" data-autofocus placeholder="搜索属性…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <div className="ink-menu-group">
      {!q && <div className="ink-menu-item" onClick={() => pick(undefined)}><span style={{ flex: 1 }}>无</span>{!view.group && <Icon name="check" size={16} />}</div>}
      {ids.filter((id) => !q || s[id].name.toLowerCase().includes(q.toLowerCase())).map((id) => <div key={id} className="ink-menu-item" onClick={() => pick(id)}><span className="ink-menu-icon"><PropIcon type={s[id].type} /></span><span style={{ flex: 1 }}>{s[id].name}</span>{view.group === id && <Icon name="check" size={16} />}</div>)}
    </div>
  </>;
}
export function openSettingsMenu(anchor: HTMLElement, db: Block, view: View) {
  const s = schemaOf(db);
  const layoutItems: MenuItemSpec[] = (['table', 'board', 'list', 'gallery', 'calendar', 'timeline'] as ViewType[]).map((t) => ({ id: t, label: { table: '表格', board: '看板', list: '列表', gallery: '画廊', calendar: '日历', timeline: '时间轴' }[t], icon: VIEW_ICON[t], checked: view.type === t,
    onSelect: () => updateView(db.id, view.id, (v) => ({ type: t, ...(t === 'board' && !v.group ? { group: Object.keys(s).find((k) => s[k].type === 'status' || s[k].type === 'select') } : {}), ...((t === 'calendar' || t === 'timeline') && !v.dateProp ? { dateProp: Object.keys(s).find((k) => s[k].type === 'date') } : {}) }), 'layout') }));
  const propItems = (): MenuSpec => ({ width: 290, search: '搜索属性…', maxHeight: 460, groups: [propIds(store.get(db.id)!, view).filter((id) => id !== 'title').map((id) => {
    const cur = viewsOf(store.get(db.id)!).find((x) => x.id === view.id)!;
    const shown = view.type === 'table' ? !cur.hidden?.includes(id) : !!cur.cardProps?.includes(id);
    return { id, label: s[id].name, text: s[id].name, icon: <PropIcon type={s[id].type} />, toggle: shown, keepOpen: true, onSelect: () => updateView(db.id, view.id, (v) => view.type === 'table' ? { hidden: shown ? [...(v.hidden || []), id] : (v.hidden || []).filter((x) => x !== id) } : { cardProps: shown ? (v.cardProps || []).filter((x) => x !== id) : [...(v.cardProps || []), id] }, 'property visibility') };
  })] });
  const groups: MenuEntry[][] = [
    [{ kind: 'custom', key: 'name', render: () => <NameInput value={view.name} lead={<Icon name={VIEW_ICON[view.type]} size={16} />} onCommit={(name) => name && updateView(db.id, view.id, { name }, 'rename view')} /> }],
    [
      { id: 'layout', label: '布局', icon: VIEW_ICON[view.type], right: <span className="ink-menu-value">{({ table: '表格', board: '看板', list: '列表', gallery: '画廊', calendar: '日历', timeline: '时间轴' } as const)[view.type]}</span>, sub: () => ({ width: 220, groups: [layoutItems] }) },
      { id: 'props', label: '属性', icon: 'listView', right: <span className="ink-menu-value">{view.type === 'table' ? Object.keys(s).length - (view.hidden?.length || 0) : (view.cardProps?.length || 0) + 1} 个已显示</span>, sub: propItems },
      { id: 'filter', label: '筛选', icon: 'filter', right: view.filter?.length ? <span className="ink-menu-value">{view.filter.length} 个筛选</span> : undefined, onSelect: () => setTimeout(() => openFilterMenu(anchor, store.get(db.id)!, view), 0) },
      { id: 'sort', label: '排序', icon: 'sort', right: view.sort?.length ? <span className="ink-menu-value">{view.sort.length} 个排序</span> : undefined, onSelect: () => setTimeout(() => openSortMenu(anchor, store.get(db.id)!, view), 0) },
      { id: 'group', label: '分组', icon: 'dashboard', right: view.group && s[view.group] ? <span className="ink-menu-value">{s[view.group].name}</span> : undefined, onSelect: () => setTimeout(() => openGroupPanel(anchor, store.get(db.id)!, view), 0) },
      ...(view.type === 'gallery' ? [{ id: 'size', label: '卡片大小', icon: 'gallery' as IconName, right: <span className="ink-menu-value">{{ S: '小', M: '中', L: '大' }[view.gallerySize || 'M']}</span>, sub: () => ({ width: 160, groups: [(['S', 'M', 'L'] as const).map((z) => ({ id: z, label: { S: '小', M: '中', L: '大' }[z], checked: (view.gallerySize || 'M') === z, onSelect: () => updateView(db.id, view.id, { gallerySize: z }, 'card size') }))] }) }] : []),
      { id: 'open', label: '打开页面方式', icon: 'sidePeek', right: <span className="ink-menu-value">{view.openIn === 'center' ? '中心预览' : '侧边预览'}</span>, sub: () => ({ width: 200, groups: [[
        { id: 'side', label: '侧边预览', icon: 'sidePeek', checked: (view.openIn || 'side') === 'side', onSelect: () => updateView(db.id, view.id, { openIn: 'side' }, 'open in') },
        { id: 'center', label: '中心预览', icon: 'centerPeek', checked: view.openIn === 'center', onSelect: () => updateView(db.id, view.id, { openIn: 'center' }, 'open in') }]] }) },
    ],
  ];
  openMenu(R(anchor), { width: 290, groups }, { placement: 'bottom-end', anchorEl: anchor });
}

/* ---------- new + cards ---------- */
export function openNewMenu(anchor: HTMLElement, db: Block, view: View) {
  const mode = view.openIn || 'side';
  const tpls = templatesOf(db);
  openMenu(R(anchor), { width: 260, groups: [
    [{ kind: 'label', label: `“${pageTitle(db)}”的模板` },
      ...tpls.map((t) => ({ id: 'tpl-' + t.id, label: pageTitle(t) || '新模板', icon: <PageIcon block={t} size={16} />, onSelect: () => openPeek(addRowFromTemplate(db.id, t.id, { values: defaultsFor(view) }), mode),
        right: <span className="ink-menu-more" role="button" aria-label="模板选项" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); openMenu(R(e.currentTarget as HTMLElement), { width: 200, groups: [[{ id: 'edit', label: '编辑', icon: 'pencil' as IconName, onSelect: () => { closePopover('db-new-menu'); openPeek(t.id, mode); } }, { id: 'del', label: '删除', icon: 'trash' as IconName, danger: true, onSelect: () => { closePopover('db-new-menu'); deleteTemplate(db.id, t.id); } }]] }, { placement: 'bottom-start', parent: 'db-new-menu' }); }}><Icon name="more" size={14} /></span> })),
      { id: 'blank', label: '空白页', icon: 'page', onSelect: () => openPeek(addRow(db.id, { values: defaultsFor(view) }), mode) }],
    [{ id: 'tpl', label: '新模板', icon: 'plus', onSelect: () => openPeek(addTemplate(db.id), mode) }],
  ] }, { placement: 'bottom-end', anchorEl: anchor, id: 'db-new-menu' });
}
export function openCardMenu(anchor: HTMLElement, db: Block, row: Block) {
  openMenu(R(anchor), { width: 240, groups: [
    [{ id: 'side', label: '在侧边预览中打开', icon: 'sidePeek', onSelect: () => openPeek(row.id, 'side') }, { id: 'center', label: '在中心预览中打开', icon: 'centerPeek', onSelect: () => openPeek(row.id, 'center') }],
    [{ id: 'dup', label: '创建副本', icon: 'copy', onSelect: () => duplicateBlock(row.id) }, { id: 'link', label: '拷贝链接', icon: 'link', onSelect: () => { navigator.clipboard?.writeText(`inkwell://p/${row.id}`).catch(() => {}); toast('已拷贝链接到剪贴板'); } }, { id: 'del', label: '删除', icon: 'trash', danger: true, onSelect: () => deleteRow(row.id) }],
  ] }, { placement: 'bottom-end', anchorEl: anchor });
  void db;
}
export { PROP_DEFAULT_NAME };
