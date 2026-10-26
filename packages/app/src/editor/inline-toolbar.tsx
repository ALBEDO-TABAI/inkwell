import { useSyncExternalStore } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { Icon, type IconName } from '../ui/icons';
import { openPopover, closePopover, isPopoverOpen, tip } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { activeEditable } from './registry';
import { getSelectionOffsets, setSelectionOffsets } from './caret';
import { toggleMark, rangeHasMark, setColor, clearFormatting, slice, rtPlain } from './richtext';
import { setTitle, turnInto } from './commands';
import { openLinkPopover } from './link-popover';
import { TURN_INTO_ORDER, kind, kindOfBlock } from './catalog';
import { COLORS, colorLabel, recentColors, pushColor } from './colors';
import { isInlineMenuOpen } from './inline-menus';
import { commentOnSelection } from '../comments/Comments';

interface TbState { blockId: string; start: number; end: number; rect: DOMRect }
let state: TbState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const useTb = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

let lastMouse: { x: number; y: number } | null = null;
window.addEventListener('mouseup', (e) => { lastMouse = { x: e.clientX, y: e.clientY }; }, true);
window.addEventListener('keydown', () => { lastMouse = null; }, true);

/** Called after mouseup / shift-arrow inside an editable. */
export function onSelectionChanged() {
  const a = activeEditable();
  const sel = window.getSelection();
  if (!a || !sel || sel.isCollapsed || isInlineMenuOpen()) { hideToolbar(); return; }
  const b = store.get(a.id);
  if (!b || b.type === 'code' || a.el.closest('.ink-page-title')) { hideToolbar(); return; }
  const o = getSelectionOffsets(a.el);
  if (!o || o.start === o.end) { hideToolbar(); return; }
  const rects = sel.getRangeAt(0).getClientRects();
  const last = rects[rects.length - 1] || sel.getRangeAt(0).getBoundingClientRect();
  const anchorX = lastMouse ? lastMouse.x : (o.backward ? rects[0]?.left ?? last.left : last.right);
  const anchorY = lastMouse ? Math.max(lastMouse.y, last.bottom) : (o.backward ? rects[0]?.bottom ?? last.bottom : last.bottom);
  state = { blockId: a.id, start: o.start, end: o.end, rect: new DOMRect(anchorX, anchorY, 0, 0) };
  emit();
  if (!isPopoverOpen('inline-toolbar')) {
    openPopover({ id: 'inline-toolbar', noFocus: true, placement: 'bottom-start', offset: 16,
      anchor: () => ({ left: state!.rect.left + 16, right: state!.rect.left + 16, top: state!.rect.top, bottom: state!.rect.top }),
      onClose: () => { state = null; },
      render: () => <Toolbar /> });
  }
}
export function hideToolbar() { if (isPopoverOpen('inline-toolbar')) closePopover('inline-toolbar'); state = null; }

document.addEventListener('selectionchange', () => {
  if (!state) return;
  const a = activeEditable();
  const sel = getSelection();
  if (!sel || sel.isCollapsed) {
    // keep open while interacting with the toolbar/submenus
    const active = document.activeElement;
    if (active && active.closest?.('[data-popover-id]')) return;
    setTimeout(() => { const s2 = getSelection(); if ((!s2 || s2.isCollapsed) && !document.activeElement?.closest?.('[data-popover-id]')) hideToolbar(); }, 0);
  } else if (a && a.id !== state.blockId) hideToolbar();
});

function withSel(fn: (s: TbState) => void) {
  if (!state) return;
  const s = state;
  fn(s);
  requestAnimationFrame(() => { const el = document.querySelector<HTMLElement>(`[data-editable-id="${s.blockId}"]`); if (el) { el.focus({ preventScroll: true }); setSelectionOffsets(el, s.start, s.end); } });
}

export function applyTextColor(blockId: string, start: number, end: number, color: string) {
  const b = store.get(blockId)!;
  pushColor(color);
  setTitle(blockId, setColor(b.title || [], start, end, color === 'default' || color === 'default_background' ? undefined : color), false, { start, end });
}

