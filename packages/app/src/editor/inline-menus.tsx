import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { RichText } from '../store/model';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openPopover, closePopover } from '../ui/overlay';
import { caretRect } from './caret';
import { BLOCK_KINDS, SLASH_SECTIONS, kind, matches, type BlockKind } from './catalog';
import { deleteRange, insertText, rtPlain, concat, slice } from './richtext';
import { focusBlock } from './registry';
import { applyKind } from './apply-kind';
import { setTitle } from './commands';
import { openEmojiPicker } from './emoji-picker';
import { EMOJI, searchEmoji, type EmojiEntry, recentEmoji, pushRecentEmoji } from './emoji-data';
import { pageTitle, breadcrumbPath, isInTrash, createPage } from '../app/pages';

export type InlineKind = 'slash' | 'mention' | 'emoji';
interface Session { kind: InlineKind; blockId: string; start: number; query: string; anchor: DOMRect; trigger: string }
let session: Session | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let keyHandler: ((e: KeyboardEvent) => boolean) | null = null;

export function isInlineMenuOpen() { return !!session; }
export function inlineMenuKey(e: KeyboardEvent): boolean { return keyHandler ? keyHandler(e) : false; }
export function getSession() { return session; }

export function openInlineMenu(kind: InlineKind, blockId: string, start: number, trigger: string) {
  const r = caretRect();
  const anchor = r ? new DOMRect(r.left, r.top, r.width, r.height) : new DOMRect(0, 0, 0, 0);
  session = { kind, blockId, start, query: '', anchor, trigger };
  const blockEl = document.querySelector(`[data-editable-id="${blockId}"]`);
  const lineBottom = blockEl ? Math.max(anchor.bottom, Math.min(blockEl.getBoundingClientRect().bottom, anchor.bottom + 4)) : anchor.bottom;
  openPopover({
    id: 'inline-menu', noFocus: true, placement: 'bottom-start', offset: 0,
    anchor: { left: anchor.left - (kind === 'slash' ? 12 : 6.5), right: anchor.left, top: anchor.top - 4, bottom: lineBottom + (kind === 'slash' ? 7 : 4) },
    onClose: () => { session = null; keyHandler = null; emit(); markSlash(null); },
    render: (close) => <InlineHost close={close} />,
  });
  if (kind === 'slash') markSlash(blockId);
  emit();
}
export function closeInlineMenu() { if (session) closePopover('inline-menu'); }

/** typed text changed: update query or close */
export function updateInlineQuery(blockId: string, caret: number, text: string) {
  if (!session || session.blockId !== blockId) return;
  if (caret <= session.start || text[session.start] !== session.trigger) { closeInlineMenu(); return; }
  const q = text.slice(session.start + 1, caret);
  if (q.includes('\n') || q.length > 40 || (session.kind !== 'slash' && /\s{2}/.test(q))) { closeInlineMenu(); return; }
  session = { ...session, query: q };
  markSlash(q ? null : blockId);
  emit();
}

/** visual chip "/输入以搜索" while the slash query is empty */
function markSlash(blockId: string | null) {
  document.querySelectorAll('[data-placeholder-chip]').forEach((n) => n.remove());
  document.querySelectorAll('.ink-slash-active').forEach((n) => n.classList.remove('ink-slash-active'));
  if (!blockId || !session) return;
  const el = document.querySelector<HTMLElement>(`[data-editable-id="${blockId}"]`); if (!el) return;
  el.classList.add('ink-slash-active');
  const sel = getSelection(); if (!sel?.rangeCount) return;
  const chip = document.createElement('span');
  chip.dataset.placeholder = ''; chip.dataset.placeholderChip = '';
  chip.className = 'ink-slash-ph'; chip.contentEditable = 'false';
  chip.textContent = t('slash.inlinePlaceholder');
  const r = sel.getRangeAt(0).cloneRange(); r.collapse(true); r.insertNode(chip);
  // keep caret before chip
  const r2 = document.createRange(); r2.setStartBefore(chip); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2);
}

function useSession() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => session); }

/** remove the trigger + query from the block, returning the cleaned title and offset */
function consumeTrigger(): { blockId: string; title: RichText; at: number } | null {
  if (!session) return null;
  const b = store.get(session.blockId); if (!b) return null;
  const end = session.start + 1 + session.query.length;
  const title = deleteRange(b.title || [], session.start, end);
  return { blockId: b.id, title, at: session.start };
}

function InlineHost({ close }: { close: () => void }) {
  const s = useSession();
  if (!s) return null;
  if (s.kind === 'slash') return <SlashMenu s={s} close={close} />;
  if (s.kind === 'mention') return <MentionMenu s={s} close={close} />;
  return <EmojiInline s={s} close={close} />;
}

