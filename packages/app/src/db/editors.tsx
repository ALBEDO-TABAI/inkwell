/** Cell editors: text-like inputs, select / multi-select / status option pickers, date picker, person picker. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../store/model';
import { store } from '../store/store';
import { openPopover, closePopover, type Anchor } from '../ui/overlay';
import { openMenu, Switch } from '../ui/menu';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { pageTitle } from '../app/pages';
import { schemaOf, rowsOf, rawValue, setValue, updateDb, isoOf, parseIso, OPTION_COLORS, type Prop, type SelectOption, type FileRef, isImageFile } from './model';
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
    case 'created_time': case 'formula': case 'rollup': onClose(); return;
    case 'file':
      openPopover({ id: EDITOR_ID, anchor: over, placement: 'bottom-start', onClose, className: 'ink-cell-pop', render: (close) => <FileEditor dbId={db.id} rowId={rowId} propId={propId} close={close} /> });
      return;
    case 'relation':
      openPopover({ id: EDITOR_ID, anchor: over, placement: 'bottom-start', onClose, className: 'ink-cell-pop', render: (close) => <RelationEditor dbId={db.id} rowId={rowId} propId={propId} close={close} /> });
      return;
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
  const [active, setActive] = useState(-1);
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
    else if (e.key === 'Enter') { e.preventDefault(); const a = active < 0 && q ? 0 : active; if (a >= 0 && a < opts.length) pick(opts[a].v); else if (canCreate && (a === opts.length || !opts.length)) create(); }
    else if (e.key === 'Backspace' && !q && selected.length) remove(selected[selected.length - 1]);
  };
  const renderOpt = (o: SelectOption, i: number) => (
    <div key={o.v} className={'ink-menu-item ink-opt-row' + (i === active ? ' is-active' : '')} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(o.v); }}>
      {!isStatus && <span className="ink-opt-grip"><Icon name="grip" size={14} /></span>}
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
    <div className={'ink-menu ink-opt-editor' + (isStatus ? ' is-status' : '')}>
      <div className="ink-opt-input">
        {selected.map((v) => isStatus ? <StatusPill key={v} label={v} color={p.options?.find((o) => o.v === v)?.c || 'default'} /> : <Tag key={v} label={v} color={p.options?.find((o) => o.v === v)?.c || 'default'} onRemove={() => remove(v)} />)}
        <input data-autofocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder={selected.length ? '' : isStatus ? '搜索选项…' : '搜索选项…'} />
      </div>
      <div className="ink-opt-list">
        {!isStatus && <div className="ink-menu-label">{multi ? '选择一个或多个选项' : '选择或创建一个选项'}</div>}
        {groups.map(([label, list], gi) => list.length || !isStatus ? (
          <div key={label}>
            {isStatus && gi > 0 && <div className="ink-menu-sep" style={{ margin: '4px 8px' }} />}
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

/* ---------- files & media ---------- */
const MAX_FILE = 20 * 1024 * 1024;
export function readFiles(files: FileList | File[]): Promise<FileRef[]> {
  return Promise.all([...files].filter((f) => f.size <= MAX_FILE).map((f) => new Promise<FileRef>((res) => { const r = new FileReader(); r.onload = () => res({ name: f.name, url: String(r.result), mime: f.type, size: f.size }); r.readAsDataURL(f); })));
}
function FileEditor({ dbId, rowId, propId, close }: { dbId: string; rowId: string; propId: string; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const db = store.get(dbId)!; const row = store.get(rowId)!;
  const files = ((rawValue(row, propId, db) as unknown as FileRef[]) || []);
  const [tab, setTab] = useState<'upload' | 'link'>('upload');
  const [link, setLink] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const set = (next: FileRef[]) => setValue(rowId, propId, next as never);
  const addLink = () => { const u = link.trim(); if (!u) return; const url = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u; set([...files, { name: url.split('/').filter(Boolean).pop() || url, url }]); setLink(''); };
  void close;
  return (
    <div className="ink-menu ink-file-editor" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files).then((f) => set([...files, ...f])); }}>
      {files.length > 0 && <div className="ink-file-rows">{files.map((f, i) => (
        <div key={i} className="ink-menu-item ink-file-row">
          {isImageFile(f) ? <img className="ink-file-thumb" src={f.url} alt="" /> : <Icon name="paperclip" size={16} />}
          <span className="ink-file-name" title={f.name}>{f.name}</span>
          <a className="ink-file-act" href={f.url} download={f.name} title="下载" onMouseDown={(e) => e.stopPropagation()}><Icon name="download" size={14} /></a>
          <span className="ink-file-act" role="button" title="删除" onMouseDown={(e) => { e.preventDefault(); set(files.filter((_, j) => j !== i)); }}><Icon name="trash" size={14} /></span>
        </div>))}
      </div>}
      <div className="ink-media-tabs">{(['upload', 'link'] as const).map((x) => <div key={x} role="tab" className={'ink-media-tab' + (tab === x ? ' is-active' : '')} onClick={() => setTab(x)}>{x === 'upload' ? '上传' : '嵌入链接'}</div>)}</div>
      <div className="ink-media-body">
        {tab === 'upload'
          ? <><button className="ink-btn ink-media-wide" onClick={() => input.current?.click()}>选择文件</button><input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) readFiles(e.target.files).then((f) => set([...files, ...f])); e.target.value = ''; }} /><div className="ink-media-hint">每个文件的最大大小为 20MB，也可以拖放到这里。</div></>
          : <><input data-autofocus className="ink-input ink-media-input" placeholder="粘贴文件链接…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} /><button className="ink-btn ink-btn-primary ink-media-wide" disabled={!link.trim()} onClick={addLink}>嵌入链接</button></>}
      </div>
    </div>
  );
}

