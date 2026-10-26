import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type { Block } from '../store/model';
import { HEADINGS, plain } from '../store/model';
import { store, newId } from '../store/store';
import { useBlock, useStoreVersion } from '../hooks/useStore';
import { BlockChildren, headingsOf, scrollToBlock } from '../editor/Blocks';
import { t } from '../i18n';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openEmojiPicker } from '../editor/emoji-picker';
import { randomEmoji } from '../editor/emoji-data';
import { setPageFormat, pageTitle, isInTrash, restorePage } from '../app/pages';
import { focusBlock, getBlockSelection, setBlockSelection, clearBlockSelection, onBlockSelection, selectableBlocks } from '../editor/registry';
import { openBlockMenuFor } from '../editor/block-menu';
import { moveBlocks, deleteBlocks, duplicateBlocks, indent, outdent, prevSibling, nextSibling, insertAfter, setTitle } from '../editor/commands';
import { openInlineMenu } from '../editor/inline-menus';
import { undo, redo, mod } from '../editor/keyboard';
import { installBlockClipboard } from '../editor/clipboard';
import { attachLinkHover } from '../editor/link-popover';
import { hideToolbar } from '../editor/inline-toolbar';
import { resolveMedia, COVER_GALLERY } from './media';
import { tip } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { setUi } from '../app/state';
import { rtPlain } from '../editor/richtext';
import { LockContext } from '../editor/Editable';
import { Database } from '../db/Database';
import { RowProps } from '../db/RowProps';
import { dbOfRow } from '../db/model';

/* ================= page ================= */
export function PageView({ pageId, variant = 'main' }: { pageId: string; variant?: 'main' | 'side' | 'center' }) {
  const page = useBlock(pageId);
  useStoreVersion();
  const scroller = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const keyhost = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); clearBlockSelection(); hideToolbar(); }, [pageId]);
  useEffect(() => { if (!pageRef.current) return; const a = installBlockClipboard(pageRef.current); const b = attachLinkHover(pageRef.current); return () => { a(); b?.(); }; }, [pageId]);

  // idle chrome fade while typing
  useEffect(() => {
    const el = pageRef.current; if (!el) return;
    let timer = 0;
    const onKey = (e: KeyboardEvent) => { if (e.metaKey || e.ctrlKey || e.key.length > 1 && e.key !== 'Backspace') return; setUi({ chromeHidden: true }); };
    const onMove = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setUi({ chromeHidden: false }), 0); };
    el.addEventListener('keydown', onKey); window.addEventListener('mousemove', onMove);
    return () => { el.removeEventListener('keydown', onKey); window.removeEventListener('mousemove', onMove); };
  }, [pageId]);

  if (!page || !page.alive && !isInTrash(pageId)) return <div className="ink-scroller"><div className="ink-page-missing">{t('page.notFound')}</div></div>;
  const f = page.format || {};
  const isDbPage = page.type === 'collection_view_page';
  const rowDb = dbOfRow(page);
  const locked = !!page.props?.locked;
  const cls = ['ink-page', 'font-' + (f.page_font || 'default'), f.page_small_text ? 'is-small' : '', f.page_full_width ? 'is-full' : '', isDbPage ? 'is-db' : '', rowDb ? 'is-row' : '', variant !== 'main' ? 'is-peek is-peek-' + variant : '', locked ? 'is-locked' : ''].filter(Boolean).join(' ');
  const trashed = isInTrash(pageId);
  const content = page.content?.filter((c) => store.get(c)?.alive) || [];
  const blankRow = !!rowDb && (content.length === 0 || (content.length === 1 && store.get(content[0])?.type === 'text' && !rtPlain(store.get(content[0])!.title).length));
  return (
    <div className="ink-scroller" ref={scroller} onMouseDown={(e) => rubberBandStart(e, pageId, scroller.current!)}>
      {trashed && <div className="ink-trash-banner">{t('trash.banner')}<button className="ink-btn-outline-white" onClick={() => restorePage(pageId)}>{t('trash.restore')}</button></div>}
      <LockContext.Provider value={locked}>
      <div className={cls} ref={pageRef} data-page-id={pageId}>
        <PageHeader page={page} />
        {rowDb && <div className="ink-page-content ink-rowprops-wrap"><RowProps row={page} db={rowDb} locked={locked} /></div>}
        <div className="ink-page-content">
          {isDbPage ? <Database dbId={page.id} locked={locked} /> : <>
            <BlockChildren parent={page} depth={0} className="ink-page-blocks" />
            {content.length === 0 && !rowDb && <EmptyPageHint page={page} />}
            {blankRow && <div className="ink-row-blank-hint" onMouseDown={(e) => { e.preventDefault(); clickBelow(page); }}>按 enter（回车键）以继续使用空白页，或创建模板</div>}
          </>}
          {!isDbPage && !locked && <div className="ink-page-tail" onMouseDown={(e) => { e.preventDefault(); clickBelow(page); }} />}
        </div>
        <BlockHandles pageId={pageId} pageRef={pageRef} />
        <DropIndicator pageRef={pageRef} pageId={pageId} />
      </div>
      </LockContext.Provider>
      {f.page_toc && <FloatingOutline pageId={pageId} scroller={scroller} />}
      <div className="ink-page-keyhost" tabIndex={-1} ref={keyhost} onKeyDown={(e) => selectionKeys(e.nativeEvent, pageId)} />
      <RubberBand />
    </div>
  );
}

