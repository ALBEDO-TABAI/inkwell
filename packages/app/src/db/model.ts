/**
 * Database model. A database is a block (`collection_view_page` full page, `collection_view` inline) whose
 * props hold the schema and the views; its child `page` blocks are the rows, with values in `props[propId]`.
 */
import { store, newId } from '../store/store';
import type { Block } from '../store/model';
import { plain } from '../store/model';
import { pageTitle } from '../app/pages';

export type PropType = 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'status' | 'date' | 'person' | 'checkbox' | 'url' | 'email' | 'phone_number' | 'formula' | 'created_time';
export interface SelectOption { v: string; c: string; group?: 'todo' | 'doing' | 'done' }
export interface Prop { name: string; type: PropType; options?: SelectOption[]; formula?: string; wrap?: boolean }
export type Schema = Record<string, Prop>;
export type ViewType = 'table' | 'board' | 'list' | 'gallery' | 'calendar' | 'timeline';
export interface SortRule { prop: string; dir: 'asc' | 'desc' }
export type FilterOp = 'contains' | 'not_contains' | 'is' | 'is_not' | 'empty' | 'not_empty' | 'eq' | 'gt' | 'lt' | 'checked' | 'unchecked' | 'before' | 'after';
export interface FilterRule { prop: string; op: FilterOp; value?: string | string[] }
export interface View {
  id: string; name: string; type: ViewType;
  sort?: SortRule[]; filter?: FilterRule[]; group?: string;
  /** property order and visibility for this view */
  order?: string[]; hidden?: string[]; widths?: Record<string, number>;
  /** number of leading columns frozen (table) */
  frozen?: number;
  calcs?: Record<string, CalcFn>;
  gallerySize?: 'S' | 'M' | 'L';
  /** card / list properties shown (board, gallery, list) */
  cardProps?: string[];
  dateProp?: string;
  /** manual row order (board / list / gallery); rows not listed follow in table order */
  manual?: string[];
  openIn?: 'side' | 'center';
}
export type CalcFn = 'none' | 'count_all' | 'count_values' | 'count_empty' | 'count_not_empty' | 'percent_empty' | 'percent_not_empty' | 'sum' | 'average' | 'median' | 'min' | 'max' | 'range' | 'checked' | 'unchecked';

export const isDb = (b?: Block) => !!b && (b.type === 'collection_view_page' || b.type === 'collection_view');
export const schemaOf = (db: Block): Schema => (db.props?.schema as Schema) || { title: { name: 'Name', type: 'title' } };
export const viewsOf = (db: Block): View[] => (db.props?.views as View[]) || [];
export const rowsOf = (db: Block): Block[] => store.children(db.id).filter((r) => r.alive && r.type === 'page');
/** the database a row belongs to */
export const dbOfRow = (row?: Block): Block | undefined => { const p = row && row.parentTable === 'block' ? store.get(row.parent) : undefined; return isDb(p) ? p : undefined; };

export function propIds(db: Block, view?: View): string[] {
  const s = schemaOf(db);
  const all = Object.keys(s);
  const order = view?.order ? [...view.order.filter((k) => s[k]), ...all.filter((k) => !view.order!.includes(k))] : all;
  return order;
}
export function visibleProps(db: Block, view: View): string[] {
  return propIds(db, view).filter((k) => !view.hidden?.includes(k));
}

/* ---------- values ---------- */
export type Value = string | number | boolean | string[] | null | undefined;
export function rawValue(row: Block, propId: string, db?: Block): Value {
  const d = db || dbOfRow(row); const p = d ? schemaOf(d)[propId] : undefined;
  if (!p) return row.props?.[propId] as Value;
  if (p.type === 'title') return plain(row.title);
  if (p.type === 'created_time') return row.created;
  if (p.type === 'formula') return evalFormula(p.formula || '', row, d!);
  return row.props?.[propId] as Value;
}
export const isEmpty = (v: Value) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || v === false;

