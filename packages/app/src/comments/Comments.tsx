/** Comment UI: composer, thread, inline-thread popovers, page-level discussions and the comments sidebar. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { RichText } from '../store/model';
import { useStoreVersion } from '../hooks/useStore';
import { Icon } from '../ui/icons';
import { openPopover, closePopover, tip } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { Avatar } from '../db/cells';
import { relTime } from '../shell/Search';
import { rtPlain } from '../editor/richtext';
import { getUi, setUi, useUi } from '../app/state';
import { startInline, startPageComment, reply, setResolved, deleteComment, deleteDiscussion, editComment, discussionsOf, pageDiscussions, findDiscussion, type Comment, type Discussion, type DiscRef } from './model';

const plainRt = (s: string): RichText => (s.trim() ? [[s.trim()]] : []);

/** Avatar + growing text field + send button. Enter sends, Shift+Enter breaks, Esc cancels. */
export function Composer({ placeholder, autoFocus, initial = '', onSubmit, onCancel, compact }: { placeholder?: string; autoFocus?: boolean; initial?: string; onSubmit: (rt: RichText) => void; onCancel?: () => void; compact?: boolean }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 0); }, [autoFocus]);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = '0px'; el.style.height = el.scrollHeight + 'px'; } }, [v]);
  const send = () => { const rt = plainRt(v); if (!rtPlain(rt)) return; onSubmit(rt); setV(''); };
  return (
    <div className={'ink-cm-composer' + (compact ? ' is-compact' : '')}>
      <Avatar userId={store.currentUser} size={24} />
      <textarea ref={ref} rows={1} className="ink-cm-input" placeholder={placeholder || t('cm.add')} value={v} data-autofocus={autoFocus ? '' : undefined}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          else if (e.key === 'Escape' && onCancel) { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }} />
      <span className="ink-cm-tools">
        <span className="ink-cm-tool" role="button" {...tip(t('cm.attach'))}><Icon name="paperclip" size={16} /></span>
        <span className="ink-cm-tool" role="button" {...tip(t('cm.mention'))} onClick={() => { setV((x) => x + '@'); ref.current?.focus(); }}><Icon name="at" size={16} /></span>
        <span className={'ink-cm-send' + (v.trim() ? ' is-ready' : '')} role="button" aria-label={t('cm.send')} onMouseDown={(e) => e.preventDefault()} onClick={send}><Icon name="arrowUp" size={14} stroke={2.4} /></span>
      </span>
    </div>
  );
}

function CommentRow({ r, c, first }: { r: DiscRef; c: Comment; first: boolean }) {
  const [editing, setEditing] = useState(false);
  const u = store.users.get(c.user);
  const more = (el: HTMLElement) => openMenu(el.getBoundingClientRect(), { width: 200, groups: [[
    { id: 'cm-edit', label: t('cm.edit'), icon: 'pencil', onSelect: () => setEditing(true) },
    { id: 'cm-copy', label: t('cm.copyText'), icon: 'copy', onSelect: () => { navigator.clipboard?.writeText(rtPlain(c.rt)).catch(() => {}); } },
    { id: 'cm-delete', label: first && r.d.comments.length === 1 ? t('cm.deleteThread') : t('cm.delete'), icon: 'trash', danger: true, onSelect: () => deleteComment(r.blockId, r.d.id, c.id) },
  ]] }, { placement: 'bottom-end', anchorEl: el });
  return (
    <div className="ink-cm-item" data-comment-id={c.id}>
      <div className="ink-cm-head">
        <Avatar userId={c.user} size={24} />
        <span className="ink-cm-name">{u?.name || '?'}</span>
        <span className="ink-cm-time">{relTime(c.ts)}{c.edited ? ' · ' + t('cm.edited') : ''}</span>
        <span className="ink-cm-actions">
          {first && <span className="ink-cm-act" role="button" aria-label={r.d.resolved ? t('cm.reopen') : t('cm.resolve')} {...tip(r.d.resolved ? t('cm.reopen') : t('cm.resolve'))} onClick={() => setResolved(r.blockId, r.d.id, !r.d.resolved)}><Icon name={r.d.resolved ? 'rotateCcw' : 'circleCheck'} size={16} /></span>}
          <span className="ink-cm-act" role="button" aria-label={t('cm.more')} onClick={(e) => more(e.currentTarget)}><Icon name="more" size={16} /></span>
        </span>
      </div>
      {editing
        ? <div className="ink-cm-edit"><Composer compact autoFocus initial={rtPlain(c.rt)} onSubmit={(rt) => { editComment(r.blockId, r.d.id, c.id, rt); setEditing(false); }} onCancel={() => setEditing(false)} /></div>
        : <div className="ink-cm-body">{rtPlain(c.rt)}</div>}
    </div>
  );
}