/* ---------- relation ---------- */
function RelationEditor({ dbId, rowId, propId, close }: { dbId: string; rowId: string; propId: string; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const db = store.get(dbId)!; const row = store.get(rowId)!; const p = schemaOf(db)[propId];
  const target = store.get(p.relation?.db || dbId)!;
  const sel = (rawValue(row, propId, db) as string[]) || [];
  const [q, setQ] = useState('');
  const all = rowsOf(target).filter((b) => b.id !== rowId && (!q || pageTitle(b).toLowerCase().includes(q.toLowerCase())));
  const toggle = (id: string) => setValue(rowId, propId, sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  void close;
  return (
    <div className="ink-menu ink-opt-editor ink-rel-editor">
      <div className="ink-rel-head"><span className="ink-muted">关联到</span><PageIcon block={target} size={16} /><span className="ink-rel-db">{pageTitle(target)}</span></div>
      <div className="ink-opt-input"><input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索页面…" /></div>
      <div className="ink-opt-list">
        {sel.length > 0 && <div className="ink-menu-label">已关联页面</div>}
        {sel.map((id) => <div key={'s' + id} className="ink-menu-item" onMouseDown={(e) => { e.preventDefault(); toggle(id); }}><PageIcon block={store.get(id)} size={18} /><span style={{ flex: 1 }}>{pageTitle(store.get(id))}</span><Icon name="minus" size={16} /></div>)}
        <div className="ink-menu-label">{sel.length ? '关联另一个页面' : '选择要关联的页面'}</div>
        {all.filter((b) => !sel.includes(b.id)).map((b) => <div key={b.id} className="ink-menu-item" onMouseDown={(e) => { e.preventDefault(); toggle(b.id); }}><PageIcon block={b} size={18} /><span style={{ flex: 1 }}>{pageTitle(b)}</span><Icon name="plus" size={16} /></div>)}
      </div>
    </div>
  );
}

/* ---------- date ---------- */
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const slash = (iso?: string) => (iso ? iso.replace(/-/g, '/') : '');
const unslash = (s: string) => { const m = s.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null; };

export const REMIND_OPTS: [number | null, string][] = [[null, '无'], [0, '事件发生时'], [5, '提前 5 分钟'], [10, '提前 10 分钟'], [15, '提前 15 分钟'], [30, '提前 30 分钟'], [60, '提前 1 小时'], [120, '提前 2 小时'], [1440, '提前 1 天'], [2880, '提前 2 天']];
export const remindLabel = (r?: number | null) => REMIND_OPTS.find(([v]) => v === (r ?? null))?.[1] || '无';
export function DatePicker({ value, onChange, onClear, showEnd = true, todayIso = isoOf(new Date()), time, onTime, remind, onRemind }: { value: string[]; onChange: (v: string[]) => void; onClear?: () => void; showEnd?: boolean; todayIso?: string; time?: string; onTime?: (t: string | undefined) => void; remind?: number | null; onRemind?: (r: number | null) => void }) {
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
        {time !== undefined && onTime && <input className="ink-dp-input ink-dp-time" type="time" aria-label="时间" value={time} onChange={(e) => onTime(e.target.value || '09:00')} />}
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
      <div className="ink-menu-item" data-dp="time" onClick={() => onTime?.(time === undefined ? '09:00' : undefined)}><span style={{ flex: 1 }}>包含时间</span><Switch on={time !== undefined} /></div>
      <div className="ink-menu-item" data-dp="remind" onClick={(e) => { if (!onRemind) return; openMenu(e.currentTarget.getBoundingClientRect(), { width: 180, groups: [REMIND_OPTS.map(([v, l]) => ({ id: 'rm-' + (v ?? 'none'), label: l, checked: (remind ?? null) === v, onSelect: () => onRemind(v) }))] }, { placement: 'right-start', parent: 'mention-date' }); }}><span style={{ flex: 1 }}>提醒</span><span className="ink-menu-right">{remindLabel(remind)} <Icon name="chevronRight" size={14} /></span></div>
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
