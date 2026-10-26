/** The 36px window tab bar (rendered by the tab-bar renderer in Electron, and by the window simulator in a browser). */
import { useRef, useState } from 'react';
import type { TabState } from '@shared/ipc';
import { Icon } from '../ui/icons';
import { t } from '../i18n';

export interface TabBarProps {
  tabs: TabState[];
  canGoBack: boolean;
  canGoForward: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  trafficLights?: boolean;
  onNew(): void;
  onClose(id: string): void;
  onActivate(id: string): void;
  onBack(): void;
  onForward(): void;
  onToggleSidebar(): void;
  onMove(id: string, toIndex: number): void;
  onMenu?(id: string, x: number, y: number): void;
}

export function TabBar(p: TabBarProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const leftW = p.sidebarOpen ? p.sidebarWidth : 110;
  const dropIndex = (x: number) => {
    const els = [...(strip.current?.querySelectorAll<HTMLElement>('.ink-tab') || [])];
    let i = els.findIndex((el) => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; });
    if (i < 0) i = els.length;
    return i;
  };
  return (
    <div className="ink-tabbar" onDoubleClick={(e) => { if (e.target === e.currentTarget) window.inkwellNative?.send('inkwell:titlebar-dblclick'); }}>
      <div className={'ink-tabbar-left' + (p.sidebarOpen ? ' is-sidebar' : '')} style={{ width: leftW }}>
        {p.trafficLights && <div className="ink-traffic" aria-hidden><span className="tl-close" /><span className="tl-min" /><span className="tl-max" /></div>}
        <div className="ink-tbar-icon ink-tbar-sidebar" role="button" aria-label={p.sidebarOpen ? t('tabs.closeSidebar') : t('tabs.openSidebar')} title={p.sidebarOpen ? t('tabs.closeSidebar') : t('tabs.openSidebar')} onClick={p.onToggleSidebar}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden><rect x="1.6" y="2.6" width="12.8" height="10.8" rx="2.2" /><path d="M5.6 2.6v10.8" /></svg>
        </div>
        {p.sidebarOpen && <>
          <div className="ink-tbar-spacer" />
          <div className="ink-tbar-icon" role="button" title={t('tabs.inbox')}><Icon name="inbox" size={16} stroke={1.5} /></div>
          <div className="ink-tbar-icon" role="button" title={t('tabs.new')}><Icon name="compose" size={16} stroke={1.5} /></div>
        </>}
      </div>
      <div className="ink-tabbar-nav">
        <div className={'ink-tbar-icon' + (p.canGoBack ? '' : ' is-disabled')} role="button" aria-label={t('tabs.back')} title={t('tabs.back')} onClick={() => p.canGoBack && p.onBack()}><Icon name="chevronLeft" size={24} stroke={1.25} /></div>
        <div className={'ink-tbar-icon' + (p.canGoForward ? '' : ' is-disabled')} role="button" aria-label={t('tabs.forward')} title={t('tabs.forward')} onClick={() => p.canGoForward && p.onForward()}><Icon name="chevronRight" size={24} stroke={1.25} /></div>
      </div>
      <div className="ink-tabstrip" ref={strip}
        onDragOver={(e) => { if (!drag) return; e.preventDefault(); setDrag({ ...drag, over: dropIndex(e.clientX) }); }}
        onDrop={(e) => { if (!drag) return; e.preventDefault(); p.onMove(drag.id, drag.over); setDrag(null); }}>
        {p.tabs.map((tab, i) => (
          <div key={tab.id}
            className={'ink-tab' + (tab.active ? ' is-active' : '') + (hover === tab.id ? ' is-hover' : '') + (i === p.tabs.length - 1 ? ' is-last' : '') + (p.tabs[i + 1]?.active ? ' before-active' : '') + (tab.isPinned ? ' is-pinned' : '')}
            role="tab" aria-selected={tab.active} title={tab.title}
            draggable onDragStart={(e) => { e.dataTransfer.setData('application/x.inkwell.tab-id', tab.id); setDrag({ id: tab.id, over: i }); }} onDragEnd={() => setDrag(null)}
            onMouseEnter={() => setHover(tab.id)} onMouseLeave={() => setHover(null)}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); p.onClose(tab.id); } else if (e.button === 0) p.onActivate(tab.id); }}
            onContextMenu={(e) => { e.preventDefault(); p.onMenu?.(tab.id, e.clientX, e.clientY); }}>
            {drag && drag.over === i && drag.id !== tab.id && <div className="ink-tab-drop" />}
            {tab.icon && <span className="ink-tab-icon">{tab.icon}</span>}
            <span className="ink-tab-title">{tab.title || t('common.untitled')}</span>
            <span className="ink-tab-close" role="button" aria-label={t('tabs.close')} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); p.onClose(tab.id); }}><Icon name="x" size={16} stroke={1.5} /></span>
          </div>
        ))}
        {drag && drag.over === p.tabs.length && <div className="ink-tab-drop is-end" />}
        <div className="ink-tbar-icon ink-tbar-new" role="button" aria-label={t('tabs.newTab')} title={t('tabs.newTab')} onClick={p.onNew}><Icon name="plus" size={24} stroke={1.25} /></div>
      </div>
      <div className="ink-tabbar-right" />
    </div>
  );
}