function clickBelow(page: Block) {
  const kids = store.children(page.id).filter((b) => b.alive);
  const last = kids[kids.length - 1];
  if (last && last.type === 'text' && !rtPlain(last.title).length && !last.content?.length) { focusBlock(last.id, 0); return; }
  const id = newId();
  store.transact('insert', (tx) => { tx.create({ id, type: 'text', title: [], parent: page.id, parentTable: 'block', content: [] }); tx.insertChild(page.id, id); });
  focusBlock(id, 0);
}

function EmptyPageHint({ page }: { page: Block }) {
  return <div className="ink-empty-hint" onMouseDown={(e) => { e.preventDefault(); clickBelow(page); }}>{t('ed.placeholderFocused')}</div>;
}

/* ================= header ================= */
function PageHeader({ page }: { page: Block }) {
  const f = page.format || {};
  const icon = f.page_icon; const cover = f.page_cover;
  const [hover, setHover] = useState(false);
  const pickIcon = (anchor: DOMRect) => openEmojiPicker({ anchor, onPick: (ch) => setPageFormat(page.id, { page_icon: ch }, 'icon'), onRemove: () => setPageFormat(page.id, { page_icon: undefined }, 'icon') });
  const addCover = () => setPageFormat(page.id, { page_cover: COVER_GALLERY[Math.floor(Math.random() * COVER_GALLERY.length)], page_cover_position: 0.5 }, 'cover');
  return (
    <div className={'ink-page-header' + (cover ? ' has-cover' : '') + (icon ? ' has-icon' : '')} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {cover && <Cover page={page} />}
      <div className="ink-page-header-inner">
        {!cover && <div className="ink-page-top-pad" />}
        {icon && (
          <div className="ink-page-icon" role="button" onClick={(e) => pickIcon((e.currentTarget as HTMLElement).getBoundingClientRect())}>
            <PageIcon block={page} size={78} emojiSize={78} />
          </div>
        )}
        <div className={'ink-page-controls' + (hover ? ' is-visible' : '')}>
          {!icon && <button className="ink-page-ctl" onClick={(e) => { setPageFormat(page.id, { page_icon: randomEmoji() }, 'icon'); void e; }}><Icon name="smile" size={16} /><span>{t('page.addIcon')}</span></button>}
          {!cover && <button className="ink-page-ctl" onClick={addCover}><Icon name="image" size={16} /><span>{t('page.addCover')}</span></button>}
          <button className="ink-page-ctl"><Icon name="comment" size={16} /><span>{t('page.addComment')}</span></button>
        </div>
        <PageTitle page={page} />
      </div>
    </div>
  );
}

