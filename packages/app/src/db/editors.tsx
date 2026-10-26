/** Cell editors: text-like inputs, select / multi-select / status option pickers, date picker, person picker. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../store/model';
import { store } from '../store/store';
import { openPopover, closePopover, type Anchor } from '../ui/overlay';
import { openMenu, Switch } from '../ui/menu';
import { Icon } from '../ui/icons';
import { schemaOf, rawValue, setValue, updateDb, isoOf, parseIso, OPTION_COLORS, type Prop, type SelectOption } from './model';
import { Tag, StatusPill, Avatar, colorVar } from './cells';

const EDITOR_ID = 'cell-editor';
export function openCellEditor(cell: HTMLElement, rowId: string, propId: string, db: Block, opts: { minWidth?: number } = {}) {
  const p = schemaOf(db)[propId]; const row = store.get(rowId); if (!p || !row) return;
  const r = cell.getBoundingClientRect();
  const over: Anchor = { left: r.left, top: r.top, right: r.right, bottom: r.top };
  cell.classList.add('is-editing');
  const onClose = () => cell.classList.remove('is-editing');
  switch (p.type) {
    case 'checkbox': setValue(rowId, propId, !rawValue(row, propId, db)); onClose(); return;
    case 'created_time': case 'formula': onClose(); return;
    case 'select': case 'multi_select': case 'status':
      openPopover({ id: EDITOR_ID, anchor: over, placement: 'bottom-start', onClose, className: 'ink-cell-pop', render: (close) => <OptionEditor dbId={db.id} rowId={rowId} propId={propId} close={close} /> });
      return;
    case 'date':
      openPopover({ id: EDITOR_ID, anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, placement: 'bottom-start', offset: 0, onClose, render: (close) => <DateEditor dbId={db.id} rowId={rowId} propId={propId} close={close} /> });
      return;
    case 'person':
      openPopover({ id: EDITOR_ID, anchor: over, placement: 'bottom-start', onClose, className: 'ink-cell-pop', render: (close) => <PersonEditor dbId={db.id} rowId={rowId} propId={propId} close={close} /> });
      return;
    default:
      openPopover({ id: EDITOR_ID, anchor: over, placement: 'bottom-start', onClose, className: 'ink-cell-pop', render: (close) => <TextEditor dbId={db.id} rowId={rowId} propId={propId} close={close} width={Math.max(r.width, opts.minWidth || 0)} /> });
  }
}

function TextEditor({ dbId, rowId, propId, close, width }: { dbId: string; rowId: string; propId: string; close: () => void; width: number }) {
  const db = store.get(dbId)!; const p = schemaOf(db)[propId]; const row = store.get(rowId)!;
  const init = rawValue(row, propId, db);
  const [v, setV] = useState(init == null ? '' : String(init));
  const ref = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);
  const commit = () => {
    if (committed.current) return; committed.current = true;
    const val = p.type === 'number' ? (v.trim() === '' || isNaN(Number(v)) ? null : Number(v)) : v;
    if (val !== init && !(val === '' && init == null)) setValue(rowId, propId, val);
  };
  useEffect(() => { const el = ref.current!; el.focus(); el.setSelectionRange(el.value.length, el.value.length); return commit; }, []);
  useEffect(() => { const el = ref.current!; el.style.height = '0'; el.style.height = el.scrollHeight + 'px'; }, [v]);
  return (
    <div className="ink-cell-text-editor" style={{ width: Math.max(width, 240) }}>
      <textarea ref={ref} data-autofocus value={v} rows={1} className={p.type === 'number' ? 'is-num' : ''}
        onChange={(e) => setV(p.type === 'title' ? e.target.value.replace(/\n/g, '') : e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); commit(); close(); } }} />
    </div>
  );
}

/* ---------- options ---------- */
function OptionEditor({ dbId, rowId, propId, close }: { dbId: string; rowId: string; propId: string; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const db = store.get(dbId)!; const p = schemaOf(db)[propId]; const row = store.get(rowId)!;
  const multi = p.type === 'multi_select'; const isStatus = p.type === 'status';
  const raw = rawValue(row, propId, db);
  const selected: string[] = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const opts = (p.options || []).filter((o) => !q || o.v.toLowerCase().includes(q.toLowerCase()));
  const exact = (p.options || []).some((o) => o.v === q.trim());
  const canCreate = !!q.trim() && !exact;
  const total = opts.length + (canCreate ? 1 : 0);
  const pick = (v: string) => {
    if (multi) setValue(rowId, propId, selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    else { setValue(rowId, propId, v); close(); }
    setQ('');
  };
  const create = () => {
    const v = q.trim(); if (!v) return;
    const c = OPTION_COLORS[1 + ((p.options?.length || 0) * 3) % (OPTION_COLORS.length - 1)];
    updateDb(dbId, ({ schema }) => ({ schema: { ...schema, [propId]: { ...p, options: [...(p.options || []), { v, c, ...(isStatus ? { group: 'todo' as const } : {}) }] } } }), 'add option');
    pick(v);
  };
  const remove = (v: string) => setValue(rowId, propId, multi ? selected.filter((x) => x !== v) : null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(1, total)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + total) % Math.max(1, total)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active < opts.length) pick(opts[active].v); else if (canCreate) create(); }
    else if (e.key === 'Backspace' && !q && selected.length) remove(selected[selected.length - 1]);
  };
  const renderOpt = (o: SelectOption, i: number) => (
    <div key={o.v} className={'ink-menu-item ink-opt-row' + (i === active ? ' is-active' : '')} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(o.v); }}>
      <span className="ink-opt-grip"><Icon name="grip" size={14} /></span>
      {isStatus ? <StatusPill label={o.v} color={o.c} /> : <Tag label={o.v} color={o.c} />}
      <span style={{ flex: 1 }} />
      <span className="ink-opt-more" role="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openOptionMenu(e.currentTarget as HTMLElement, dbId, propId, o); }}><Icon name="more" size={16} /></span>
    </div>
  );
  const groups: [string, SelectOption[]][] = isStatus
    ? [['待办', opts.filter((o) => (o.group || 'todo') === 'todo')], ['进行中', opts.filter((o) => o.group === 'doing')], ['已完成', opts.filter((o) => o.group === 'done')]]
    : [['', opts]];
  let idx = 0;
  return (
    <div className="ink-menu ink-opt-editor">
      <div className="ink-opt-input">
        {selected.map((v) => isStatus ? <StatusPill key={v} label={v} color={p.options?.find((o) => o.v === v)?.c || 'default'} /> : <Tag key={v} label={v} color={p.options?.find((o) => o.v === v)?.c || 'default'} onRemove={() => remove(v)} />)}
        <input data-autofocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder={selected.length ? '' : isStatus ? '搜索选项…' : '搜索选项…'} />
      </div>
      <div className="ink-opt-list">
        {!isStatus && <div className="ink-menu-label">{multi ? '选择一个或多个选项' : '选择或创建一个选项'}</div>}
        {groups.map(([label, list]) => list.length || !isStatus ? (
          <div key={label}>
            {isStatus && <div className="ink-menu-label">{label}</div>}
            {list.map((o) => renderOpt(o, idx++))}
          </div>
        ) : null)}
        {canCreate && <div className={'ink-menu-item' + (active === opts.length ? ' is-active' : '')} onMouseEnter={() => setActive(opts.length)} onMouseDown={(e) => { e.preventDefault(); create(); }}>
          <span className="ink-opt-create">创建</span><Tag label={q.trim()} color={OPTION_COLORS[1 + ((p.options?.length || 0) * 3) % (OPTION_COLORS.length - 1)]} />
        </div>}
      </div>
      {isStatus && <div className="ink-opt-foot"><div className="ink-menu-item"><Icon name="sliders" size={16} /> 编辑属性</div></div>}
    </div>
  );
}

