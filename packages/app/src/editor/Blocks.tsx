/** Block renderers. Spacing follows the 7.40 measurements in docs/PARITY.md. */
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Block, BlockType, RichText } from '../store/model';
import { HEADINGS } from '../store/model';
import { store, newId } from '../store/store';
import { useBlock } from '../hooks/useStore';
import { Editable } from './Editable';
import { t } from '../i18n';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { isListish } from './commands';
import { renderTex } from './render-inline';
import { focusBlock, onBlockSelection, getBlockSelection, setBlockSelection } from './registry';
import { navigate } from '../app/state';
import { pageTitle, breadcrumbPath } from '../app/pages';
import { openEmojiPicker } from './emoji-picker';
import { openEquationEditor } from './equation';
import { resolveMedia } from '../page/media';
import { LANGUAGES, langLabel } from './code';
import { openMenu } from '../ui/menu';
import { toast } from '../ui/toast';
import { rtPlain, colorClass } from './richtext';

export interface Ctx { parentType: BlockType | 'root'; first: boolean; last: boolean; prev?: Block; next?: Block; depth: number; number?: number }

const HEADING_TOP: Partial<Record<BlockType, number>> = { header: 30, sub_header: 26, sub_sub_header: 22, header_4: 18 };
const PADDED8: BlockType[] = ['quote', 'callout', 'code', 'table', 'image', 'video', 'bookmark', 'equation', 'table_of_contents'];
const PAGE_LINKS: BlockType[] = ['page', 'alias', 'collection_view_page'];
const LIST_PARENTS: (BlockType | 'root')[] = ['bulleted_list', 'numbered_list', 'to_do', 'toggle'];

export function spacing(b: Block, c: Ctx): [number, number] {
  if (isListish(b)) {
    const inList = LIST_PARENTS.includes(c.parentType);
    const top = c.first && inList ? 2 : isListish(c.prev) ? 1 : 6;
    const bottom = c.last && inList ? 0 : isListish(c.next) ? 1 : 6;
    return [top, bottom];
  }
  if (HEADINGS.includes(b.type)) {
    const firstInBox = c.first && (c.parentType === 'callout' || c.parentType === 'column');
    return [firstInBox ? 6 : HEADING_TOP[b.type]!, 6];
  }
  if (PAGE_LINKS.includes(b.type)) {
    return [c.prev && PAGE_LINKS.includes(c.prev.type) ? 1 : 6, c.next && PAGE_LINKS.includes(c.next.type) ? 1 : 6];
  }
  if (b.type === 'column_list') return [12, 12];
  if (b.type === 'column' || b.type === 'table_row') return [0, 0];
  if (b.type === 'divider') return [6, 6];
  if (b.type === 'breadcrumb') return [8, 8];
  if (PADDED8.includes(b.type)) return [8, 8];
  return [6, 6];
}

/* ---------- selection subscription ---------- */
function useSelected(id: string) {
  const [s, setS] = useState(() => getBlockSelection().includes(id));
  useEffect(() => onBlockSelection(() => setS(getBlockSelection().includes(id))), [id]);
  return s;
}

/* ---------- list of children ---------- */
export function BlockChildren({ parent, depth, className, style }: { parent: Block; depth: number; className?: string; style?: CSSProperties }) {
  const kids = (parent.content || []).map((id) => store.get(id)).filter((b): b is Block => !!b && b.alive);
  let num = 0;
  return (
    <div className={'ink-children' + (className ? ' ' + className : '')} style={style}>
      {kids.map((b, i) => {
        if (b.type === 'numbered_list') { num = kids[i - 1]?.type === 'numbered_list' ? num + 1 : (b.format?.list_start ?? 1); } else num = 0;
        return <BlockView key={b.id} id={b.id} ctx={{ parentType: parent.type === 'page' ? 'root' : parent.type, first: i === 0, last: i === kids.length - 1, prev: kids[i - 1], next: kids[i + 1], depth, number: num || undefined }} />;
      })}
    </div>
  );
}