function Cover({ page }: { page: Block }) {
  const f = page.format || {};
  const [repos, setRepos] = useState(false);
  const [pos, setPos] = useState(f.page_cover_position ?? 0.5);
  useEffect(() => setPos(f.page_cover_position ?? 0.5), [f.page_cover_position]);
  const src = resolveMedia(f.page_cover);
  const drag = (e: React.MouseEvent) => {
    if (!repos) return;
    e.preventDefault();
    const y0 = e.clientY; const p0 = pos; const h = (e.currentTarget as HTMLElement).getBoundingClientRect().height;
    const mv = (ev: MouseEvent) => setPos(Math.max(0, Math.min(1, p0 - (ev.clientY - y0) / (h * 2))));
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  return (
    <div className={'ink-cover' + (repos ? ' is-repos' : '')} onMouseDown={drag}>
      <img src={src} alt="" draggable={false} style={{ objectPosition: `center ${pos * 100}%` }} />
      {repos && <div className="ink-cover-hint">{t('page.dragToReposition')}</div>}
      <div className="ink-cover-actions">
        {repos ? <>
          <button onClick={() => { setPageFormat(page.id, { page_cover_position: pos }, 'cover'); setRepos(false); }}>{t('page.savePosition')}</button>
          <button onClick={() => { setPos(f.page_cover_position ?? 0.5); setRepos(false); }}>{t('common.cancel')}</button>
        </> : <>
          <button onClick={(e) => openMenu((e.currentTarget as HTMLElement).getBoundingClientRect(), { width: 240, groups: [COVER_GALLERY.map((c, i) => ({ id: c, label: t('page.coverN', { n: i + 1 }), onSelect: () => setPageFormat(page.id, { page_cover: c }, 'cover') })), [{ id: 'rm', label: t('page.removeCover'), icon: 'trash', onSelect: () => setPageFormat(page.id, { page_cover: undefined }, 'cover') }]] }, { placement: 'bottom-end' })}>{t('page.changeCover')}</button>
          <button onClick={() => setRepos(true)}>{t('page.reposition')}</button>
        </>}
      </div>
    </div>
  );
}

function PageTitle({ page }: { page: Block }) {
  const ref = useRef<HTMLDivElement>(null);
  const locked = useContext(LockContext);
  const text = plain(page.title);
  useLayoutEffect(() => {
    const el = ref.current!;
    if (el.textContent !== text && document.activeElement !== el) el.textContent = text;
    else if (el.textContent !== text && document.activeElement === el && !composing.current) el.textContent = text;
    el.classList.toggle('is-empty', !text);
  }, [text]);
  const composing = useRef(false);
  const commit = () => {
    const el = ref.current!; const v = (el.textContent || '').replace(/\n/g, '');
    el.classList.toggle('is-empty', !v);
    if (v !== plain(page.title)) store.transact('title', (tx) => tx.update(page.id, { title: v ? [[v]] : [] }), { coalesce: 'title:' + page.id });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (composing.current || e.nativeEvent.isComposing) return;
    if (mod(e) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const kids = store.children(page.id).filter((b) => b.alive);
      const sel = getSelection(); const off = sel?.anchorOffset ?? text.length;
      const after = text.slice(off);
      if (after) store.transact('title', (tx) => tx.update(page.id, { title: text.slice(0, off) ? [[text.slice(0, off)]] : [] }));
      const id = newId();
      store.transact('insert', (tx) => { tx.create({ id, type: 'text', title: after ? [[after]] : [], parent: page.id, parentTable: 'block', content: [] }); tx.insertChild(page.id, id, 0); });
      void kids;
      focusBlock(id, 0);
    } else if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && getSelection()?.anchorOffset === text.length)) {
      const first = selectableBlocks(page.id).find((b) => !['divider', 'image', 'table', 'column_list', 'column'].includes(b.type));
      if (first) { e.preventDefault(); focusBlock(first.id, 0); }
    }
  };
  return (
    <div className="ink-page-title">
      <div ref={ref} className="ink-title-editable" contentEditable={!locked} suppressContentEditableWarning spellCheck data-placeholder={t('page.untitledPlaceholder')} role="textbox" aria-label="title"
        onInput={() => { if (!composing.current) commit(); }}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => { composing.current = false; commit(); }}
        onKeyDown={onKey}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ')); }}
      />
    </div>
  );
}

