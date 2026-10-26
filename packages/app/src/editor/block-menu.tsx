import { t } from '../i18n';
import { store } from '../store/store';
import { openMenu, type MenuSpec } from '../ui/menu';
import { kindOfBlock, TURN_INTO_ORDER, kind } from './catalog';
import { turnInto, setBlocksColor, deleteBlocks, duplicateBlocks } from './commands';
import { setBlockSelection, focusBlock, clearBlockSelection } from './registry';
import { COLORS, colorLabel, lastUsedColor, pushColor } from './colors';
import { EditedFooter } from '../shell/MenuFooter';
import { openMoveTo } from '../shell/MoveTo';
import { BRAND } from '@shared/brand';
import { toast } from '../ui/toast';
import { countWords } from '../app/pages';

function ColorIcon({ c }: { c: string }) {
  const bg = c.endsWith('_background');
  const base = c.replace('_background', '');
  return <span className={'ink-color-icon' + (bg ? ' is-bg ink-bgfill-' + base : '')}>{!bg && <span className={'ink-fg-' + base}>A</span>}</span>;
}

export function colorMenuSpec(ids: string[]): MenuSpec {
  const cur = store.get(ids[0])?.format?.color;
  const last = lastUsedColor();
  const pick = (c: string) => { pushColor(c); setBlocksColor(ids, c === 'default' || c === 'default_background' ? undefined : c); };
  return {
    width: 220,
    maxHeight: 440,
    groups: [
      [{ kind: 'label', label: t('bm.lastUsed') }, { id: 'last', label: colorLabel(last), icon: <ColorIcon c={last} />, shortcut: '⌘⇧H', onSelect: () => pick(last) }],
      [{ kind: 'label', label: t('bm.textColor') }, ...COLORS.map((c) => ({ id: 'fg-' + c, label: colorLabel(c), icon: <ColorIcon c={c} />, checked: (cur || 'default') === c, onSelect: () => pick(c) }))],
      [{ kind: 'label', label: t('bm.bgColor') }, ...COLORS.map((c) => { const k = c === 'default' ? 'default_background' : c + '_background'; return { id: 'bg-' + c, label: colorLabel(k), icon: <ColorIcon c={k} />, checked: cur === k, onSelect: () => pick(k) }; })],
    ],
  };
}

export function openBlockMenuFor(ids: string[], anchorEl: HTMLElement | DOMRect, opts: { placement?: 'bottom-start' | 'left-start' } = {}) {
  const first = store.get(ids[0]); if (!first) return;
  setBlockSelection(ids);
  const k = kindOfBlock(first.type, first.format?.toggleable);
  const anchor = anchorEl instanceof HTMLElement ? anchorEl.getBoundingClientRect() : anchorEl;
  const c = countWords(first.id);
  const textLike = first.type !== 'divider' && first.type !== 'image' && first.type !== 'video' && first.type !== 'bookmark';
  openMenu({ left: anchor.left, right: anchor.right, top: anchor.top, bottom: anchor.bottom }, () => ({
    width: 265,
    search: t('bm.search'),
    groups: [
      [
        { kind: 'label', label: ids.length > 1 ? t('bm.blocks', { n: ids.length }) : k?.label() || t('b.text') },
        ...(textLike ? [{ id: 'turn', label: t('bm.turnInto'), icon: 'turnInto' as const, keywords: ['turn into', 'convert'], sub: () => ({ width: 220, maxHeight: 440, groups: [[...TURN_INTO_ORDER.map((id) => { const kk = kind(id); return { id: 'ti-' + id, label: kk.label(), icon: kk.icon, checked: k?.id === id, onSelect: () => { turnInto(ids, kk.type, { toggleable: kk.toggleable }); setBlockSelection(ids); } }; })]] }) }] : []),
        { id: 'color', label: t('bm.color'), icon: 'paintBucket', keywords: ['color', 'colour', 'yanse'], sub: () => colorMenuSpec(ids) },
      ],
      [
        { id: 'link', label: t('bm.copyLink'), icon: 'link', shortcut: '⌘^L', onSelect: () => { navigator.clipboard?.writeText(`${BRAND.scheme}://page/${store.pageOf(ids[0])?.id}#${ids[0]}`).catch(() => {}); toast(t('toast.linkCopied')); } },
        { id: 'dup', label: t('bm.duplicate'), icon: 'duplicate', shortcut: '⌘D', onSelect: () => { const n = duplicateBlocks(ids); setBlockSelection(n); } },
        { id: 'move', label: t('bm.moveTo'), icon: 'move', shortcut: '⌘⇧P', onSelect: () => setTimeout(() => openMoveTo(anchor, ids)) },
        { id: 'delete', label: t('bm.delete'), icon: 'trash', shortcut: 'Del', onSelect: () => { deleteBlocks(ids); clearBlockSelection(); } },
      ],
      [
        { id: 'comment', label: t('bm.comment'), icon: 'comment', shortcut: '⌘⇧M' },
        { id: 'suggest', label: t('bm.suggest'), icon: 'suggest', shortcut: '⌘⇧⌥X' },
      ],
      [
        { id: 'ai', label: t('bm.ask'), icon: 'ai', shortcut: '⌘J' },
        { id: 'skills', label: t('bm.skills'), icon: 'sliders', sub: () => ({ width: 220, groups: [[{ id: 's1', label: t('tb.skill.improve'), disabled: true }, { id: 's2', label: t('tb.skill.proofread'), disabled: true }]] }) },
      ],
    ],
    footer: <><EditedFooter block={first} /><div className="ink-edited-line">{t('common.wordsChars', { words: c.words || countInline(first.id).words, chars: c.chars || countInline(first.id).chars })}</div></>,
  }), { placement: opts.placement || 'bottom-start', offset: 2, onClose: () => { /* keep selection */ } });
  void focusBlock;
}
function countInline(id: string) {
  const s = (store.get(id)?.title || []).map((x) => x[0]).join('');
  return { words: (s.match(/[A-Za-z0-9]+|[\u3400-\u9fff]/g) || []).length, chars: s.length };
}