/** One discussion: optional quote, comments, reply box. */
export function Thread({ did, showQuote, onEmpty }: { did: string; showQuote?: boolean; onEmpty?: () => void }) {
  useStoreVersion();
  const r = findDiscussion(did);
  useEffect(() => { if (!r) onEmpty?.(); });
  if (!r) return null;
  return (
    <div className={'ink-cm-thread' + (r.d.resolved ? ' is-resolved' : '')} data-discussion-id={did}>
      {showQuote && r.d.quote && <div className="ink-cm-quote">{r.d.quote}</div>}
      {r.d.comments.map((c, i) => <CommentRow key={c.id} r={r} c={c} first={i === 0} />)}
      <Composer compact placeholder={t('cm.reply')} onSubmit={(rt) => reply(r.blockId, did, rt)} />
    </div>
  );
}

const anchorOf = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };

/** Open the thread popover for an inline highlight. */
export function openThreadPopover(did: string, anchorEl: Element) {
  const id = 'cm-thread';
  openPopover({ id, anchor: anchorOf(anchorEl), placement: 'bottom-start', offset: 6, className: 'ink-cm-pop',
    render: (close) => <div className="ink-menu ink-cm-card" style={{ width: 450 }}><Thread did={did} onEmpty={close} /></div> });
}

/** New inline comment on a text range: composer popover; the thread exists only once something is sent. */
export function openNewInlineComment(blockId: string, start: number, end: number, rect: { left: number; right: number; top: number; bottom: number }) {
  openPopover({ id: 'cm-new', anchor: rect, placement: 'bottom-start', offset: 6, className: 'ink-cm-pop',
    render: (close) => <div className="ink-menu ink-cm-card" style={{ width: 450 }}><Composer autoFocus onCancel={close} onSubmit={(rt) => { startInline(blockId, start, end, rt); close(); }} /></div> });
}

/** Comment on a selection inside an editable (toolbar button, ⌘⇧M). */
export function commentOnSelection(blockId: string, start: number, end: number) {
  const sel = getSelection(); let rect = { left: 0, right: 0, top: 0, bottom: 0 };
  if (sel && sel.rangeCount) { const rs = sel.getRangeAt(0).getClientRects(); const last = rs[rs.length - 1] || sel.getRangeAt(0).getBoundingClientRect(); rect = { left: (rs[0] || last).left, right: last.right, top: last.top, bottom: last.bottom }; }
  else { const el = document.querySelector(`[data-editable-id="${blockId}"]`); if (el) rect = anchorOf(el); }
  openNewInlineComment(blockId, start, end, rect);
}

// clicking highlighted text opens its thread
document.addEventListener('click', (e) => {
  const span = (e.target as HTMLElement).closest?.('.ink-cm') as HTMLElement | null; if (!span) return;
  const sel = getSelection(); if (sel && !sel.isCollapsed) return;
  let did: string | undefined; try { did = JSON.parse(span.dataset.m || '{}').cm; } catch { /* ignore */ }
  if (did) openThreadPopover(did, span);
});