/* ================= floating outline (TOC) ================= */
function FloatingOutline({ pageId, scroller }: { pageId: string; scroller: React.RefObject<HTMLDivElement | null> }) {
  const hs = headingsOf(pageId);
  const [active, setActive] = useState<string | null>(hs[0]?.id ?? null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sc = scroller.current; if (!sc) return;
    const on = () => {
      const top = sc.getBoundingClientRect().top + 100;
      let cur: string | null = hs[0]?.id ?? null;
      for (const h of hs) { const el = sc.querySelector(`[data-block-id="${h.id}"]`); if (el && el.getBoundingClientRect().top <= top) cur = h.id; }
      setActive(cur);
    };
    sc.addEventListener('scroll', on, { passive: true }); on();
    return () => sc.removeEventListener('scroll', on);
  }, [pageId, hs.length]);
  if (!hs.length) return null;
  const lvl = (b: Block) => HEADINGS.indexOf(b.type);
  return (
    <div className="ink-outline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="ink-outline-lines">
        {hs.map((h) => <div key={h.id} className={'ink-outline-line' + (h.id === active ? ' is-active' : '')} style={{ width: [16, 12, 8, 8][lvl(h)] }} />)}
      </div>
      {open && (
        <div className="ink-outline-panel">
          {hs.map((h) => <div key={h.id} role="link" className={'ink-outline-item' + (h.id === active ? ' is-active' : '')} style={{ paddingLeft: 8 + lvl(h) * 12 }} onClick={() => scrollToBlock(h.id)}>{rtPlain(h.title) || t('common.untitled')}</div>)}
        </div>
      )}
    </div>
  );
}

/* ================= handle & plus ================= */
const HANDLE_SKIP = new Set(['column', 'column_list', 'table_row']);
function hoveredBlock(target: EventTarget | null): HTMLElement | null {
  let el = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-block-id]') || null;
  while (el && HANDLE_SKIP.has(el.dataset.type || '')) el = el.parentElement?.closest<HTMLElement>('[data-block-id]') || null;
  return el;
}
function handleTop(el: HTMLElement): number {
  // centre a 24px handle on the first line box
  const r = el.getBoundingClientRect();
  const ed = el.querySelector<HTMLElement>(':scope > [data-editable-id], :scope > .ink-row [data-editable-id], :scope > .ink-quote > [data-editable-id], :scope .ink-callout-title [data-editable-id]');
  if (ed && (ed.closest('[data-block-id]') === el)) {
    const cs = getComputedStyle(ed);
    const lh = parseFloat(cs.lineHeight) || 24;
    return ed.getBoundingClientRect().top + parseFloat(cs.paddingTop) + (lh - 24) / 2 - r.top;
  }
  const pt = parseFloat(getComputedStyle(el).paddingTop) || 0;
  if (el.dataset.type === 'callout') return pt + 8 + 2;
  if (el.dataset.type === 'divider') return 0 - 5.5 + 6;
  return pt;
}
function textLeft(el: HTMLElement): number {
  const ed = el.querySelector<HTMLElement>('[data-editable-id]');
  if (ed && ed.closest('[data-block-id]') === el && !el.matches('.ink-b-callout, .ink-b-code, .ink-b-quote')) {
    const row = ed.closest('.ink-row');
    const base = row ? row.getBoundingClientRect().left : ed.getBoundingClientRect().left;
    return base + (row ? 2 : 2);
  }
  return el.getBoundingClientRect().left + 8;
}

