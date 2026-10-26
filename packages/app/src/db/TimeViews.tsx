import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../store/model';
import { Icon } from '../ui/icons';
import { schemaOf, queryRows, addRow, rawValue, setValue, isoOf, parseIso, updateView, type TimelineScale } from './model';
import { openMenu } from '../ui/menu';
import { CellValue } from './cells';
import { defaultsFor, type DbCtx } from './Database';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const CN_MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const DAY = 86400000;
/** the today line sits at the current time of day */
const nowFrac = () => { const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) / 1440; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diffDays = (a: Date, b: Date) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / DAY);
function dateProp(ctx: DbCtx) { const s = schemaOf(ctx.db); return ctx.view.dateProp && s[ctx.view.dateProp] ? ctx.view.dateProp : Object.keys(s).find((k) => s[k].type === 'date'); }
function span(r: Block, prop: string, db: Block): [Date, Date] | null {
  const v = rawValue(r, prop, db); if (!Array.isArray(v) || !v[0]) return null;
  const a = parseIso(v[0]); const b = v[1] ? parseIso(v[1]) : a; return [a, b < a ? a : b];
}

/* ---------- calendar ---------- */
export function CalendarView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx;
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const prop = dateProp(ctx);
  const rows = queryRows(db, view, ctx.search);
  const start = addDays(month, -month.getDay());
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const events = prop ? rows.map((r) => ({ r, s: span(r, prop, db) })).filter((e) => e.s) as { r: Block; s: [Date, Date] }[] : [];
  const [drag, setDrag] = useState<string | null>(null);
  const dropOn = (day: Date) => {
    if (!drag || !prop) return; const r = events.find((e) => e.r.id === drag); setDrag(null); if (!r) return;
    const len = diffDays(r.s[1], r.s[0]);
    setValue(r.r.id, prop, len ? [isoOf(day), isoOf(addDays(day, len))] : [isoOf(day)]);
  };
  return (
    <div className="ink-cal">
      <div className="ink-cal-head">
        <span className="ink-cal-month">{month.getFullYear()}年{month.getMonth() + 1}月</span>
        <span style={{ flex: 1 }} />
        <button className="ink-cal-manage"><Icon name="calendar" size={14} />在日历中管理</button>
        <button className="ink-cal-nav" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevronLeft" size={16} /></button>
        <button className="ink-cal-today" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>今天</button>
        <button className="ink-cal-nav" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevronRight" size={16} /></button>
      </div>
      <div className="ink-cal-wd">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="ink-cal-grid">
        {Array.from({ length: weeks }, (_, wi) => {
          const ws = addDays(start, wi * 7); const we = addDays(ws, 6);
          const wk = events.filter((e) => e.s[1] >= ws && e.s[0] <= we).sort((a, b) => +a.s[0] - +b.s[0] || +b.s[1] - +a.s[1]);
          const lanes: Date[] = []; const placed = wk.map((e) => {
            const a = e.s[0] < ws ? ws : e.s[0]; const b = e.s[1] > we ? we : e.s[1];
            let lane = lanes.findIndex((end) => end < a); if (lane < 0) { lane = lanes.length; lanes.push(b); } else lanes[lane] = b;
            return { ...e, a: diffDays(a, ws), n: diffDays(b, a) + 1, lane };
          });
          return (
            <div key={wi} className="ink-cal-week" style={{ minHeight: Math.max(124, 34 + lanes.length * 34 + 8) }}>
              {Array.from({ length: 7 }, (_, di) => {
                const d = addDays(ws, di); const isToday = isoOf(d) === isoOf(today);
                return (
                  <div key={di} className={'ink-cal-cell' + (di === 0 || di === 6 ? ' is-weekend' : '') + (d.getMonth() !== month.getMonth() ? ' is-out' : '')}
                    onDragOver={(e) => { if (drag) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); dropOn(d); }}>
                    <span className={'ink-cal-day' + (isToday ? ' is-today' : '')}>{d.getDate() === 1 ? `${d.getMonth() + 1}月1日` : d.getDate()}</span>
                    {!ctx.locked && prop && <button className="ink-cal-add" aria-label="新建" onClick={() => { const id = addRow(db.id, { values: defaultsFor(view, { [prop]: [isoOf(d)] }) }); ctx.openRow(id); }}><Icon name="plus" size={14} /></button>}
                  </div>
                );
              })}
              {placed.map((e) => (
                <div key={e.r.id} className="ink-cal-event" style={{ left: `calc(${(e.a / 7) * 100}%)`, width: `calc(${(e.n / 7) * 100}%)`, top: 30 + e.lane * 34 }}
                  draggable={!ctx.locked} onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', e.r.id); setDrag(e.r.id); }} onDragEnd={() => setDrag(null)}>
                  <a className="ink-cal-chip" role="link" data-row-id={e.r.id} onClick={() => ctx.openRow(e.r.id)}><span className="ink-cal-chip-t"><CellValue row={e.r} propId="title" db={db} /></span></a>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- timeline ---------- */
/** timeline scales: px per day, visible range, which days get a tick, and the upper label row */
export const TL_SCALES: Record<TimelineScale, { label: string; dayW: number; days: number; tick: (d: Date) => boolean; tickLabel: (d: Date) => string; top: 'month' | 'year'; step: number }> = {
  day: { label: '天', dayW: 72, days: 120, tick: () => true, tickLabel: (d) => `${d.getDate()}日 周${'日一二三四五六'[d.getDay()]}`, top: 'month', step: 7 },
  week: { label: '周', dayW: 40, days: 180, tick: () => true, tickLabel: (d) => String(d.getDate()), top: 'month', step: 7 },
  month: { label: '月', dayW: 24, days: 300, tick: (d) => d.getDay() === 1, tickLabel: (d) => String(d.getDate()), top: 'month', step: 14 },
  quarter: { label: '季度', dayW: 12, days: 400, tick: (d) => d.getDay() === 1, tickLabel: (d) => String(d.getDate()), top: 'month', step: 28 },
  year: { label: '年', dayW: 3, days: 1100, tick: (d) => d.getDate() === 1, tickLabel: (d) => CN_MONTH[d.getMonth()], top: 'year', step: 91 },
};
export function TimelineView({ ctx }: { ctx: DbCtx }) {
  const { db, view } = ctx;
  const scale = view.timelineScale || 'quarter';
  const S = TL_SCALES[scale]; const DAY_W = S.dayW;
  const prop = dateProp(ctx);
  const rows = queryRows(db, view, ctx.search);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = S.days;
  const origin = useMemo(() => addDays(today, -Math.round(days * 0.45)), [isoOf(today), days]);
  const x = (d: Date) => diffDays(d, origin) * DAY_W;
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollLeft = x(today) - Math.round(el.clientWidth * 0.492); }, [scale]);
  const [sl, setSl] = useState(0);
  const ticks: Date[] = []; const months: Date[] = []; const years: Date[] = [];
  for (let i = 0; i < days; i++) { const d = addDays(origin, i); if (S.tick(d)) ticks.push(d); if (d.getDate() === 1) months.push(d); if (d.getDate() === 1 && d.getMonth() === 0) years.push(d); }
  const firstMonday = (m: Date) => { const d = new Date(m); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d; };
  const leftDate = addDays(origin, Math.floor(sl / DAY_W) + 2);
  const scrollToday = () => { const el = scroller.current; if (el) el.scrollTo({ left: x(today) - Math.round(el.clientWidth * 0.492), behavior: 'smooth' }); };
  const topLabels = S.top === 'year'
    ? years.map((y) => <span key={'y' + isoOf(y)} className="ink-tl-mlabel" style={{ left: x(y) + 4 }}>{y.getFullYear()}年</span>)
    : months.map((m) => { const at = scale === 'quarter' || scale === 'month' ? firstMonday(m) : m; return <span key={isoOf(m)} className="ink-tl-mlabel" style={{ left: x(at) - (scale === 'quarter' || scale === 'month' ? DAY_W / 2 : -4) }}>{scale === 'quarter' || scale === 'month' ? CN_MONTH[m.getMonth()] : `${m.getFullYear()}年${m.getMonth() + 1}月`}</span>; });
  const tickX = (d: Date) => (scale === 'day' || scale === 'week' ? x(d) + DAY_W / 2 : scale === 'year' ? x(d) + 4 : x(d));
  const lines = S.top === 'year' ? years : months;
  return (
    <div className="ink-tl">
      <div className="ink-tl-scroll" ref={scroller} onScroll={(e) => setSl(e.currentTarget.scrollLeft)}>
        <div className="ink-tl-canvas" style={{ width: days * DAY_W, height: 66 + rows.length * 36 + 66 }}>
          <div className="ink-tl-head">
            {topLabels}
            {ticks.map((d) => <span key={isoOf(d)} className={'ink-tl-tick' + (scale === 'year' ? ' is-left' : '') + ((scale === 'day' || scale === 'week') && (d.getDay() === 0 || d.getDay() === 6) ? ' is-weekend' : '')} style={{ left: tickX(d) }}>{isoOf(d) === isoOf(today) && scale !== 'year' ? '' : S.tickLabel(d)}</span>)}
            {scale !== 'year' && <span className="ink-tl-todaybadge" style={{ left: tickX(today) }}>{today.getDate()}</span>}
          </div>
          {lines.map((m) => <span key={'l' + isoOf(m)} className="ink-tl-mline" style={{ left: x(m) }} />)}
          {(scale === 'day' || scale === 'week') && ticks.filter((d) => d.getDay() === 0 || d.getDay() === 6).map((d) => <span key={'w' + isoOf(d)} className="ink-tl-weekend" style={{ left: x(d), width: DAY_W }} />)}
          <span className="ink-tl-todayline" style={{ left: x(today) + DAY_W * nowFrac() }} />
          {prop && rows.map((r, i) => {
            const s = span(r, prop, db); if (!s) return null;
            return (
              <div key={r.id} className="ink-tl-bar" data-row-id={r.id} style={{ left: x(s[0]), width: (diffDays(s[1], s[0]) + 1) * DAY_W, top: 66 + i * 36 + 4 }} onClick={() => ctx.openRow(r.id)}>
                <span className="ink-tl-label"><CellValue row={r} propId="title" db={db} /></span>
              </div>
            );
          })}
          {!ctx.locked && <button className="ink-tl-new" style={{ left: sl + 104, top: 66 + rows.length * 36 + 10 }} onClick={() => { const id = addRow(db.id, { values: defaultsFor(view, prop ? { [prop]: [isoOf(today)] } : {}) }); ctx.openRow(id); }}><Icon name="plus" size={16} />新建</button>}
        </div>
      </div>
      <div className="ink-tl-overlay">
        <button className="ink-tl-expand" aria-label="显示表格"><Icon name="chevronsRight" size={16} /></button>
        <span className="ink-tl-cur">{leftDate.getFullYear()}年{leftDate.getMonth() + 1}月</span>
        <span style={{ flex: 1 }} />
        <span className="ink-tl-right">
        <button className="ink-cal-manage"><Icon name="calendar" size={14} />在日历中管理</button>
        <button className="ink-tl-scale" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 160, groups: [(Object.keys(TL_SCALES) as TimelineScale[]).map((k) => ({ id: 'sc-' + k, label: TL_SCALES[k].label, checked: k === scale, onSelect: () => updateView(db.id, view.id, { timelineScale: k }, 'timeline scale') }))] }, { placement: 'bottom-end' })}>{S.label}<Icon name="chevronDown" size={14} /></button>
        <button className="ink-cal-nav" aria-label="向前" onClick={() => scroller.current?.scrollBy({ left: -S.step * DAY_W, behavior: 'smooth' })}><Icon name="chevronLeft" size={16} /></button>
        <button className="ink-cal-today" onClick={scrollToday}>今天</button>
        <button className="ink-cal-nav" aria-label="向后" onClick={() => scroller.current?.scrollBy({ left: S.step * DAY_W, behavior: 'smooth' })}><Icon name="chevronRight" size={16} /></button>
        </span>
      </div>
    </div>
  );
}
