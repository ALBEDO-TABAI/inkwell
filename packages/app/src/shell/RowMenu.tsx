import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { openMenu } from '../ui/menu';
import { openPopover } from '../ui/overlay';
import { PageIcon } from '../ui/PageIcon';
import { duplicateBlock, trashPage, toggleFavorite, renamePage, pageTitle } from '../app/pages';
import { navigate } from '../app/state';
import { toast } from '../ui/toast';
import { EditedFooter } from './MenuFooter';
import { openMoveTo } from './MoveTo';
import { BRAND } from '@shared/brand';

export function copyPageLink(id: string) {
  const url = `${BRAND.scheme}://page/${id}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  toast(t('toast.linkCopied'));
}

export function openRename(anchorEl: HTMLElement, id: string) {
  const row = anchorEl.closest('.ink-sb-row') || anchorEl;
  const r = row.getBoundingClientRect();
  openPopover({
    id: 'rename', anchor: { left: r.left, top: r.top, right: r.right, bottom: r.top }, placement: 'bottom-start',
    render: (close) => <RenameBox id={id} close={close} />,
  });
}
function RenameBox({ id, close }: { id: string; close: () => void }) {
  const b = store.get(id);
  const [v, setV] = useState(pageTitle(b) === t('common.untitled') ? '' : pageTitle(b));
  const target = b?.type === 'alias' ? b.props!.target! : id;
  return (
    <div className="ink-rename">
      <span className="ink-rename-icon"><PageIcon block={store.get(target)} size={20} /></span>
      <input data-autofocus className="ink-input" value={v} onChange={(e) => { setV(e.target.value); renamePage(target, e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); close(); } }} onFocus={(e) => e.target.select()} />
    </div>
  );
}

export function openRowMenu(anchorEl: HTMLElement, id: string, at?: { x: number; y: number }) {
  const b = store.get(id); if (!b) return;
  const targetId = b.type === 'alias' ? b.props?.target || id : id;
  const fav = store.space.favorites.includes(targetId);
  const r = at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : anchorEl.getBoundingClientRect();
  openMenu(r, () => ({
    width: 265,
    groups: [
      [{ kind: 'label', label: t('row.header') }, { id: 'fav', label: fav ? t('row.unfavorite') : t('row.favorite'), icon: 'star', onSelect: () => toggleFavorite(targetId) }],
      [{ id: 'offline', label: t('row.offline'), icon: 'download', toggle: false, onSelect: () => {} }],
      [
        { id: 'link', label: t('row.copyLink'), icon: 'link', onSelect: () => copyPageLink(targetId) },
        { id: 'dup', label: t('row.duplicate'), icon: 'copy', shortcut: '⌘D', onSelect: () => { const n = duplicateBlock(id); if (n) toast(t('toast.duplicated')); } },
        { id: 'rename', label: t('row.rename'), icon: 'rename', shortcut: '⌘⇧R', onSelect: () => setTimeout(() => openRename(anchorEl, id)) },
        { id: 'move', label: t('row.moveTo'), icon: 'move', shortcut: '⌘⇧P', onSelect: () => setTimeout(() => openMoveTo(anchorEl, id)) },
        { id: 'trash', label: t('row.trash'), icon: 'trash', onSelect: () => trashPage(id) },
      ],
      [{ id: 'wiki', label: t('row.wiki'), icon: 'wiki', disabled: false, onSelect: () => {} }],
      [
        { id: 'tab', label: t('row.openNewTab'), icon: 'arrowUpRight', shortcut: '⌘⇧↵', onSelect: () => openInNewTab(targetId) },
        { id: 'win', label: t('row.openNewWindow'), icon: 'newWindow', onSelect: () => openInNewWindow(targetId) },
        { id: 'peek', label: t('row.openSidePeek'), icon: 'sidePeek', shortcut: '⌥Click', onSelect: () => navigate(targetId) },
      ],
    ],
    footer: <EditedFooter block={store.get(targetId)} />,
  }), { anchorEl, placement: at ? 'bottom-start' : 'bottom-start' });
}

export function openInNewTab(id: string) {
  if (window.inkwellNative) window.inkwellNative.send('inkwell:new-tab', { url: '#/p/' + id });
  else window.parent?.postMessage({ type: 'inkwell:new-tab', url: '#/p/' + id }, '*');
}
export function openInNewWindow(id: string) {
  if (window.inkwellNative) window.inkwellNative.send('inkwell:new-window', { url: '#/p/' + id });
  else window.open(location.pathname + location.search + '#/p/' + id, '_blank');
}