export function ColorGrid({ onPick, current }: { onPick: (c: string) => void; current?: string }) {
  const recent = recentColors();
  const Sw = ({ c }: { c: string }) => {
    const bg = c.endsWith('_background');
    const base = c.replace('_background', '');
    return (
      <span className={'ink-swatch' + (bg ? ' is-bg ink-bgfill-' + base + ' ink-fg-' + base : ' is-fg ink-fg-' + base) + (current === c || (!current && (c === 'default' || c === 'default_background')) ? ' is-current' : '')} role="button"
        {...tip(colorLabel(c))} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)}>
        {!bg && 'A'}
      </span>
    );
  };
  return (
    <div className="ink-colorgrid">
      {recent.length > 0 && <><div className="ink-menu-label">{t('bm.recent')}</div><div className="ink-swatches">{recent.map((c) => <Sw key={'r' + c} c={c} />)}</div></>}
      <div className="ink-menu-label">{t('bm.textColor')}</div>
      <div className="ink-swatches">{COLORS.map((c) => <Sw key={c} c={c} />)}</div>
      <div className="ink-menu-label">{t('bm.bgColor')}</div>
      <div className="ink-swatches">{COLORS.map((c) => <Sw key={c + 'b'} c={c === 'default' ? 'default_background' : c + '_background'} />)}</div>
    </div>
  );
}