const pad = (n: number) => String(n).padStart(2, '0');
export function fmtDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  return withYear ? `${y}年${m}月${d}日` : `${m}月${d}日`;
}
export function fmtDateTime(ts: number): string { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtDateRange(v: Value): string {
  if (!Array.isArray(v) || !v.length) return '';
  return v[1] ? `${fmtDate(v[0])} → ${fmtDate(v[1])}` : fmtDate(v[0]);
}
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function displayUrl(u: string) { return u.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

/** plain text of a value (search, filters, copy) */
export function valueText(row: Block, propId: string, db: Block): string {
  const p = schemaOf(db)[propId]; const v = rawValue(row, propId, db);
  if (!p || v == null) return '';
  switch (p.type) {
    case 'date': return fmtDateRange(v);
    case 'created_time': return fmtDateTime(v as number);
    case 'person': return (v as string[]).map((id) => store.users.get(id)?.name || '').join(', ');
    case 'multi_select': return (v as string[]).join(', ');
    case 'checkbox': return v ? '✓' : '';
    default: return String(v);
  }
}

/* ---------- formula (small expression language: prop(), numbers, strings, + - * / %, comparisons, if/concat/round/abs/length) ---------- */
type Tok = { t: 'num' | 'str' | 'id' | 'op'; v: string };
function lex(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d|\./.test(c)) { let j = i; while (j < src.length && /[\d.]/.test(src[j])) j++; out.push({ t: 'num', v: src.slice(i, j) }); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) j++; out.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; out.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    out.push({ t: 'op', v: c }); i++;
  }
  return out;
}
export function evalFormula(src: string, row: Block, db: Block): Value {
  try {
    const toks = lex(src); let k = 0;
    const peek = () => toks[k]; const eat = (v?: string) => { const x = toks[k++]; if (v && x?.v !== v) throw new Error('expected ' + v); return x; };
    const s = schemaOf(db);
    const byName = (n: string) => Object.keys(s).find((id) => s[id].name === n);
    type V = number | string | boolean | null;
    const prim = (): V => {
      const x = eat();
      if (!x) throw new Error('eof');
      if (x.t === 'num') return Number(x.v);
      if (x.t === 'str') return x.v;
      if (x.v === '(') { const v = expr(); eat(')'); return v; }
      if (x.v === '-') return -Number(prim());
      if (x.v === '!') return !prim();
      if (x.t === 'id') {
        if (x.v === 'true') return true; if (x.v === 'false') return false;
        eat('(');
        const args: V[] = [];
        if (peek()?.v !== ')') { args.push(expr()); while (peek()?.v === ',') { eat(','); args.push(expr()); } }
        eat(')');
        switch (x.v) {
          case 'prop': { const id = byName(String(args[0])); if (!id || s[id].type === 'formula') return null; const v = rawValue(row, id, db); return Array.isArray(v) ? v.join(', ') : (v as V) ?? null; }
          case 'if': return args[0] ? args[1] : args[2];
          case 'concat': return args.map((a) => a ?? '').join('');
          case 'round': return Math.round(Number(args[0]) * 10 ** Number(args[1] || 0)) / 10 ** Number(args[1] || 0);
          case 'abs': return Math.abs(Number(args[0]));
          case 'length': return String(args[0] ?? '').length;
          case 'empty': return args[0] == null || args[0] === '';
          case 'toNumber': return Number(args[0]);
          case 'format': return String(args[0] ?? '');
          default: throw new Error('unknown fn ' + x.v);
        }
      }
      throw new Error('bad token ' + x.v);
    };
    const bin = (next: () => V, ops: string[], f: (op: string, a: V, b: V) => V) => () => { let a = next(); while (peek() && ops.includes(peek()!.v)) { const op = eat().v; a = f(op, a, next()); } return a; };
    const mul = bin(prim, ['*', '/', '%'], (op, a, b) => op === '*' ? Number(a) * Number(b) : op === '/' ? Number(a) / Number(b) : Number(a) % Number(b));
    const add = bin(mul, ['+', '-'], (op, a, b) => op === '+' ? (typeof a === 'string' || typeof b === 'string' ? `${a ?? ''}${b ?? ''}` : Number(a) + Number(b)) : Number(a) - Number(b));
    const cmp = bin(add, ['>', '<', '>=', '<=', '==', '!='], (op, a, b) => op === '>' ? Number(a) > Number(b) : op === '<' ? Number(a) < Number(b) : op === '>=' ? Number(a) >= Number(b) : op === '<=' ? Number(a) <= Number(b) : op === '==' ? a === b : a !== b);
    const logic = bin(cmp, ['&&', '||'], (op, a, b) => op === '&&' ? !!a && !!b : !!a || !!b);
    function expr(): V { return logic(); }
    const v = expr();
    if (k < toks.length) throw new Error('trailing');
    return typeof v === 'number' && !isFinite(v) ? null : v;
  } catch { return null; }
}