/* ---------------- slash ---------------- */
function SlashMenu({ s, close }: { s: Session; close: () => void }) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const misses = useRef(0);
  const sections = useMemo(() => {
    if (!s.query) return SLASH_SECTIONS.map((sec) => ({ id: sec.id, label: sec.label(), items: sec.items.map(kind) }));
    const scored = BLOCK_KINDS.map((k) => ({ k, sc: matches(k, s.query) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
    return [{ id: 'filtered', label: t('slash.filtered'), items: scored.map((x) => x.k) }];
  }, [s.query]);
  const flat = sections.flatMap((sec) => sec.items.map((k) => ({ k, sec: sec.id })));
  useEffect(() => { setActive(0); if (!flat.length) { misses.current++; if (misses.current > 2 && s.query.length > 3) close(); } else misses.current = 0; }, [s.query]);
  useEffect(() => { listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const choose = (k: BlockKind) => {
    const c = consumeTrigger(); close();
    if (!c) return;
    applyKind(c.blockId, k, c.title, c.at);
  };
  keyHandler = (e) => {
    if (e.key === 'ArrowDown') { setActive((a) => (a + 1) % Math.max(1, flat.length)); return true; }
    if (e.key === 'ArrowUp') { setActive((a) => (a - 1 + flat.length) % Math.max(1, flat.length)); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { const it = flat[active]; if (it) { choose(it.k); return true; } close(); return false; }
    if (e.key === 'Escape') { close(); return true; }
    return false;
  };
  let idx = -1;
  return (
    <div className="ink-slash" role="dialog">
      <div className="ink-slash-scroll" ref={listRef}>
        <div className="ink-slash-inner" role="listbox">
          {sections.map((sec, si) => (
            <div key={sec.id + si} className="ink-slash-section">
              {si > 0 && <div className="ink-slash-sep" />}
              <div className="ink-slash-label">{sec.label}</div>
              {sec.items.map((k) => {
                idx++; const my = idx;
                return (
                  <div key={sec.id + k.id} role="option" className={'ink-slash-item' + (my === active ? ' is-active' : '')} onMouseMove={() => setActive(my)} onMouseDown={(e) => { e.preventDefault(); choose(k); }}>
                    <span className="ink-slash-icon"><Icon name={k.icon} size={20} stroke={1.5} /></span>
                    <span className="ink-slash-text">{k.label()}{k.sub && <span className="ink-slash-sub"> · {k.sub()}</span>}{k.badge && <span className="ink-badge-new">{k.badge()}</span>}</span>
                    {k.hint && <span className="ink-slash-hint">{k.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {!flat.length && <div className="ink-slash-empty">{t('slash.noResults')}</div>}
        </div>
      </div>
      <div className="ink-slash-footer"><div className="ink-slash-footer-row" onMouseDown={(e) => { e.preventDefault(); close(); }}><span>{t('slash.close')}</span><span className="ink-slash-hint">esc</span></div></div>
    </div>
  );
}

/* ---------------- @ mention ---------------- */
function allPageIds(): string[] {
  const out: string[] = [];
  for (const b of store.blocks.values()) if (b.alive && b.type === 'page' && !isInTrash(b.id) && !b.parent.startsWith('page-db')) out.push(b.id);
  return out;
}
function MentionMenu({ s, close }: { s: Session; close: () => void }) {
  const [active, setActive] = useState(0);
  const q = s.query.toLowerCase();
  const u = store.users.get(store.currentUser)!;
  type Row = { id: string; label: string; sub?: string; inlineSub?: string; icon: React.ReactNode; run: () => void; section: string };
  const insertToken = (seg: RichText) => {
    const c = consumeTrigger(); close(); if (!c) return;
    const title = concat(slice(c.title, 0, c.at), seg, [[' ']], slice(c.title, c.at));
    setTitle(c.blockId, title, false);
    focusBlock(c.blockId, c.at + 2);
  };
  const today = new Date(); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today.getTime() + 86400000);
  const rows: Row[] = [];
  const dateRows: Row[] = [
    { id: 'today', label: t('mention.today'), icon: <Icon name="clock" size={20} />, section: t('mention.date'), run: () => insertToken([['‣', { mention: { kind: 'date', value: iso(today) } }]]) },
    { id: 'remind', label: t('mention.remind'), inlineSub: t('mention.remindSub'), icon: <Icon name="alarm" size={20} />, section: t('mention.date'), run: () => insertToken([['‣', { mention: { kind: 'date', value: iso(tomorrow) } }]]) },
  ];
  rows.push(...dateRows.filter((r) => !q || r.label.toLowerCase().includes(q) || 'today tomorrow remind date'.includes(q)));
  if (q && (u.name.toLowerCase().includes(q) || 'person people user'.includes(q))) rows.push({ id: 'me', label: u.name, icon: <span className="ink-avatar" style={{ width: 20, height: 20, fontSize: 8.5 }}>{u.avatar}</span>, section: t('mention.people'), run: () => insertToken([['‣', { mention: { kind: 'user', id: u.id } }]]) });
  rows.push({ id: 'invite', label: t('mention.invite'), icon: <Icon name="addUser" size={20} />, section: t('mention.people'), run: () => close() });
  const here = store.pageOf(s.blockId)?.id;
  const pathSub = (id: string) => { const path = breadcrumbPath(id).slice(0, -1); return (path.length > 2 ? `${pageTitle(path[0])} / … / ${pageTitle(path[path.length - 1])}` : path.map((p) => pageTitle(p)).join(' / ')) || undefined; };
  const pages = allPageIds().filter((id) => id !== here && (!q || pageTitle(store.get(id)).toLowerCase().includes(q))).slice(0, 8);
  for (const id of pages) rows.push({ id, label: pageTitle(store.get(id)), sub: pathSub(id), icon: <PageIcon block={store.get(id)} size={20} />, section: t('mention.pages'), run: () => insertToken([['‣', { mention: { kind: 'page', id } }]]) });
  if (q) rows.push({ id: 'new', label: t('mention.newPage', { q: s.query }), icon: <Icon name="plus" size={20} />, section: t('mention.pages'), run: () => { const c = consumeTrigger(); close(); if (!c) return; const page = store.pageOf(c.blockId)!; const nid = createPage(page.id, { open: false, title: s.query }); const title = concat(slice(c.title, 0, c.at), [['‣', { mention: { kind: 'page', id: nid } }], [' ']], slice(c.title, c.at)); setTitle(c.blockId, title, false); focusBlock(c.blockId, c.at + 2); } });
  useEffect(() => setActive(0), [s.query]);
  keyHandler = (e) => {
    if (e.key === 'ArrowDown') { setActive((a) => (a + 1) % rows.length); return true; }
    if (e.key === 'ArrowUp') { setActive((a) => (a - 1 + rows.length) % rows.length); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { rows[active]?.run(); return true; }
    if (e.key === 'Escape') { close(); return true; }
    return false;
  };
  const sections = [...new Set(rows.map((r) => r.section))];
  return (
    <div className="ink-menu ink-mention-menu" style={{ width: 330 }}>
      <div className="ink-menu-body" style={{ maxHeight: 360 }}>
        {sections.map((sec, si) => (
          <div key={sec} className="ink-mention-sec">
            {si > 0 && <div className="ink-menu-divider" />}
            <div className="ink-menu-group">
              <div className="ink-menu-label">{sec}</div>
              {rows.map((r, i) => r.section !== sec ? null : (
                <div key={r.id} className={'ink-menu-item ink-mention-item' + (i === active ? ' is-active' : '') + (r.sub ? ' has-sub' : '')} onMouseMove={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); r.run(); }}>
                  <span className="ink-menu-icon">{r.icon}</span>
                  <span className="ink-mention-lines"><span className="ink-mention-label">{r.label}{r.inlineSub && <span className="ink-mention-inline-sub"> — {r.inlineSub}</span>}</span>{r.sub && <span className="ink-mention-sub">{r.sub}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- :emoji ---------------- */
function EmojiInline({ s, close }: { s: Session; close: () => void }) {
  const [active, setActive] = useState(0);
  const list: EmojiEntry[] = s.query ? searchEmoji(s.query).slice(0, 35) : [...recentEmoji(), ...EMOJI].slice(0, 35);
  useEffect(() => setActive(0), [s.query]);
  const pick = (e: EmojiEntry) => {
    const c = consumeTrigger(); close(); if (!c) return;
    pushRecentEmoji(e.char);
    setTitle(c.blockId, insertText(c.title, c.at, e.char), false);
    focusBlock(c.blockId, c.at + e.char.length);
  };
  keyHandler = (e) => {
    const cols = 12;
    if (!list.length) { if (e.key === 'Escape') { close(); return true; } return false; }
    if (e.key === 'ArrowRight') { setActive((a) => Math.min(list.length - 1, a + 1)); return true; }
    if (e.key === 'ArrowLeft') { setActive((a) => Math.max(0, a - 1)); return true; }
    if (e.key === 'ArrowDown') { setActive((a) => Math.min(list.length - 1, a + cols)); return true; }
    if (e.key === 'ArrowUp') { setActive((a) => Math.max(0, a - cols)); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { pick(list[active]); return true; }
    if (e.key === 'Escape') { close(); return true; }
    return false;
  };
  if (s.query.length < 1) return <div className="ink-emoji-inline is-empty" />;
  return (
    <div className="ink-emoji-inline">
      <div className="ink-emoji-inline-grid">
        {list.map((em, i) => (
          <span key={em.char + i} className={'ink-emoji-cell' + (i === active ? ' is-active' : '')} title={em.name} onMouseMove={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(em); }}>{em.char}</span>
        ))}
        <span className="ink-emoji-cell ink-emoji-more" title={t('emoji.more')} onMouseDown={(e) => {
          e.preventDefault();
          const r = (e.currentTarget.closest('.ink-emoji-inline') as HTMLElement).getBoundingClientRect();
          const c = consumeTrigger(); close(); if (!c) return;
          openEmojiPicker({ anchor: new DOMRect(r.left, r.top, 0, 0), onPick: (ch) => { setTitle(c.blockId, insertText(store.get(c.blockId)!.title || [], c.at, ch), false); focusBlock(c.blockId, c.at + ch.length); } });
        }}><Icon name="plus" size={16} stroke={1.8} /></span>
      </div>
      {!list.length && <div className="ink-menu-empty">{t('common.noResults')}</div>}
    </div>
  );
}
void rtPlain;
