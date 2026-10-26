/** Side peek (660 wide, docked right over the page) and center peek (960×680 modal, radius 12). */
import { useEffect, useRef } from 'react';
import { useUi, closePeek, openPeek, navigate } from '../app/state';
import { useBlock } from '../hooks/useStore';
import { store } from '../store/store';
import { Icon } from '../ui/icons';
import { tip, isPopoverOpen } from '../ui/overlay';
import { PageView } from '../page/PageView';
import { copyPageLink } from './RowMenu';
import { toggleFavorite } from '../app/pages';
import { openPageMenu } from './Topbar';

export function PeekHost() {
  const peek = useUi((s) => s.rowPeek);
  const ref = useRef<HTMLDivElement>(null);
  const page = useBlock(peek?.id);
  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !isPopoverOpen()) {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && ref.current?.contains(ae) && ae.isContentEditable) { ae.blur(); return; }
        e.preventDefault(); closePeek();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (peek.mode !== 'side') return;
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest('[data-popover-id]') || t.closest('[data-row-id]') || t.closest('.ink-modal-backdrop')) return;
      closePeek();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); };
  }, [peek?.id, peek?.mode]);
  if (!peek || !page || !page.alive) return null;
  const fav = store.space.favorites.includes(peek.id);
  const header = (
    <div className="ink-peek-head">
      <div className="ink-peek-left">
        {peek.mode === 'side'
          ? <button className="ink-peek-btn" aria-label="关闭预览" onClick={closePeek} {...tip('关闭预览', 'Esc')}><Icon name="chevronsRight" size={18} /></button>
          : <button className="ink-peek-btn" aria-label="关闭预览" onClick={closePeek} {...tip('关闭预览', 'Esc')}><Icon name="x" size={18} /></button>}
        <button className="ink-peek-btn" aria-label="以整页打开" onClick={() => navigate(peek.id)} {...tip('以整页打开')}><Icon name="expand" size={16} /></button>
        <button className="ink-peek-btn" aria-label={peek.mode === 'side' ? '切换到中心预览' : '切换到侧边预览'} onClick={() => openPeek(peek.id, peek.mode === 'side' ? 'center' : 'side')} {...tip(peek.mode === 'side' ? '中心预览' : '侧边预览')}><Icon name={peek.mode === 'side' ? 'centerPeek' : 'sidePeek'} size={16} /></button>
      </div>
      <div className="ink-peek-right">
        <span className="ink-topbar-btn ink-share-btn" role="button"><Icon name="lock" size={12} stroke={2} /><span>共享</span></span>
        <span className="ink-topbar-icon" role="button" {...tip('拷贝链接')} onClick={() => copyPageLink(peek.id)}><Icon name="link" size={20} stroke={1.6} /></span>
        <span className={'ink-topbar-icon' + (fav ? ' is-fav' : '')} role="button" onClick={() => toggleFavorite(peek.id)}><Icon name="star" size={20} stroke={1.6} style={fav ? { fill: '#F6C050', color: '#F6C050' } : undefined} /></span>
        <span className="ink-topbar-icon" role="button" onClick={(e) => openPageMenu(e.currentTarget, peek.id)}><Icon name="more" size={20} stroke={2} /></span>
      </div>
    </div>
  );
  if (peek.mode === 'center') return (
    <div className="ink-peek-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) closePeek(); }}>
      <div className="ink-peek ink-peek-center" ref={ref} role="dialog" aria-label="中心预览">
        {header}
        <PageView key={peek.id} pageId={peek.id} variant="center" />
      </div>
    </div>
  );
  return (
    <div className="ink-peek ink-peek-side" ref={ref} role="dialog" aria-label="侧边预览">
      {header}
      <PageView key={peek.id} pageId={peek.id} variant="side" />
    </div>
  );
}