/** Page-level discussions under the title (and under a row's properties). */
export function PageComments({ pageId, always }: { pageId: string; always?: boolean }) {
  useStoreVersion();
  const composing = useUi((s) => s.commentComposer === pageId);
  const [showResolved, setShowResolved] = useState(false);
  const all = discussionsOf(store.get(pageId));
  const open = all.filter((d) => !d.resolved), resolved = all.filter((d) => d.resolved);
  if (!always && !open.length && !composing && !resolved.length) return null;
  return (
    <div className={'ink-page-comments' + (always ? ' is-row' : '')}>
      {resolved.length > 0 && <div className="ink-pc-resolved-toggle" role="button" onClick={() => setShowResolved((x) => !x)}>{showResolved ? t('cm.hideResolved') : t('cm.showResolved', { n: resolved.length })}</div>}
      {(showResolved ? [...resolved, ...open] : open).map((d) => <div key={d.id} className="ink-pc-thread"><Thread did={d.id} /></div>)}
      <div className="ink-pc-new"><Composer autoFocus={composing} onCancel={() => setUi({ commentComposer: null })} onSubmit={(rt) => { startPageComment(pageId, rt); setUi({ commentComposer: null }); }} /></div>
    </div>
  );
}
export function addPageComment(pageId: string) {
  setUi({ commentComposer: pageId });
  setTimeout(() => (document.querySelector('.ink-page-comments .ink-pc-new textarea') as HTMLTextAreaElement | null)?.focus(), 30);
}

/* ---------------- comments sidebar ---------------- */
export function CommentsPanelBody({ pageId }: { pageId: string }) {
  useStoreVersion();
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const list = pageDiscussions(pageId).filter((r) => (filter === 'open' ? !r.d.resolved : r.d.resolved));
  const jump = (r: DiscRef) => {
    const el = r.blockId === pageId ? document.querySelector('.ink-page-comments') : document.querySelector(`[data-block-id="${r.blockId}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const hl = document.querySelector(`[data-editable-id="${r.blockId}"] .ink-cm`);
    if (hl) { hl.classList.add('is-active'); setTimeout(() => hl.classList.remove('is-active'), 1200); }
  };
  return (
    <div className="ink-rp-comments">
      <div className="ink-rp-filter">
        <span className="ink-rp-chip" role="button" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 180, groups: [[
          { id: 'f-open', label: t('cm.filterOpen'), checked: filter === 'open', onSelect: () => setFilter('open') },
          { id: 'f-resolved', label: t('cm.filterResolved'), checked: filter === 'resolved', onSelect: () => setFilter('resolved') },
        ]] }, { placement: 'bottom-start' })}>{filter === 'open' ? t('cm.filterOpen') : t('cm.filterResolved')}<Icon name="chevronDown" size={12} stroke={2} /></span>
      </div>
      {list.length === 0 && <Empty icon="comment" title={filter === 'open' ? t('cm.emptyOpen') : t('cm.emptyResolved')} hint={filter === 'open' ? t('cm.emptyHint') : ''} />}
      {list.map((r) => <div key={r.d.id} className="ink-rp-thread" onClick={(e) => { if (!(e.target as HTMLElement).closest('textarea, [role="button"]')) jump(r); }}><Thread did={r.d.id} showQuote /></div>)}
    </div>
  );
}
function Empty({ icon, title, hint }: { icon: 'comment' | 'clock'; title: string; hint?: string }) {
  return <div className="ink-rp-empty"><Icon name={icon} size={32} stroke={1.4} /><div className="ink-rp-empty-title">{title}</div>{hint && <div className="ink-rp-empty-hint">{hint}</div>}</div>;
}
export { Empty as PanelEmpty };
export type { Discussion, ReactNode };
export const closeCommentPopovers = () => { closePopover('cm-thread'); closePopover('cm-new'); };
export const pageHasComments = (pageId: string) => pageDiscussions(pageId).some((r) => !r.d.resolved);
export const toggleRightPanel = (p: 'comments' | 'updates') => setUi({ rightPanel: getUi().rightPanel === p ? null : p });