function ctxKey(c: Ctx) { return `${c.parentType}|${c.first}|${c.last}|${c.prev?.type}|${c.next?.type}|${c.depth}|${c.number}`; }

export const BlockView = memo(function BlockView({ id, ctx }: { id: string; ctx: Ctx }) {
  const b = useBlock(id);
  const selected = useSelected(id);
  if (!b || !b.alive) return null;
  const [pt, pb] = spacing(b, ctx);
  const color = b.format?.color;
  const cls = ['ink-block', 'ink-b-' + b.type, selected ? 'is-selected' : '', color && b.type !== 'callout' ? colorClass(color) : '', b.format?.toggleable ? 'is-toggleable' : ''].filter(Boolean).join(' ');
  return (
    <div className={cls} data-block-id={b.id} data-type={b.type} style={{ paddingTop: pt, paddingBottom: pb }}>
      <BlockBody b={b} ctx={ctx} />
    </div>
  );
}, (a, z) => a.id === z.id && ctxKey(a.ctx) === ctxKey(z.ctx));

function placeholderFor(b: Block, ctx: Ctx): { ph: string; always?: boolean } {
  switch (b.type) {
    case 'header': return { ph: t('ed.placeholder.h1'), always: true };
    case 'sub_header': return { ph: t('ed.placeholder.h2'), always: true };
    case 'sub_sub_header': return { ph: t('ed.placeholder.h3'), always: true };
    case 'header_4': return { ph: t('ed.placeholder.h4'), always: true };
    case 'bulleted_list': case 'numbered_list': return { ph: t('ed.placeholder.list'), always: true };
    case 'to_do': return { ph: t('ed.placeholder.todo'), always: true };
    case 'toggle': return { ph: t('ed.placeholder.toggle'), always: true };
    case 'quote': return { ph: t('ed.placeholder.quote'), always: true };
    case 'callout': return { ph: t('ed.placeholder.callout') };
    default: return { ph: ctx.parentType === 'column' || ctx.parentType === 'callout' ? '' : t('ed.placeholderFocused') };
  }
}

function TextRow({ b, ctx, className, tag }: { b: Block; ctx: Ctx; className?: string; tag?: 'div' | 'h2' | 'h3' | 'h4' }) {
  const { ph, always } = placeholderFor(b, ctx);
  return <Editable block={b} className={className} placeholder={ph} alwaysPlaceholder={always} tag={tag} />;
}

const BULLETS = ['•', '◦', '▪'];
function numberLabel(n: number, depth: number) {
  const k = depth % 3;
  if (k === 0) return `${n}.`;
  if (k === 1) { let s = ''; let x = n; while (x > 0) { x--; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); } return s + '.'; }
  const r: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = ''; let x = n; for (const [v, c] of r) while (x >= v) { s += c; x -= v; } return s + '.';
}

function Triangle({ open, onClick, big }: { open: boolean; onClick: () => void; big?: boolean }) {
  return (
    <div role="button" aria-expanded={open} className={'ink-triangle' + (open ? ' is-open' : '') + (big ? ' is-big' : '')} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden><path d="M2.25 1.75 L10.25 6 L2.25 10.25 Z" fill="currentColor" /></svg>
    </div>
  );
}
function setExpanded(b: Block, v: boolean) { store.transact('toggle', (tx) => tx.update(b.id, (x) => ({ props: { ...x.props, expanded: v } })), { noUndo: true }); }

function EmptyToggleHint({ b, heading }: { b: Block; heading?: boolean }) {
  return (
    <div className="ink-toggle-empty" onMouseDown={(e) => { e.preventDefault(); const id = createChild(b); focusBlock(id, 0); }}>
      {heading ? t('ed.placeholder.toggleHeadingEmpty') : t('ed.placeholder.toggleEmpty')}
    </div>
  );
}
function createChild(b: Block): string {
  const id = newId();
  store.transact('add child', (tx) => { tx.create({ id, type: 'text', title: [], parent: b.id, parentTable: 'block', content: [] }); tx.insertChild(b.id, id, 0); });
  return id;
}