/* ---------- query: filter, sort, group ---------- */
function cmpValues(a: Value, b: Value): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1;
  if (b == null || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  const sa = Array.isArray(a) ? a.join(',') : String(a), sb = Array.isArray(b) ? b.join(',') : String(b);
  return sa.localeCompare(sb, 'zh-CN', { numeric: true });
}
function optionRank(p: Prop, v: Value): number { const i = (p.options || []).findIndex((o) => o.v === (Array.isArray(v) ? v[0] : v)); return i < 0 ? 999 : i; }

export function matchesFilter(row: Block, f: FilterRule, db: Block): boolean {
  const p = schemaOf(db)[f.prop]; if (!p) return true;
  const v = rawValue(row, f.prop, db);
  const text = valueText(row, f.prop, db).toLowerCase();
  const val = Array.isArray(f.value) ? f.value : f.value != null && f.value !== '' ? [String(f.value)] : [];
  switch (f.op) {
    case 'empty': return isEmpty(v);
    case 'not_empty': return !isEmpty(v);
    case 'checked': return !!v;
    case 'unchecked': return !v;
    case 'contains': return !val.length || val.every((x) => text.includes(x.toLowerCase()));
    case 'not_contains': return !val.length || val.every((x) => !text.includes(x.toLowerCase()));
    case 'is': if (!val.length) return true; return Array.isArray(v) ? val.some((x) => (v as string[]).includes(x)) : val.includes(String(v ?? ''));
    case 'is_not': if (!val.length) return true; return Array.isArray(v) ? !val.some((x) => (v as string[]).includes(x)) : !val.includes(String(v ?? ''));
    case 'eq': return !val.length || Number(v) === Number(val[0]);
    case 'gt': return !val.length || Number(v) > Number(val[0]);
    case 'lt': return !val.length || Number(v) < Number(val[0]);
    case 'before': return !val.length || (Array.isArray(v) && !!v[0] && v[0] < val[0]);
    case 'after': return !val.length || (Array.isArray(v) && !!v[0] && v[0] > val[0]);
  }
  return true;
}

export function queryRows(db: Block, view: View, search = ''): Block[] {
  let rows = rowsOf(db);
  if (view.manual?.length) {
    const pos = new Map(view.manual.map((id, i) => [id, i]));
    rows = [...rows].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  }
  for (const f of view.filter || []) rows = rows.filter((r) => matchesFilter(r, f, db));
  const q = search.trim().toLowerCase();
  if (q) rows = rows.filter((r) => Object.keys(schemaOf(db)).some((k) => valueText(r, k, db).toLowerCase().includes(q)));
  const s = schemaOf(db);
  for (const rule of [...(view.sort || [])].reverse()) {
    const p = s[rule.prop]; if (!p) continue;
    const sign = rule.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const va = rawValue(a, rule.prop, db), vb = rawValue(b, rule.prop, db);
      if (p.type === 'select' || p.type === 'status' || p.type === 'multi_select') return sign * (optionRank(p, va) - optionRank(p, vb));
      if (p.type === 'date') return sign * cmpValues(Array.isArray(va) ? va[0] : va, Array.isArray(vb) ? vb[0] : vb);
      return sign * cmpValues(va, vb);
    });
  }
  return rows;
}

