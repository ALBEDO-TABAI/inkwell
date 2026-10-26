import { useRef, useState } from 'react';
import type { Block } from '../store/model';
import { Icon, PageGlyph } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { useUi } from '../app/state';
import { schemaOf, visibleProps, queryRows, groupRows, calc, addRow, updateView, setValue, type View } from './model';
import { CellValue, PropIcon, StatusPill, Tag } from './cells';
import { openCellEditor } from './editors';
import { openHeaderMenu, openAddPropMenu, openCalcMenu, CALC_LABEL } from './menus';
import { NewRowButton, defaultsFor, type DbCtx } from './Database';

export const DEFAULT_COL = 200;
export const colWidth = (view: View, id: string) => view.widths?.[id] ?? DEFAULT_COL;

export function TableView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx;
  const schema = schemaOf(db);
  const props = visibleProps(db, view);
  const rows = queryRows(db, view, ctx.search);
  const groups = groupRows(db, view, rows);
  const [live, setLive] = useState<Record<string, number>>({});
  const w = (id: string) => live[id] ?? colWidth(view, id);
  const frozen = view.frozen || 0;
  const left = (i: number) => props.slice(0, i).reduce((a, id) => a + w(id), 0);
  const total = props.reduce((a, id) => a + w(id), 0);
  const peek = useUi((s) => s.rowPeek?.id);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const startResize = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = w(id);
    document.body.classList.add('is-col-resizing');
    const mv = (ev: PointerEvent) => setLive({ [id]: Math.max(100, Math.round(w0 + ev.clientX - x0)) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-col-resizing');
      const nw = Math.max(100, Math.round(w0 + ev.clientX - x0));
      setLive({});
      if (nw !== w0) updateView(db.id, view.id, (v) => ({ widths: { ...v.widths, [id]: nw } }), 'resize column');
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const stick = (i: number) => (i < frozen ? { position: 'sticky' as const, left: left(i) + 0, zIndex: 3 } : undefined);

  const header = (
    <div className="ink-tv-head" role="row">
      <div className="ink-tv-head-cells">
        {props.map((id, i) => {
          const p = schema[id];
          return (
            <div key={id} className={'ink-tv-hcell' + (i === frozen - 1 ? ' is-frozen-edge' : '') + (i < frozen ? ' is-frozen' : '')} style={{ width: w(id), ...stick(i) }} role="columnheader" data-prop={id}
              onClick={(e) => !ctx.locked && openHeaderMenu(e.currentTarget, db, view, id)}>
              <PropIcon type={p.type} />
              <span className="ink-tv-hname">{p.name}</span>
              {!ctx.locked && <span className="ink-tv-resize" onPointerDown={(e) => startResize(e, id)} onClick={(e) => e.stopPropagation()} />}
            </div>
          );
        })}
        {!ctx.locked && <div className="ink-tv-hadd" role="button" aria-label="添加属性" onClick={(e) => openAddPropMenu(e.currentTarget, db, view)}><Icon name="plus" size={16} /></div>}
        <div className="ink-tv-hfill" />
      </div>
    </div>
  );

  const renderRow = (r: Block) => (
    <div key={r.id} className={'ink-tv-row' + (peek === r.id ? ' is-peeked' : '')} role="row" data-row-id={r.id}>
      <div className="ink-tv-gutter">
        <span className="ink-tv-gbtn" role="button" aria-label="在下方插入" onClick={() => { const all = queryRows(db, view); const i = all.findIndex((x) => x.id === r.id); addRow(db.id, { index: i + 1, values: defaultsFor(view) }); }}><Icon name="plus" size={16} /></span>
        <span className="ink-tv-gbtn is-grip"><Icon name="grip" size={14} /></span>
        <label className="ink-tv-check"><input type="checkbox" /></label>
      </div>
      <div className="ink-tv-cells">
        {props.map((id, i) => {
          const p = schema[id];
          const cls = 'ink-tv-cell is-' + p.type + (i < frozen ? ' is-frozen' : '') + (i === frozen - 1 ? ' is-frozen-edge' : '') + (view.widths && schema[id].wrap ? ' is-wrap' : '');
          if (p.type === 'title') return (
            <div key={id} className={cls} style={{ width: w(id), ...stick(i) }} role="cell" data-prop={id} onClick={(e) => { if ((e.target as HTMLElement).closest('.ink-tv-open')) return; if (!ctx.locked) openCellEditor(e.currentTarget, r.id, id, db); }}>
              <span className="ink-tv-ticon">{r.format?.page_icon ? <PageIcon block={r} size={18} emojiSize={16} /> : <PageGlyph size={18} empty={!(r.content || []).length} />}</span>
              <CellValue row={r} propId={id} db={db} />
              <span className="ink-tv-open" role="button" onClick={(e) => { e.stopPropagation(); ctx.openRow(r.id); }}><Icon name={view.openIn === 'center' ? 'centerPeek' : 'sidePeek'} size={14} /><span>打开</span></span>
            </div>
          );
          return (
            <div key={id} className={cls} style={{ width: w(id), ...stick(i) }} role="cell" data-prop={id}
              onClick={(e) => { if (!ctx.locked) openCellEditor(e.currentTarget, r.id, id, db); }}>
              <CellValue row={r} propId={id} db={db} wrap={p.wrap} onCheck={ctx.locked ? undefined : (v) => setValue(r.id, id, v)} />
            </div>
          );
        })}
        <div className="ink-tv-cell is-tail" />
      </div>
    </div>
  );

  const footer = (rs: Block[], key = 'all') => (
    <div className="ink-tv-calc" role="row" key={'calc-' + key}>
      {props.map((id, i) => {
        const fn = view.calcs?.[id];
        return (
          <div key={id} className={'ink-tv-calc-cell' + (fn && fn !== 'none' ? ' is-set' : '')} style={{ width: w(id), ...stick(i) }} role="button" onClick={(e) => openCalcMenu(e.currentTarget, db, view, id)}>
            {fn && fn !== 'none' ? <><span className="ink-tv-calc-label">{CALC_LABEL[fn]}</span><span className="ink-tv-calc-val">{calc(db, id, fn, rs)}</span></> : <span className="ink-tv-calc-hint">计算<Icon name="chevronDown" size={12} /></span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="ink-tv-scroll">
      <div className="ink-tv" style={{ minWidth: total + 8 + 32 }} role="table">
        {!groups && header}
        {!groups && <div className="ink-tv-body">{rows.map(renderRow)}</div>}
        {!groups && !ctx.locked && <NewRowButton className="ink-tv-newrow" onClick={() => addRow(db.id, { values: defaultsFor(view) })} />}
        {!groups && footer(rows)}
        {groups && groups.map((g) => (
          <div key={g.key} className="ink-tv-group">
            <div className="ink-tv-ghead" onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}>
              <span className={'ink-tv-gtoggle' + (collapsed[g.key] ? '' : ' is-open')}><Icon name="chevronRight" size={14} /></span>
              {schema[view.group!]?.type === 'status' ? <StatusPill label={g.label} color={g.color} /> : g.key ? <Tag label={g.label} color={g.color} /> : <span className="ink-muted">{g.label}</span>}
              {view.groupOpts?.showCount !== false && <span className="ink-tv-gcount">{g.rows.length}</span>}
            </div>
            {!collapsed[g.key] && <>
              {header}
              <div className="ink-tv-body">{g.rows.map(renderRow)}</div>
              {!ctx.locked && <NewRowButton className="ink-tv-newrow" onClick={() => addRow(db.id, { values: defaultsFor(view, g.key ? { [view.group!]: schema[view.group!].type === 'multi_select' ? [g.key] : g.key } : {}) })} />}
              {footer(g.rows, g.key)}
            </>}
          </div>
        ))}
      </div>
    </div>
  );
}