function BlockBody({ b, ctx }: { b: Block; ctx: Ctx }) {
  const hasKids = !!b.content?.length;
  const kids = (cls = 'ink-children-indent') => hasKids ? <BlockChildren parent={b} depth={ctx.depth + 1} className={cls} /> : null;
  switch (b.type) {
    case 'text':
      return <><TextRow b={b} ctx={ctx} />{kids()}</>;
    case 'header': case 'sub_header': case 'sub_sub_header': case 'header_4': {
      const tag = b.type === 'header' ? 'h2' : b.type === 'sub_header' ? 'h3' : 'h4';
      if (b.format?.toggleable) {
        const open = !!b.props?.expanded;
        return (<>
          <div className="ink-row"><div className="ink-marker ink-marker-heading"><Triangle open={open} big onClick={() => setExpanded(b, !open)} /></div><TextRow b={b} ctx={ctx} tag={tag} className={'ink-h ink-' + b.type} /></div>
          {open && (hasKids ? kids() : <div className="ink-children-indent"><EmptyToggleHint b={b} heading /></div>)}
        </>);
      }
      return <><TextRow b={b} ctx={ctx} tag={tag} className={'ink-h ink-' + b.type} />{kids()}</>;
    }
    case 'bulleted_list':
      return (<>
        <div className="ink-row"><div className="ink-marker ink-bullet" contentEditable={false}><span>{BULLETS[ctx.depth % 3]}</span></div><TextRow b={b} ctx={ctx} /></div>
        {kids()}
      </>);
    case 'numbered_list':
      return (<>
        <div className="ink-row"><div className="ink-marker ink-number" contentEditable={false}><span>{numberLabel(ctx.number || 1, ctx.depth)}</span></div><TextRow b={b} ctx={ctx} /></div>
        {kids()}
      </>);
    case 'to_do': {
      const checked = !!b.props?.checked;
      return (<>
        <div className={'ink-row' + (checked ? ' is-checked' : '')}>
          <div className="ink-marker ink-check-wrap" contentEditable={false}>
            <div role="checkbox" aria-checked={checked} className={'ink-check' + (checked ? ' is-on' : '')} onMouseDown={(e) => e.preventDefault()} onClick={() => store.transact('check', (tx) => tx.update(b.id, (x) => ({ props: { ...x.props, checked: !checked } })))}>
              {checked && <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden><path d="M3 7.2 5.8 10 11 4" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          </div>
          <TextRow b={b} ctx={ctx} />
        </div>
        {kids()}
      </>);
    }
    case 'toggle': {
      const open = !!b.props?.expanded;
      return (<>
        <div className="ink-row"><div className="ink-marker" contentEditable={false}><Triangle open={open} onClick={() => setExpanded(b, !open)} /></div><TextRow b={b} ctx={ctx} /></div>
        {open && (hasKids ? kids() : <div className="ink-children-indent"><EmptyToggleHint b={b} /></div>)}
      </>);
    }
    case 'quote':
      return <div className="ink-quote"><TextRow b={b} ctx={ctx} />{kids('ink-children-flat')}</div>;
    case 'callout': {
      const c = b.format?.color;
      return (
        <div className={'ink-callout' + (c ? ' ' + colorClass(c.endsWith('_background') ? c : c) : ' ink-callout-default')}>
          <div className="ink-callout-icon" contentEditable={false}>
            <div role="button" className="ink-callout-icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={(e) => openEmojiPicker({ anchor: (e.currentTarget as HTMLElement).getBoundingClientRect(), onPick: (ch) => store.transact('icon', (tx) => tx.update(b.id, (x) => ({ format: { ...x.format, page_icon: ch } }))), onRemove: () => store.transact('icon', (tx) => tx.update(b.id, (x) => ({ format: { ...x.format, page_icon: undefined } }))) })}>
              <PageIcon block={b} size={24} emojiSize={16} />
            </div>
          </div>
          <div className="ink-callout-body">
            <div className="ink-block ink-b-text ink-callout-title" style={{ paddingTop: 6, paddingBottom: 6 }}><TextRow b={b} ctx={{ ...ctx, parentType: 'callout' }} /></div>
            {hasKids && <BlockChildren parent={b} depth={ctx.depth + 1} className="ink-children-flat" />}
          </div>
        </div>
      );
    }
    case 'divider':
      return <div className="ink-divider" contentEditable={false}><div /></div>;
    case 'code':
      return <CodeBlock b={b} />;
    case 'equation':
      return <EquationBlock b={b} />;
    case 'column_list':
      return <ColumnList b={b} depth={ctx.depth} />;
    case 'column':
      return kids('ink-children-flat');
    case 'image':
      return <ImageBlock b={b} />;
    case 'video':
      return <VideoBlock b={b} />;
    case 'bookmark':
      return <BookmarkBlock b={b} />;
    case 'table':
      return <TableBlock b={b} />;
    case 'table_of_contents':
      return <TocBlock b={b} />;
    case 'breadcrumb':
      return <BreadcrumbBlock b={b} />;
    case 'page': case 'alias': case 'collection_view_page':
      return <PageLinkBlock b={b} />;
    case 'synced':
      return <div className="ink-synced">{hasKids ? <BlockChildren parent={b} depth={ctx.depth} className="ink-children-flat" /> : <div className="ink-toggle-empty">{t('ed.syncedLabel')}</div>}</div>;
    default:
      return <TextRow b={b} ctx={ctx} />;
  }
}

/* ---------- code ---------- */
function CodeBlock({ b }: { b: Block }) {
  const [copied, setCopied] = useState(false);
  const lang = b.props?.language || 'plain';
  return (
    <div className="ink-code" data-lang={lang}>
      <div className="ink-code-bar" contentEditable={false}>
        <div role="button" className="ink-code-lang" onMouseDown={(e) => e.preventDefault()} onClick={(e) => openMenu((e.currentTarget as HTMLElement).getBoundingClientRect(), { width: 220, search: t('common.search'), maxHeight: 360, groups: [LANGUAGES.map((l) => ({ id: l.id, label: l.label, checked: l.id === lang, onSelect: () => store.transact('language', (tx) => tx.update(b.id, (x) => ({ props: { ...x.props, language: l.id } }))) }))] })}>
          {langLabel(lang)}<Icon name="chevronDown" size={12} />
        </div>
        <div className="ink-code-actions">
          <div role="button" className="ink-code-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { navigator.clipboard?.writeText(rtPlain(b.title)).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
            <Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? t('ed.copied') : t('ed.copyCode')}
          </div>
        </div>
      </div>
      <Editable block={b} code className={'ink-code-text' + (b.format?.code_wrap === false ? ' no-wrap' : '')} />
    </div>
  );
}