export interface Group { key: string; label: string; color: string; rows: Block[] }
export function groupRows(db: Block, view: View, rows: Block[]): Group[] | null {
  const gp = view.group; const p = gp ? schemaOf(db)[gp] : undefined;
  if (!gp || !p) return null;
  if (p.type === 'select' || p.type === 'status' || p.type === 'multi_select') {
    const groups: Group[] = (p.options || []).map((o) => ({ key: o.v, label: o.v, color: o.c, rows: [] }));
    const none: Group = { key: '', label: `无 ${p.name}`, color: 'default', rows: [] };
    for (const r of rows) {
      const v = rawValue(r, gp, db); const vs = Array.isArray(v) ? v : v ? [String(v)] : [];
      if (!vs.length) none.rows.push(r);
      for (const x of vs) groups.find((g) => g.key === x)?.rows.push(r);
    }
    return none.rows.length ? [none, ...groups] : groups;
  }
  if (p.type === 'checkbox') {
    return [{ key: 'true', label: '已勾选', color: 'default', rows: rows.filter((r) => !!rawValue(r, gp, db)) }, { key: 'false', label: '未勾选', color: 'default', rows: rows.filter((r) => !rawValue(r, gp, db)) }];
  }
  const map = new Map<string, Block[]>();
  for (const r of rows) { const k = valueText(r, gp, db); map.set(k, [...(map.get(k) || []), r]); }
  return [...map.entries()].map(([k, rs]) => ({ key: k, label: k || `无 ${p.name}`, color: 'default', rows: rs }));
}

/* ---------- calculations ---------- */
export function calc(db: Block, propId: string, fn: CalcFn, rows: Block[]): string {
  const vals = rows.map((r) => rawValue(r, propId, db));
  const n = vals.length; const filled = vals.filter((v) => !isEmpty(v)).length;
  const nums = vals.map((v) => Number(v)).filter((x, i) => vals[i] != null && vals[i] !== '' && !isNaN(x));
  const r2 = (x: number) => String(Math.round(x * 100) / 100);
  switch (fn) {
    case 'count_all': return String(n);
    case 'count_values': return String(vals.reduce<number>((a, v) => a + (Array.isArray(v) ? v.length : isEmpty(v) ? 0 : 1), 0));
    case 'count_empty': return String(n - filled);
    case 'count_not_empty': return String(filled);
    case 'percent_empty': return n ? r2(((n - filled) / n) * 100) + '%' : '0%';
    case 'percent_not_empty': return n ? r2((filled / n) * 100) + '%' : '0%';
    case 'checked': return String(vals.filter(Boolean).length);
    case 'unchecked': return String(vals.filter((v) => !v).length);
    case 'sum': return r2(nums.reduce((a, b) => a + b, 0));
    case 'average': return nums.length ? r2(nums.reduce((a, b) => a + b, 0) / nums.length) : '';
    case 'median': { if (!nums.length) return ''; const s = [...nums].sort((a, b) => a - b); const m = s.length >> 1; return r2(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); }
    case 'min': return nums.length ? r2(Math.min(...nums)) : '';
    case 'max': return nums.length ? r2(Math.max(...nums)) : '';
    case 'range': return nums.length ? r2(Math.max(...nums) - Math.min(...nums)) : '';
  }
  return '';
}