let dragging = false;
function BlockHandles({ pageId, pageRef }: { pageId: string; pageRef: React.RefObject<HTMLDivElement | null> }) {
  const [h, setH] = useState<{ id: string; x: number; y: number } | null>(null);
  const handle = useRef<HTMLDivElement>(null);
  const hideT = useRef(0);
  useEffect(() => {
    const page = pageRef.current; if (!page) return;
    const onMove = (e: MouseEvent) => {
      if (dragging) return;
      const tgt = e.target as HTMLElement;
      if (tgt.closest('.ink-handles')) { window.clearTimeout(hideT.current); return; }
      let el = hoveredBlock(tgt);
      if (!el) {
        // pointer in the left gutter: pick block at this y
        const blocks = [...page.querySelectorAll<HTMLElement>('.ink-page-blocks [data-block-id]')].filter((b) => !HANDLE_SKIP.has(b.dataset.type || ''));
        const hit = blocks.filter((b) => { const r = b.getBoundingClientRect(); return e.clientY >= r.top && e.clientY < r.bottom && e.clientX < r.left && e.clientX > r.left - 80; });
        el = hit[hit.length - 1] || null;
      }
      if (!el) { window.clearTimeout(hideT.current); hideT.current = window.setTimeout(() => setH(null), 120); return; }
      window.clearTimeout(hideT.current);
      const pr = page.getBoundingClientRect(); const r = el.getBoundingClientRect();
      const x = textLeft(el) - pr.left; const y = r.top - pr.top + handleTop(el);
      setH((o) => (o && o.id === el!.dataset.blockId && o.x === x && o.y === y ? o : { id: el!.dataset.blockId!, x, y }));
    };
    const onLeave = () => { hideT.current = window.setTimeout(() => setH(null), 200); };
    page.addEventListener('mousemove', onMove); page.addEventListener('mouseleave', onLeave);
    const onKey = () => setH(null);
    page.addEventListener('keydown', onKey);
    return () => { page.removeEventListener('mousemove', onMove); page.removeEventListener('mouseleave', onLeave); page.removeEventListener('keydown', onKey); };
  }, [pageId]);

  useEffect(() => {
    const el = handle.current; if (!el || !h) return;
    return draggable({
      element: el,
      getInitialData: () => { const sel = getBlockSelection(); const ids = sel.includes(h.id) ? sel : [h.id]; return { kind: 'ink-blocks', ids }; },
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          render: ({ container }) => {
            const sel = getBlockSelection(); const ids = sel.includes(h.id) ? sel : [h.id];
            const wrap = document.createElement('div'); wrap.className = 'ink-drag-preview';
            for (const id of ids.slice(0, 6)) { const src = document.querySelector(`.ink-page [data-block-id="${id}"]`); if (src) wrap.appendChild(src.cloneNode(true)); }
            container.appendChild(wrap);
          },
          getOffset: () => ({ x: 12, y: 12 }),
        });
      },
      onDragStart: () => { dragging = true; document.body.classList.add('is-dragging-blocks'); const sel = getBlockSelection(); if (!sel.includes(h.id)) setBlockSelection([h.id]); },
      onDrop: () => { dragging = false; document.body.classList.remove('is-dragging-blocks'); setH(null); },
    });
  }, [h?.id]);

  if (!h) return null;
  const onPlus = (e: React.MouseEvent) => {
    const b = store.get(h.id); if (!b) return;
    let id: string;
    const empty = b.type === 'text' && !rtPlain(b.title).length;
    if (empty && !e.altKey) id = b.id;
    else if (e.altKey) {
      id = newId();
      const p = store.get(b.parent)!; const at = (p.content || []).indexOf(b.id);
      store.transact('insert', (tx) => { tx.create({ id, type: 'text', title: [], parent: p.id, parentTable: 'block', content: [] }); tx.insertChild(p.id, id, at); });
    } else id = insertAfter(b.id, 'text', { focus: false });
    setTitle(id, [['/']], false);
    focusBlock(id, 1);
    requestAnimationFrame(() => requestAnimationFrame(() => openInlineMenu('slash', id, 0, '/')));
  };
  return (
    <div className="ink-handles" style={{ left: h.x, top: h.y }} contentEditable={false}>
      <div role="button" className="ink-plus" aria-label="add" onMouseDown={(e) => e.preventDefault()} onClick={onPlus} {...tip(<><b>{t('ed.plus.click')}</b><br />{t('ed.plus.alt')}</>, undefined, 'bottom')}>
        <Icon name="plus" size={16} stroke={1.8} />
      </div>
      <div role="button" ref={handle} className="ink-block-handle" aria-label="drag" onMouseDown={(e) => { if (!getBlockSelection().includes(h.id)) { (document.activeElement as HTMLElement)?.blur?.(); } void e; }}
        onClick={(e) => { const sel = getBlockSelection(); const ids = sel.includes(h.id) ? sel : [h.id]; openBlockMenuFor(ids, (e.currentTarget as HTMLElement), { placement: 'left-center' }); }}
        {...tip(<><b>{t('ed.handle.drag')}</b><br />{t('ed.handle.click')}</>, undefined, 'bottom')}>
        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden>{[2, 7, 12].flatMap((y) => [2.5, 7.5].map((x) => <circle key={x + '-' + y} cx={x} cy={y + 0.5} r="1.35" fill="currentColor" />))}</svg>
      </div>
    </div>
  );
}

