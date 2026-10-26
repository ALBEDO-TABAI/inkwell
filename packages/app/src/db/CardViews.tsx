import { useLayoutEffect, useRef, useState } from 'react';
import type { Block } from '../store/model';
import { Icon, PageGlyph } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { schemaOf, queryRows, groupRows, addRow, setValue, rawValue, updateView, type Group } from './model';
import { CellValue, StatusPill, Tag } from './cells';
import { openCardMenu } from './menus';
import { defaultsFor, NewRowButton, type DbCtx } from './Database';

const cardProps = (ctx: DbCtx) => (ctx.view.cardProps || []).filter((id) => schemaOf(ctx.db)[id]);
function rowIcon(r: Block, size = 18) { return r.format?.page_icon ? <PageIcon block={r} size={size} emojiSize={size - 2} /> : <PageGlyph size={size} empty={!(r.content || []).length} />; }

/* ---------- board ---------- */
export function BoardView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx; const schema = schemaOf(db);
  const groupBy = view.group && schema[view.group] ? view.group : Object.keys(schema).find((k) => ['status', 'select'].includes(schema[k].type));
  const rows = queryRows(db, view, ctx.search);
  const groups = (groupBy ? groupRows(db, { ...view, group: groupBy }, rows) : null) || [{ key: '', label: '全部', color: 'default', rows }];
  const gp = groupBy ? schema[groupBy] : undefined;
  const [drag, setDrag] = useState<{ id: string; over?: string; before?: string } | null>(null);
  const drop = (g: Group, beforeId?: string) => {
    if (!drag || !groupBy) return;
    const id = drag.id; setDrag(null);
    const val = g.key ? (gp?.type === 'multi_select' ? [g.key] : g.key) : null;
    setValue(id, groupBy, val);
    // manual order: insert before target
    const order = queryRows(db, { ...view, filter: [] }).map((r) => r.id).filter((x) => x !== id);
    const at = beforeId ? order.indexOf(beforeId) : (() => { const last = g.rows.filter((r) => r.id !== id).slice(-1)[0]; return last ? order.indexOf(last.id) + 1 : order.length; })();
    order.splice(at < 0 ? order.length : at, 0, id);
    updateView(db.id, view.id, { manual: order }, 'move card');
  };
  return (
    <div className="ink-bv-scroll">
      <div className="ink-bv">
        {groups.map((g) => {
          const c = g.color === 'default' ? 'gray' : g.color;
          return (
            <div key={g.key} className={'ink-bv-col' + (drag?.over === g.key ? ' is-over' : '')} style={{ background: `var(--ink-${c}-background-primary-translucent)` }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); if (drag.over !== g.key) setDrag({ ...drag, over: g.key }); } }}
              onDrop={(e) => { e.preventDefault(); drop(g); }}>
              <div className="ink-bv-head">
                {gp?.type === 'status' ? <span className="ink-bv-pill" style={{ background: `var(--ink-${c}-background-tertiary-translucent)`, color: `var(--ink-${c}-text-primary)` }}><span className="ink-status-dot" style={{ background: `var(--ink-status-dot-${c})` }} />{g.label}</span>
                  : g.key ? <Tag label={g.label} color={g.color} /> : <span className="ink-bv-none">{g.label}</span>}
                <span className="ink-bv-count" style={{ color: `var(--ink-${c}-text-secondary)` }}>{g.rows.length}</span>
              </div>
              <div className="ink-bv-cards">
                {g.rows.map((r) => (
                  <div key={r.id} className={'ink-card ink-bv-card' + (drag?.id === r.id ? ' is-dragging' : '')} role="presentation" draggable={!ctx.locked} data-row-id={r.id}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id); setDrag({ id: r.id }); }}
                    onDragEnd={() => setDrag(null)}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(g, r.id); }}
                    onClick={() => ctx.openRow(r.id)}>
                    <div className="ink-card-title">{r.format?.page_icon && rowIcon(r, 16)}<CellValue row={r} propId="title" db={db} /></div>
                    {cardProps(ctx).map((id) => <div key={id} className="ink-card-prop"><CellValue row={r} propId={id} db={db} /></div>)}
                    {!ctx.locked && <span className="ink-card-more" role="button" onClick={(e) => { e.stopPropagation(); openCardMenu(e.currentTarget, db, r); }}><Icon name="more" size={16} /></span>}
                  </div>
                ))}
                {!ctx.locked && <div className="ink-bv-new" role="button" style={{ color: `var(--ink-${c}-text-secondary)` }}
                  onClick={() => { const id = addRow(db.id, { values: defaultsFor(view, groupBy && g.key ? { [groupBy]: gp?.type === 'multi_select' ? [g.key] : g.key } : {}) }); ctx.openRow(id); }}>
                  <Icon name="plus" size={16} /><span>新页面</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- list ---------- */
export function ListView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx;
  const rows = queryRows(db, view, ctx.search);
  return (
    <div className="ink-lv">
      {rows.map((r) => (
        <div key={r.id} className="ink-lv-row" role="button" data-row-id={r.id} onClick={() => ctx.openRow(r.id)}>
          <span className="ink-lv-icon">{rowIcon(r, 18)}</span>
          <span className="ink-lv-title"><CellValue row={r} propId="title" db={db} /></span>
          <span className="ink-lv-props">{cardProps(ctx).map((id) => <span key={id} className="ink-lv-prop"><CellValue row={r} propId={id} db={db} /></span>)}</span>
        </div>
      ))}
      {!ctx.locked && <NewRowButton className="ink-lv-new" onClick={() => { const id = addRow(db.id, { values: defaultsFor(view) }); ctx.openRow(id); }} />}
    </div>
  );
}

/* ---------- gallery ---------- */
const GALLERY_MIN: Record<string, number> = { S: 180, M: 260, L: 320 };
export function GalleryView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx;
  const rows = queryRows(db, view, ctx.search);
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);
  const size = view.gallerySize || 'M';
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setCols(Math.max(1, Math.floor((el.clientWidth + 16) / (GALLERY_MIN[size] + 16))));
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [size]);
  const schema = schemaOf(db);
  return (
    <div className={'ink-gv is-' + size} ref={ref} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {rows.map((r) => (
        <div key={r.id} className="ink-card ink-gv-card" role="presentation" data-row-id={r.id} onClick={() => ctx.openRow(r.id)}>
          <div className="ink-gv-body">
            <div className="ink-card-title">{r.format?.page_icon && rowIcon(r, 16)}<CellValue row={r} propId="title" db={db} /></div>
            {cardProps(ctx).map((id) => {
              const t = schema[id].type;
              const v = rawValue(r, id, db);
              if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
              return <div key={id} className={'ink-gv-prop is-' + t}>{t === 'status' ? <StatusPill label={String(v)} color={schema[id].options?.find((o) => o.v === v)?.c || 'default'} /> : <CellValue row={r} propId={id} db={db} />}</div>;
            })}
          </div>
          {!ctx.locked && <span className="ink-card-more" role="button" onClick={(e) => { e.stopPropagation(); openCardMenu(e.currentTarget, db, r); }}><Icon name="more" size={16} /></span>}
        </div>
      ))}
      {!ctx.locked && <div className="ink-gv-new" role="button" onClick={() => { const id = addRow(db.id, { values: defaultsFor(view) }); ctx.openRow(id); }}><Icon name="plus" size={16} /><span>新页面</span></div>}
    </div>
  );
}