/* ---------- equation ---------- */
function EquationBlock({ b }: { b: Block }) {
  const tex = b.props?.tex || '';
  return (
    <div className={'ink-equation' + (tex ? '' : ' is-empty')} contentEditable={false} role="button" tabIndex={-1} onClick={() => { setBlockSelection([b.id]); openEquationEditor({ blockId: b.id }); }}>
      {tex ? <div dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} /> : <div className="ink-equation-empty"><Icon name="sqrt" size={18} /> {t('ed.equationEmpty')}</div>}
    </div>
  );
}

/* ---------- columns ---------- */
function ColumnList({ b, depth }: { b: Block; depth: number }) {
  const cols = store.children(b.id);
  const total = cols.reduce((s, c) => s + (c.format?.column_ratio ?? 1 / cols.length), 0) || 1;
  return (
    <div className="ink-columns">
      {cols.map((c, i) => (
        <div key={c.id} className="ink-column" data-block-id={c.id} data-type="column" style={{ width: `calc((100% - ${(cols.length - 1) * 46}px) * ${(c.format?.column_ratio ?? 1 / cols.length) / total})` }}>
          <BlockChildren parent={c} depth={depth} className="ink-children-flat" />
          {i < cols.length - 1 && <div className="ink-column-resizer" contentEditable={false} />}
        </div>
      ))}
    </div>
  );
}

