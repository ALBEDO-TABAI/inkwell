import type { ReactNode } from 'react';
import type { Block } from '../store/model';
import { store } from '../store/store';
import { Icon, type IconName } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { pageTitle } from '../app/pages';
import { isImageFile, type FileRef } from './model';
import { schemaOf, rawValue, fmtDateRange, fmtDateTime, displayUrl, type Prop, type PropType, type Value } from './model';

export const PROP_ICON: Record<PropType, IconName> = {
  title: 'caseUpper', text: 'alignLeft', number: 'hash', select: 'selectProp', multi_select: 'multiSelect', status: 'statusProp', date: 'dateProp',
  person: 'personProp', checkbox: 'checkboxProp', url: 'urlProp', email: 'at', phone_number: 'phone', formula: 'sigma', created_time: 'clock', relation: 'arrowUpRight', rollup: 'search', file: 'paperclip',
};
export function PropIcon({ type, size = 16 }: { type: PropType; size?: number }) {
  if (type === 'title') return <span className="ink-prop-aa" style={{ width: size, height: size, fontSize: size * 0.72 }}>Aa</span>;
  if (type === 'created_time') return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6.5" fill="currentColor" /><path d="M8 4.6V8.3l2.3 1.4" stroke="var(--ink-background-primary, #fff)" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg>;
  return <Icon name={PROP_ICON[type]} size={size} />;
}

export const colorVar = (c: string) => (c === 'default' || !c ? { background: 'var(--ink-gray-background-secondary)', color: 'var(--ink-text-primary)' } : { background: `var(--ink-${c}-background-tertiary)`, color: `var(--ink-${c}-text-primary)` });
export function Tag({ label, color, onRemove }: { label: string; color: string; onRemove?: () => void }) {
  return <span className="ink-tag" style={colorVar(color)}>{label}{onRemove && <span className="ink-tag-x" role="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}><Icon name="x" size={12} stroke={2} /></span>}</span>;
}
export function StatusPill({ label, color }: { label: string; color: string }) {
  const c = color === 'default' ? 'gray' : color;
  return <span className="ink-status" style={{ background: `var(--ink-${c}-background-tertiary)`, color: `var(--ink-${c}-text-primary)` }}><span className="ink-status-dot" style={{ background: `var(--ink-status-dot-${c})` }} />{label}</span>;
}
const optColor = (p: Prop, v: string) => p.options?.find((o) => o.v === v)?.c || 'default';

export function Avatar({ userId, size = 20 }: { userId: string; size?: number }) {
  const u = store.users.get(userId);
  const name = u?.name || '?';
  return <span className="ink-avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} title={name}>{[...name.replace(/\s/g, '')].slice(-2).join('')}</span>;
}
export function PersonChip({ userId }: { userId: string }) {
  return <span className="ink-person"><Avatar userId={userId} /><span>{store.users.get(userId)?.name || '未知用户'}</span></span>;
}

/** read-only rendering of a property value (table cells, cards, peek property values) */
export function CellValue({ row, propId, db, wrap, onCheck }: { row: Block; propId: string; db: Block; wrap?: boolean; onCheck?: (v: boolean) => void }): ReactNode {
  const p = schemaOf(db)[propId]; if (!p) return null;
  const v: Value = rawValue(row, propId, db);
  switch (p.type) {
    case 'title': return <span className="ink-cell-title">{(v as string) || <span className="ink-cell-untitled">新页面</span>}</span>;
    case 'text': return v ? <span className={'ink-cell-text' + (wrap ? ' is-wrap' : '')}>{String(v)}</span> : null;
    case 'number': return v != null && v !== '' ? <span className="ink-cell-num">{String(v)}</span> : null;
    case 'select': return v ? <Tag label={String(v)} color={optColor(p, String(v))} /> : null;
    case 'status': return v ? <StatusPill label={String(v)} color={optColor(p, String(v))} /> : null;
    case 'multi_select': return Array.isArray(v) && v.length ? <span className="ink-tags">{v.map((x) => <Tag key={x} label={x} color={optColor(p, x)} />)}</span> : null;
    case 'date': return Array.isArray(v) && v.length ? <span className="ink-cell-text">{fmtDateRange(v)}</span> : null;
    case 'created_time': return <span className="ink-cell-text">{fmtDateTime(v as number)}</span>;
    case 'person': return Array.isArray(v) && v.length ? <span className="ink-people">{v.map((id) => <PersonChip key={id} userId={id} />)}</span> : null;
    case 'checkbox': return <span className={'ink-checkbox' + (v ? ' is-on' : '')} role="checkbox" aria-checked={!!v} onMouseDown={onCheck ? (e) => { e.preventDefault(); e.stopPropagation(); onCheck(!v); } : undefined}>{v ? <Icon name="check" size={12} stroke={2.5} /> : null}</span>;
    case 'url': return v ? <a className="ink-cell-link" href={String(v)} target="_blank" rel="noreferrer" onClick={(e) => e.preventDefault()}>{displayUrl(String(v))}</a> : null;
    case 'email': case 'phone_number': return v ? <span className="ink-cell-link">{String(v)}</span> : null;
    case 'file': return Array.isArray(v) && v.length ? <span className={'ink-file-list' + (wrap ? ' is-wrap' : '')}>{(v as unknown as FileRef[]).map((f, i) => isImageFile(f) ? <img key={i} className="ink-file-thumb" src={f.url} alt={f.name} title={f.name} /> : <span key={i} className="ink-file-chip" title={f.name}><Icon name="paperclip" size={12} />{f.name}</span>)}</span> : null;
    case 'relation': return Array.isArray(v) && v.length ? <span className={'ink-rel-list' + (wrap ? ' is-wrap' : '')}>{v.map((id) => { const b = store.get(id); return <span key={id} className="ink-rel-chip"><PageIcon block={b} size={16} /><span className="ink-rel-title">{pageTitle(b)}</span></span>; })}</span> : null;
    case 'rollup': return v != null && v !== '' ? <span className={typeof v === 'number' ? 'ink-cell-num' : 'ink-cell-text'}>{String(v)}</span> : null;
    case 'formula': return v != null && v !== '' ? <span className={typeof v === 'number' ? 'ink-cell-num' : 'ink-cell-text'}>{typeof v === 'boolean' ? (v ? '✓' : '') : String(v)}</span> : null;
  }
  return null;
}