/* ================= drop indicator ================= */
interface DropState { id: string; edge: 'top' | 'bottom' | 'left' | 'right'; x: number; y: number; w: number; h: number }
function DropIndicator({ pageRef, pageId }: { pageRef: React.RefObject<HTMLDivElement | null>; pageId: string }) {
  const [d, setD] = useState<DropState | null>(null);
  const cur = useRef<DropState | null>(null);
  useEffect(() => {
    const page = pageRef.current; if (!page) return;
    const compute = (x: number, y: number, ids: string[]): DropState | null => {
      const pr = page.getBoundingClientRect();
      const blocks = [...page.querySelectorAll<HTMLElement>('.ink-page-blocks [data-block-id]')].filter((b) => !HANDLE_SKIP.has(b.dataset.type || '') && !ids.some((id) => b.closest(`[data-block-id="${id}"]`)));
      // innermost block whose vertical span contains y (and x within column bounds)
      let best: HTMLElement | null = null;
      for (const b of blocks) {
        const r = b.getBoundingClientRect();
        if (y >= r.top && y < r.bottom) {
          const col = b.closest<HTMLElement>('.ink-column'); if (col) { const cr = col.getBoundingClientRect(); if (x < cr.left - 23 || x > cr.right + 23) continue; }
          best = b;
        }
      }
      if (!best) {
        const top = blocks.filter((b) => b.parentElement?.classList.contains('ink-page-blocks'));
        if (!top.length) return null;
        best = y < top[0].getBoundingClientRect().top ? top[0] : top[top.length - 1];
      }
      const r = best.getBoundingClientRect();
      const content = page.querySelector('.ink-page-blocks')!.getBoundingClientRect();
      if (x < content.left - 8 && x > content.left - 80 && best.parentElement?.closest('.ink-page-blocks') && !best.closest('.ink-column')) return { id: best.dataset.blockId!, edge: 'left', x: r.left - pr.left, y: r.top - pr.top, w: 4, h: r.height };
      if (x > content.right + 8 && !best.closest('.ink-column')) return { id: best.dataset.blockId!, edge: 'right', x: r.right - pr.left - 4, y: r.top - pr.top, w: 4, h: r.height };
      const edge = y < r.top + r.height / 2 ? 'top' : 'bottom';
      const tl = textLeft(best) - pr.left - 2;
      return { id: best.dataset.blockId!, edge, x: tl, y: (edge === 'top' ? r.top : r.bottom) - pr.top - 2, w: r.right - pr.left - tl - 6, h: 4 };
    };
    const off1 = dropTargetForElements({ element: page, canDrop: ({ source }) => source.data.kind === 'ink-blocks', getData: () => ({ page: pageId }) });
    const off2 = monitorForElements({
      canMonitor: ({ source }) => source.data.kind === 'ink-blocks',
      onDrag: ({ location, source }) => { const { clientX, clientY } = location.current.input; const s = compute(clientX, clientY, source.data.ids as string[]); cur.current = s; setD(s); },
      onDrop: ({ source }) => {
        const s = cur.current; cur.current = null; setD(null);
        if (!s) return;
        const ids = source.data.ids as string[];
        moveBlocks(ids, s.id, s.edge);
        setBlockSelection(ids.filter((id) => store.get(id)?.alive));
      },
    });
    return () => { off1(); off2(); };
  }, [pageId]);
  if (!d) return null;
  return <div className="ink-drop-line" style={{ left: d.x, top: d.y, width: d.w, height: d.h }} />;
}