/* ---------- mutations ---------- */
export function updateDb(dbId: string, f: (props: { schema: Schema; views: View[] }) => Partial<{ schema: Schema; views: View[] }>, label = 'db') {
  store.transact(label, (tx) => tx.update(dbId, (b) => ({ props: { ...b.props, ...f({ schema: schemaOf(b), views: viewsOf(b) }) } })));
}
export function updateView(dbId: string, viewId: string, patch: Partial<View> | ((v: View) => Partial<View>), label = 'view') {
  updateDb(dbId, ({ views }) => ({ views: views.map((v) => (v.id === viewId ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v)) }), label);
}
export function setValue(rowId: string, propId: string, value: Value) {
  const row = store.get(rowId); if (!row) return;
  const db = dbOfRow(row); const p = db ? schemaOf(db)[propId] : undefined;
  store.transact('cell', (tx) => {
    if (p?.type === 'title') tx.update(rowId, { title: value ? [[String(value)]] : [] });
    else tx.update(rowId, (b) => ({ props: { ...b.props, [propId]: value } }));
  });
}
export function addRow(dbId: string, opts: { values?: Record<string, Value>; index?: number; title?: string } = {}): string {
  const id = newId(); const tid = newId();
  store.transact('new row', (tx) => {
    tx.create({ id, type: 'page', title: opts.title ? [[opts.title]] : [], parent: dbId, parentTable: 'block', content: [tid], props: { ...(opts.values || {}) } });
    tx.create({ id: tid, type: 'text', title: [], parent: id, parentTable: 'block', content: [] });
    tx.insertChild(dbId, id, opts.index);
  });
  return id;
}
export function deleteRow(rowId: string) {
  const row = store.get(rowId); if (!row) return;
  store.transact('delete row', (tx) => { tx.removeChild(row.parent, rowId); tx.update(rowId, { alive: false }); });
}
export function addProp(dbId: string, type: PropType, opts: { name?: string; at?: { viewId: string; after?: string; before?: string } } = {}): string {
  const id = 'p' + newId().slice(0, 6);
  updateDb(dbId, ({ schema, views }) => {
    const n = opts.name || PROP_DEFAULT_NAME[type] || '属性';
    const names = new Set(Object.values(schema).map((p) => p.name));
    let name = n; let i = 1; while (names.has(name)) name = `${n} ${i++}`;
    const prop: Prop = { name, type, ...(type === 'select' || type === 'multi_select' ? { options: [] } : type === 'status' ? { options: STATUS_DEFAULT.map((o) => ({ ...o })) } : {}) };
    return {
      schema: { ...schema, [id]: prop },
      views: views.map((v) => {
        if (!opts.at || v.id !== opts.at.viewId) return v;
        const order = propIds(store.get(dbId)!, v).filter((k) => k !== id);
        const ref = opts.at.after || opts.at.before!; const at = order.indexOf(ref) + (opts.at.after ? 1 : 0);
        order.splice(at, 0, id);
        return { ...v, order };
      }),
    };
  }, 'add property');
  return id;
}
export const PROP_DEFAULT_NAME: Partial<Record<PropType, string>> = { text: '文本', number: '数字', select: '选择', multi_select: '多选', status: '状态', date: '日期', person: '人员', checkbox: '复选框', url: '网址', email: '电子邮件', phone_number: '电话', formula: '函数', created_time: '创建时间' };
export const STATUS_DEFAULT: SelectOption[] = [{ v: '未开始', c: 'default', group: 'todo' }, { v: '进行中', c: 'blue', group: 'doing' }, { v: '完成', c: 'green', group: 'done' }];
export const OPTION_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export function newDatabase(parent: string, opts: { inline?: boolean; index?: number; view?: ViewType; title?: string } = {}): string {
  const id = newId();
  const viewType = opts.view || 'table';
  store.transact('new database', (tx) => {
    tx.create({
      id, type: opts.inline ? 'collection_view' : 'collection_view_page', title: opts.title ? [[opts.title]] : [], parent, parentTable: 'block', content: [],
      props: {
        schema: { title: { name: 'Name', type: 'title' }, ptags: { name: 'Tags', type: 'multi_select', options: [] } },
        views: [{ id: 'v' + newId().slice(0, 6), name: VIEW_NAMES[viewType], type: viewType, ...(viewType === 'board' ? { group: 'ptags' } : {}) }],
      },
    });
    tx.insertChild(parent, id, opts.index);
  });
  for (let i = 0; i < 3; i++) addRow(id);
  return id;
}
export function newDbProps(viewType: ViewType = 'table') {
  return {
    schema: { title: { name: 'Name', type: 'title' }, ptags: { name: 'Tags', type: 'multi_select', options: [] } } as Schema,
    views: [{ id: 'v' + newId().slice(0, 6), name: VIEW_NAMES[viewType], type: viewType, ...(viewType === 'board' ? { group: 'ptags' } : {}) }] as View[],
  };
}
export const VIEW_NAMES: Record<ViewType, string> = { table: 'Table', board: 'Board', list: 'List', gallery: 'Gallery', calendar: 'Calendar', timeline: 'Timeline' };
export const rowTitle = (r: Block) => pageTitle(r);