/* ---------- media ---------- */
function Caption({ b }: { b: Block }) {
  const cap = b.props?.caption;
  if (!cap?.length) return null;
  return <div className="ink-caption">{rtPlain(cap)}</div>;
}
function ImageBlock({ b }: { b: Block }) {
  const src = resolveMedia(b.props?.src);
  const aspect = b.format?.image_aspect ?? 316.06 / 704;
  if (!src) return <MediaPlaceholder icon="image" label={t('ed.imagePlaceholder')} />;
  return (
    <div className="ink-image" contentEditable={false}>
      <div className="ink-image-frame" style={{ width: b.format?.image_width ? b.format.image_width : '100%', paddingBottom: `${aspect * 100}%` }}>
        <img src={src} alt="" draggable={false} />
      </div>
      <Caption b={b} />
    </div>
  );
}
function VideoBlock({ b }: { b: Block }) {
  if (!b.props?.url) return <MediaPlaceholder icon="video" label={t('ed.videoPlaceholder')} />;
  return (
    <div className="ink-video" contentEditable={false}>
      <div className="ink-video-frame" style={{ paddingBottom: `${(396.61 / 704) * 100}%` }}>
        <div className="ink-video-inner"><div className="ink-video-play"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></div><div className="ink-video-url">{b.props.url}</div></div>
      </div>
    </div>
  );
}
function BookmarkBlock({ b }: { b: Block }) {
  const bm = b.props?.bookmark;
  if (!bm && !b.props?.url) return <MediaPlaceholder icon="bookmark" label={t('ed.bookmarkPlaceholder')} />;
  const url = bm?.url || b.props?.url || '';
  return (
    <div className="ink-bookmark" contentEditable={false} role="link" tabIndex={-1} onClick={(e) => { if (e.metaKey || e.ctrlKey || true) window.open(url, '_blank'); }}>
      <div className="ink-bookmark-text">
        <div className="ink-bookmark-title">{bm?.title || url}</div>
        <div className="ink-bookmark-desc">{bm?.description}</div>
        <div className="ink-bookmark-url"><img src={resolveMedia(bm?.favicon || 'fixture://favicon')} alt="" width={16} height={16} /><span>{url}</span></div>
      </div>
      {bm?.image && <div className="ink-bookmark-img"><img src={resolveMedia(bm.image)} alt="" /></div>}
    </div>
  );
}
function MediaPlaceholder({ icon, label }: { icon: 'image' | 'video' | 'bookmark'; label: string }) {
  return <div className="ink-media-ph" contentEditable={false} role="button"><Icon name={icon} size={20} /><span>{label}</span></div>;
}