/* ================= rubber band ================= */
let band: { x0: number; y0: number; x: number; y: number; on: boolean } | null = null;
const bandSubs = new Set<() => void>();
function RubberBand() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); bandSubs.add(f); return () => { bandSubs.delete(f); }; }, []);
  if (!band?.on) return null;
  const l = Math.min(band.x0, band.x), t0 = Math.min(band.y0, band.y);
  return <div className="ink-rubber" style={{ left: l, top: t0, width: Math.abs(band.x - band.x0), height: Math.abs(band.y - band.y0) }} />;
}
function rubberBandStart(e: React.MouseEvent, pageId: string, scroller: HTMLElement) {
  if (e.button !== 0) return;
  const tgt = e.target as HTMLElement;
  if (tgt.closest('[contenteditable="true"], button, [role="button"], [role="link"], a, input, textarea, .ink-handles, .ink-cover, .ink-outline, .ink-table-wrap')) {
    if (!tgt.closest('.ink-handles') && getBlockSelection().length && tgt.closest('[contenteditable="true"]')) clearBlockSelection();
    return;
  }
  e.preventDefault();
  hideToolbar();
  (document.activeElement as HTMLElement | null)?.blur?.();
  const sr = scroller.getBoundingClientRect();
  const sx = e.clientX - sr.left, sy = e.clientY - sr.top + scroller.scrollTop;
  band = { x0: sx, y0: sy, x: sx, y: sy, on: false };
  const additive = e.shiftKey || e.metaKey;
  const base = additive ? getBlockSelection() : [];
  if (!additive) clearBlockSelection();
  const mv = (ev: MouseEvent) => {
    if (!band) return;
    band.x = ev.clientX - sr.left; band.y = ev.clientY - sr.top + scroller.scrollTop;
    if (!band.on && Math.hypot(band.x - band.x0, band.y - band.y0) > 4) band.on = true;
    if (band.on) {
      const L = Math.min(band.x0, band.x) + sr.left, R = Math.max(band.x0, band.x) + sr.left;
      const T = Math.min(band.y0, band.y) - scroller.scrollTop + sr.top, B = Math.max(band.y0, band.y) - scroller.scrollTop + sr.top;
      const ids: string[] = [];
      for (const b of selectableBlocks(pageId)) {
        const el = scroller.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`); if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > T && r.top < B && r.right > L && r.left < R) ids.push(b.id);
      }
      // only keep outermost
      const keep = ids.filter((id) => !store.ancestors(id).some((a) => ids.includes(a.id)));
      setBlockSelection([...new Set([...base, ...keep])]);
      // autoscroll
      if (ev.clientY > sr.bottom - 30) scroller.scrollTop += 12; else if (ev.clientY < sr.top + 30) scroller.scrollTop -= 12;
    }
    bandSubs.forEach((f) => f());
  };
  const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); const was = band?.on; band = null; bandSubs.forEach((f) => f()); if (!was && !additive) { /* plain click on margin */ } };
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
}

/* ================= keyboard on block selection ================= */
function selectionKeys(e: KeyboardEvent, pageId: string) {
  const ids = getBlockSelection(); if (!ids.length) return;
  const order = selectableBlocks(pageId).filter((b) => !store.ancestors(b.id).some((a) => a.type === 'column_list' && false));
  const k = e.key;
  if (mod(e) && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod(e) && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod(e) && k.toLowerCase() === 'a') { e.preventDefault(); setBlockSelection(store.children(pageId).filter((b) => b.alive).map((b) => b.id)); return; }
  if (mod(e) && k.toLowerCase() === 'd') { e.preventDefault(); setBlockSelection(duplicateBlocks(ids)); return; }
  if (mod(e) && k === '/') { e.preventDefault(); const el = document.querySelector<HTMLElement>(`.ink-page [data-block-id="${ids[0]}"]`); if (el) openBlockMenuFor(ids, el.getBoundingClientRect()); return; }
  if (k === 'Backspace' || k === 'Delete') {
    e.preventDefault();
    const first = order.findIndex((b) => b.id === ids[0]);
    deleteBlocks(ids);
    const prev = order.slice(0, Math.max(0, first)).reverse().find((b) => store.get(b.id)?.alive);
    if (prev) setBlockSelection([prev.id]); else clearBlockSelection();
    return;
  }
  if (k === 'Escape') { e.preventDefault(); clearBlockSelection(); return; }
  if (k === 'Enter') { e.preventDefault(); const last = ids[ids.length - 1]; if (document.querySelector(`[data-editable-id="${last}"]`)) focusBlock(last, 'end'); return; }
  if (k === 'Tab') { e.preventDefault(); e.shiftKey ? outdent(ids) : indent(ids); setBlockSelection(ids); return; }
  if ((k === 'ArrowUp' || k === 'ArrowDown') && mod(e) && e.shiftKey) {
    e.preventDefault();
    const b = store.get(k === 'ArrowUp' ? ids[0] : ids[ids.length - 1])!;
    const sib = k === 'ArrowUp' ? prevSibling(b) : nextSibling(b);
    if (sib) { moveBlocks(ids, sib.id, k === 'ArrowUp' ? 'top' : 'bottom'); setBlockSelection(ids); }
    return;
  }
  if (k === 'ArrowUp' || k === 'ArrowDown') {
    e.preventDefault();
    const idx = order.map((b) => b.id);
    const first = idx.indexOf(ids[0]); const last = idx.indexOf(ids[ids.length - 1]);
    if (e.shiftKey) {
      const n = k === 'ArrowUp' ? idx[first - 1] : idx[last + 1];
      if (n) setBlockSelection(k === 'ArrowUp' ? [n, ...ids] : [...ids, n], ids[0]);
    } else {
      const n = k === 'ArrowUp' ? idx[Math.max(0, first - 1)] : idx[Math.min(idx.length - 1, last + 1)];
      if (n) { setBlockSelection([n]); document.querySelector(`.ink-page [data-block-id="${n}"]`)?.scrollIntoView({ block: 'nearest' }); }
    }
  }
}

// keep subscription alive for selection-driven focus
onBlockSelection(() => {});