const COLOR_LABEL: Record<string, string> = { default: '默认', gray: '灰色', brown: '棕色', orange: '橙色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色', pink: '粉色', red: '红色' };
export function openOptionMenu(anchor: HTMLElement, dbId: string, propId: string, o: SelectOption) {
  const write = (f: (opts: SelectOption[]) => SelectOption[]) => updateDb(dbId, ({ schema }) => ({ schema: { ...schema, [propId]: { ...schema[propId], options: f(schema[propId].options || []) } } }), 'option');
  const renameRows = (from: string, to: string | null) => {
    const db = store.get(dbId)!;
    store.transact('rename option', (tx) => {
      for (const r of store.children(dbId)) {
        const v = r.props?.[propId];
        if (Array.isArray(v) && v.includes(from)) tx.update(r.id, { props: { ...r.props, [propId]: to == null ? v.filter((x: string) => x !== from) : v.map((x: string) => (x === from ? to : x)) } });
        else if (v === from) tx.update(r.id, { props: { ...r.props, [propId]: to } });
      }
      void db;
    });
  };
  openMenu(anchor.getBoundingClientRect(), {
    width: 220,
    groups: [
      [{ kind: 'custom', key: 'name', render: () => <OptionName value={o.v} onCommit={(v) => { if (v && v !== o.v) { write((os) => os.map((x) => (x.v === o.v ? { ...x, v } : x))); renameRows(o.v, v); } }} /> },
        { id: 'del', label: '删除', icon: 'trash', onSelect: () => { write((os) => os.filter((x) => x.v !== o.v)); renameRows(o.v, null); } }],
      [{ kind: 'label', label: '颜色' }, ...OPTION_COLORS.map((c) => ({ id: 'c-' + c, label: COLOR_LABEL[c], icon: <span className="ink-color-swatch" style={colorVar(c)} />, checked: o.c === c, onSelect: () => write((os) => os.map((x) => (x.v === o.v ? { ...x, c } : x))) }))],
    ],
  }, { placement: 'right-start', parent: EDITOR_ID });
}
function OptionName({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => () => onCommit(v.trim()), [v]);
  return <div className="ink-menu-search-wrap" style={{ padding: '6px 4px' }}><input className="ink-menu-search" data-autofocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit(v.trim()); } }} /></div>;
}