function Toolbar() {
  const s = useTb();
  if (!s) return null;
  const b = store.get(s.blockId); if (!b) return null;
  const rt = b.title || [];
  const has = (k: 'b' | 'i' | 'u' | 's' | 'code') => rangeHasMark(rt, s.start, s.end, k);
  const hasLink = rangeHasMark(rt, s.start, s.end, 'link');
  const curColor = slice(rt, s.start, s.end)[0]?.[1]?.color;
  const toggle = (k: 'b' | 'i' | 'u' | 's' | 'code') => withSel((st) => { const cur = store.get(st.blockId)!; setTitle(st.blockId, toggleMark(cur.title || [], st.start, st.end, k), false, st); });
  const Btn = ({ icon, on, label, sc, onClick, w = 32 }: { icon: IconName; on?: boolean; label: string; sc?: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; w?: number }) => (
    <span className={'ink-tb-btn' + (on ? ' is-on' : '')} style={{ width: w }} role="button" {...tip(label, sc, 'top')} onMouseDown={(e) => e.preventDefault()} onClick={onClick}><Icon name={icon} size={16} stroke={on ? 2.4 : 1.8} /></span>
  );
  const k = kindOfBlock(b.type, b.format?.toggleable);
  return (
    <div className="ink-toolbar" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      <div className="ink-tb-row ink-tb-turn" role="button" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), () => turnIntoSpec([s.blockId]), { parent: 'inline-toolbar', placement: 'right-start', anchorEl: e.currentTarget })}>
        <Icon name={k?.icon || 'text'} size={16} stroke={1.8} /><span className="ink-tb-turn-label">{b.type === 'text' ? t('tb.plainText') : k?.label()}</span><Icon name="chevronRight" size={14} stroke={2} className="ink-tb-chev" />
      </div>
      <div className="ink-tb-sep" />
      <div className="ink-tb-grid">
        <span className="ink-tb-btn ink-tb-color" style={{ width: 32 }} role="button" {...tip(t('tb.color'), undefined, 'top')} onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          openPopover({ id: 'tb-color', parent: 'inline-toolbar', anchor: { left: r.left - 4, right: r.right, top: r.top, bottom: r.bottom }, placement: 'bottom-start', offset: 4, noFocus: true,
            render: (close) => <div className="ink-menu ink-color-pop" style={{ width: 190 }}><ColorGrid current={curColor} onPick={(c) => { withSel((st) => applyTextColor(st.blockId, st.start, st.end, c)); close(); }} /></div> });
        }}><span className={'ink-tb-a ' + (curColor ? (curColor.endsWith('_background') ? 'ink-bg-' + curColor.replace('_background', '') : 'ink-fg-' + curColor) : '')}>A</span></span>
        <Btn icon="bold" on={has('b')} label={t('tb.bold')} sc="⌘B" onClick={() => toggle('b')} />
        <Btn icon="italic" on={has('i')} label={t('tb.italic')} sc="⌘I" onClick={() => toggle('i')} />
        <Btn icon="underline" on={has('u')} label={t('tb.underline')} sc="⌘U" onClick={() => toggle('u')} />
        <Btn icon="clearFormat" label={t('tb.clear')} w={28} onClick={() => withSel((st) => { const cur = store.get(st.blockId)!; setTitle(st.blockId, clearFormatting(cur.title || [], st.start, st.end), false, st); })} />
        <Btn icon="link" on={hasLink} label={t('tb.link')} sc="⌘K" onClick={() => { const st = state!; hideToolbar(); openLinkPopover(st.blockId, st.start, st.end); }} />
        <Btn icon="strike" on={has('s')} label={t('tb.strike')} sc="⌘⇧S" onClick={() => toggle('s')} />
        <Btn icon="code" on={has('code')} label={t('tb.code')} sc="⌘E" onClick={() => toggle('code')} />
        <Btn icon="sqrt" label={t('tb.equation')} sc="⌘⇧E" onClick={() => withSel((st) => {
          const cur = store.get(st.blockId)!; const tex = rtPlain(slice(cur.title || [], st.start, st.end));
          const nt = [...slice(cur.title || [], 0, st.start), ['⁍', { eq: tex }] as any, ...slice(cur.title || [], st.end)];
          setTitle(st.blockId, nt, false); st.end = st.start + 1; hideToolbar();
        })} />
        <Btn icon="more" label={t('tb.more')} onClick={() => {}} />
      </div>
      <div className="ink-tb-sep" />
      <div className="ink-tb-comment">
        <span className="ink-tb-row ink-tb-comment-btn" role="button" onClick={() => { const st = state!; hideToolbar(); commentOnSelection(st.blockId, st.start, st.end); }}><Icon name="comment" size={16} stroke={1.8} /><span>{t('tb.comment')}</span></span>
        <span className="ink-tb-spacer" />
        <span className="ink-tb-btn" role="button" {...tip(t('tb.reaction'), undefined, 'top')}><Icon name="emojiAdd" size={16} stroke={1.8} /></span>
        <span className="ink-tb-btn" role="button" {...tip(t('tb.suggest'), undefined, 'top')}><Icon name="suggest" size={16} stroke={1.8} /></span>
      </div>
      <div className="ink-tb-sep" />
      <div className="ink-tb-skills">
        <div className="ink-tb-skills-head"><span>{t('tb.skills')}</span><Icon name="sliders" size={14} stroke={1.8} /></div>
        <div className="ink-tb-skills-list">
          {['improve', 'proofread', 'explain', 'reformat', 'translate'].map((sk) => <div key={sk} className="ink-tb-skill is-disabled">{t('tb.skill.' + sk)}</div>)}
        </div>
        <div className="ink-tb-ai"><span>{t('tb.aiEdit')}</span><span className="ink-slash-hint">⌘^E</span></div>
      </div>
    </div>
  );
}

export function turnIntoSpec(ids: string[]) {
  const b = store.get(ids[0])!;
  const cur = kindOfBlock(b.type, b.format?.toggleable);
  return {
    width: 220,
    search: undefined,
    groups: [[
      ...TURN_INTO_ORDER.map((id) => {
        const k = kind(id);
        return { id: 'turn-' + id, label: k.label(), icon: k.icon, checked: cur?.id === id, onSelect: () => { turnInto(ids, k.type, { toggleable: k.toggleable }); } };
      }),
    ]],
  };
}