/* ---------- table ---------- */
function TableBlock({ b }: { b: Block }) {
  const rows = store.children(b.id);
  const widths = b.format?.table_widths || [];
  const ncol = Math.max(widths.length, ...rows.map((r) => r.props?.cells?.length || 0));
  const header = !!b.format?.table_has_header;
  const setCell = (row: Block, ci: number, rt: RichText) => store.transact('cell', (tx) => tx.update(row.id, (x) => { const cells = [...(x.props?.cells || [])]; while (cells.length < ncol) cells.push([]); cells[ci] = rt; return { props: { ...x.props, cells } }; }), { coalesce: 'cell:' + row.id + ':' + ci });
  const addRow = () => store.transact('add row', (tx) => { const id = newId(); tx.create({ id, type: 'table_row', title: [], props: { cells: Array.from({ length: ncol }, () => []) }, parent: b.id, parentTable: 'block', content: [] }); tx.insertChild(b.id, id); });
  const addCol = () => store.transact('add column', (tx) => { tx.update(b.id, (x) => ({ format: { ...x.format, table_widths: [...(x.format?.table_widths || Array(ncol).fill(120)), 120] } })); for (const r of rows) tx.update(r.id, (x) => ({ props: { ...x.props, cells: [...(x.props?.cells || []), []] } })); });
  return (
    <div className="ink-table-wrap" contentEditable={false}>
      <div className="ink-table-scroll">
        <table className="ink-table">
          <colgroup>{Array.from({ length: ncol }, (_, i) => <col key={i} style={{ width: widths[i] ?? 120 }} />)}</colgroup>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id} data-row-id={r.id}>
                {Array.from({ length: ncol }, (_, ci) => {
                  const Cell = header && ri === 0 ? 'th' : 'td';
                  return <Cell key={ci} className="ink-cell"><Editable block={r} value={(r.props?.cells?.[ci] as RichText) || []} onChange={(rt) => setCell(r, ci, rt)} /></Cell>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ink-table-add-col" role="button" onClick={addCol}><Icon name="plus" size={14} /></div>
      </div>
      <div className="ink-table-add-row" role="button" onClick={addRow}><Icon name="plus" size={14} /></div>
    </div>
  );
}

/* ---------- TOC ---------- */
export function headingsOf(pageId: string): Block[] {
  const out: Block[] = [];
  const walk = (id: string) => { for (const c of store.children(id)) { if (!c.alive) continue; if (HEADINGS.includes(c.type)) out.push(c); if (c.type !== 'page' && c.type !== 'collection_view_page') walk(c.id); } };
  walk(pageId);
  return out;
}
export function scrollToBlock(id: string) {
  const el = document.querySelector<HTMLElement>(`.ink-page [data-block-id="${id}"]`);
  const sc = el?.closest('.ink-scroller');
  if (el && sc) { sc.scrollTo({ top: sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 80, behavior: 'smooth' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1200); }
}
function TocBlock({ b }: { b: Block }) {
  const page = store.pageOf(b.id);
  const hs = page ? headingsOf(page.id) : [];
  const lvl = (x: Block) => HEADINGS.indexOf(x.type);
  const minL = Math.min(...hs.map(lvl), 9);
  return (
    <div className="ink-toc" contentEditable={false}>
      {hs.length ? hs.map((h) => (
        <a key={h.id} className="ink-toc-item" style={{ marginLeft: (lvl(h) - minL) * 24 }} href={'#' + h.id} onClick={(e) => { e.preventDefault(); scrollToBlock(h.id); }}>
          <span>{rtPlain(h.title) || t('page.untitled')}</span>
        </a>
      )) : <div className="ink-toc-empty">{t('ed.tocEmpty')}</div>}
    </div>
  );
}

/* ---------- breadcrumb ---------- */
function BreadcrumbBlock({ b }: { b: Block }) {
  const page = store.pageOf(b.id);
  const path = page ? breadcrumbPath(page.id) : [];
  return (
    <div className="ink-crumbs-block" contentEditable={false}>
      {path.map((p, i) => (
        <span key={p.id} className="ink-crumbs-item-wrap">
          {i > 0 && <span className="ink-crumbs-sep">/</span>}
          <span role="link" className="ink-crumbs-item" onClick={() => navigate(p.id)}>{(p.format?.page_icon || i > 0) && <PageIcon block={p} size={18} emojiSize={16} />}<span>{pageTitle(p)}</span></span>
        </span>
      ))}
      {path[0] && store.space.privatePages.includes(path[0].id) && (
        <span role="button" className="ink-crumbs-scope"><Icon name="lock" size={12} stroke={2} /><span>{t('top.private')}</span><Icon name="chevronDown" size={12} stroke={2} /></span>
      )}
    </div>
  );
}

/* ---------- page / alias link ---------- */
function PageLinkBlock({ b }: { b: Block }) {
  const target = b.type === 'alias' ? store.get(b.props?.target) : b;
  useBlock(target?.id);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="ink-pagelink" contentEditable={false} role="link" tabIndex={-1}
      onClick={(e) => { if (!target) return toast(t('page.notFound')); if ((e.target as HTMLElement).closest('.ink-block-handle')) return; navigate(target.id); }}>
      <span className="ink-pagelink-icon"><PageIcon block={b.type === 'alias' ? b : target} size={20} emojiSize={17} /></span>
      <span className="ink-pagelink-title">{target ? pageTitle(target) : t('page.notFound')}</span>
    </div>
  );
}

export type { ReactNode };