/* ---------- person ---------- */
function PersonEditor({ dbId, rowId, propId, close }: { dbId: string; rowId: string; propId: string; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const db = store.get(dbId)!; const row = store.get(rowId)!;
  const sel = (rawValue(row, propId, db) as string[]) || [];
  const [q, setQ] = useState('');
  const users = [...store.users.values()].filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || (u.email || '').includes(q));
  const toggle = (id: string) => setValue(rowId, propId, sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  void close;
  return (
    <div className="ink-menu ink-opt-editor">
      <div className="ink-opt-input">
        {sel.map((id) => <span key={id} className="ink-person-chip"><Avatar userId={id} size={18} />{store.users.get(id)?.name}<span className="ink-tag-x" role="button" onMouseDown={(e) => { e.preventDefault(); toggle(id); }}><Icon name="x" size={12} stroke={2} /></span></span>)}
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={sel.length ? '' : '搜索人员…'} />
      </div>
      <div className="ink-opt-list">
        <div className="ink-menu-label">选择尽可能多的人员</div>
        {users.map((u) => <div key={u.id} className="ink-menu-item" onMouseDown={(e) => { e.preventDefault(); toggle(u.id); }}><Avatar userId={u.id} /><span style={{ flex: 1 }}>{u.name}</span>{sel.includes(u.id) && <Icon name="check" size={16} />}</div>)}
      </div>
      <div className="ink-opt-foot"><div className="ink-menu-item ink-muted"><Icon name="userRound" size={16} /> 邀请人员</div></div>
    </div>
  );
}

/* ---------- date ---------- */
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const slash = (iso?: string) => (iso ? iso.replace(/-/g, '/') : '');
const unslash = (s: string) => { const m = s.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null; };

export function DatePicker({ value, onChange, onClear, showEnd = true, todayIso = isoOf(new Date()) }: { value: string[]; onChange: (v: string[]) => void; onClear?: () => void; showEnd?: boolean; todayIso?: string }) {
  const [start, end] = value;
  const [hasEnd, setHasEnd] = useState(!!end);
  const [month, setMonth] = useState(() => { const d = start ? parseIso(start) : parseIso(todayIso); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editing, setEditing] = useState<'start' | 'end'>('start');
  const [s1, setS1] = useState(slash(start)); const [s2, setS2] = useState(slash(end));
  useEffect(() => { setS1(slash(start)); setS2(slash(end)); }, [start, end]);
  const days = useMemo(() => {
    const first = new Date(month); first.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d; });
  }, [month]);
  const click = (iso: string) => {
    if (!hasEnd) { onChange([iso]); return; }
    if (editing === 'start') { onChange(end && iso <= end ? [iso, end] : [iso, iso]); setEditing('end'); }
    else { onChange(iso >= (start || iso) ? [start || iso, iso] : [iso, start]); setEditing('start'); }
  };
  const lastRow = days.slice(35).every((d) => d.getMonth() !== month.getMonth()) ? 35 : 42;
  return (
    <div className="ink-menu ink-datepicker">
      <div className="ink-dp-inputs">
        <input className={'ink-dp-input' + (editing === 'start' ? ' is-focus' : '')} value={s1} data-autofocus onFocus={(e) => { setEditing('start'); e.currentTarget.select(); }} onChange={(e) => setS1(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { const v = unslash(s1); if (v) { onChange(hasEnd ? [v, end && end >= v ? end : v] : [v]); setMonth(new Date(parseIso(v).getFullYear(), parseIso(v).getMonth(), 1)); } } }} />
        {hasEnd && <input className={'ink-dp-input' + (editing === 'end' ? ' is-focus' : '')} value={s2} onFocus={() => setEditing('end')} onChange={(e) => setS2(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { const v = unslash(s2); if (v) onChange([start || v, v]); } }} />}
      </div>
      <div className="ink-dp-head">
        <span className="ink-dp-month">{month.getFullYear()}年{month.getMonth() + 1}月</span>
        <button className="ink-dp-today" onClick={() => { const d = parseIso(todayIso); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>今天</button>
        <button className="ink-dp-nav" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevronLeft" size={16} /></button>
        <button className="ink-dp-nav" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevronRight" size={16} /></button>
      </div>
      <div className="ink-dp-grid">
        {WEEK.map((w) => <span key={w} className="ink-dp-wd">{w}</span>)}
        {days.slice(0, lastRow).map((d) => {
          const iso = isoOf(d); const out = d.getMonth() !== month.getMonth();
          const inRange = hasEnd && start && end && iso > start && iso < end;
          const edge = iso === start || (hasEnd && iso === end);
          const cls = ['ink-dp-day', out ? 'is-out' : '', iso === todayIso ? 'is-today' : '', inRange ? 'is-range' : '', edge ? 'is-sel' : '', hasEnd && iso === start && end && end !== start ? 'is-start' : '', hasEnd && iso === end && end !== start ? 'is-end' : ''].filter(Boolean).join(' ');
          return <button key={iso} className={cls} onClick={() => click(iso)}><span>{d.getDate()}</span></button>;
        })}
      </div>
      <div className="ink-menu-sep" />
      {showEnd && <div className="ink-menu-item" onClick={() => { const v = !hasEnd; setHasEnd(v); if (start) onChange(v ? [start, start] : [start]); setEditing(v ? 'end' : 'start'); }}><span style={{ flex: 1 }}>结束日期</span><Switch on={hasEnd} /></div>}
      <div className="ink-menu-item"><span style={{ flex: 1 }}>日期格式</span><span className="ink-menu-right">完整日期 <Icon name="chevronRight" size={14} /></span></div>
      <div className="ink-menu-item"><span style={{ flex: 1 }}>包含时间</span><Switch on={false} /></div>
      <div className="ink-menu-item"><span style={{ flex: 1 }}>提醒</span><span className="ink-menu-right">无 <Icon name="chevronRight" size={14} /></span></div>
      <div className="ink-menu-sep" />
      {onClear && <div className="ink-menu-item" onClick={onClear}>清除</div>}
      <div className="ink-menu-sep" />
      <div className="ink-menu-item ink-muted"><Icon name="help" size={16} /> 了解提醒</div>
    </div>
  );
}
function DateEditor({ dbId, rowId, propId, close }: { dbId: string; rowId: string; propId: string; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const db = store.get(dbId)!; const row = store.get(rowId)!;
  const v = (rawValue(row, propId, db) as string[]) || [];
  return <DatePicker value={v} todayIso={isoOf(new Date())} onChange={(nv) => setValue(rowId, propId, nv)} onClear={() => { setValue(rowId, propId, null); close(); }} />;
}
export const closeCellEditor = () => closePopover(EDITOR_ID);
export type { Prop };
