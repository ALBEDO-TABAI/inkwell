import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { Block } from '../store/model';
import { useStoreVersion } from '../hooks/useStore';
import { Icon, type IconName } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openMenu } from '../ui/menu';
import { tip } from '../ui/overlay';
import { useUi, navigate, setExpanded, setSidebarWidth, commitSidebarWidth, setUi, toggleSidebar, getUi } from '../app/state';
import { sidebarChildren, pageTitle, createPage, isInTrash } from '../app/pages';
import { kvGet, kvPut } from '../store/persistence';
import { openRowMenu } from './RowMenu';
import { openWorkspaceSwitcher } from './WorkspaceSwitcher';
import { openTrash } from './Trash';
import { openSettings } from './Settings';
import { openSearch } from './Search';

export function Sidebar({ floating = false }: { floating?: boolean }) {
  useStoreVersion();
  const width = useUi((s) => s.sidebarWidth);
  const space = store.space;
  const [promo, setPromo] = useState(() => !kvGet('promoDismissed', true));
  const priv = space.privatePages.filter((id) => !isInTrash(id) && store.get(id)?.alive);
  const favs = space.favorites.filter((id) => !isInTrash(id) && store.get(id)?.alive);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check); ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild);
    const mo = new MutationObserver(check); mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  return (
    <nav className={'ink-sidebar' + (floating ? ' is-floating' : '')} style={{ width }} aria-label="sidebar">
      <div className="ink-sb-inner">
        <div className="ink-sb-search-wrap">
          <div className="ink-sb-search" role="button" tabIndex={0} onClick={() => openSearch()}>
            <span className="ink-sb-search-text">{t('sidebar.search')}</span>
            <span className="ink-kbd-chip">⌘K</span>
          </div>
        </div>
        <div ref={scrollRef} className={'ink-sb-scroll' + (scrolled ? ' is-scrolled' : '') + (more ? ' has-more' : '')} onScroll={(e) => { const el = e.target as HTMLElement; setScrolled(el.scrollTop > 0); setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1); }}>
          <div className="ink-sb-home">
            <div className="ink-sb-home-pill is-active" role="button"><Icon name="home" size={16} stroke={2} style={{ fill: 'currentColor' }} /><span>{t('sidebar.home')}</span></div>
            <div className="ink-sb-home-btn" role="button" {...tip(t('sidebar.chat'))}><Icon name="chat" size={16} stroke={2} style={{ fill: 'currentColor' }} /></div>
            <div className="ink-sb-home-btn" role="button" {...tip(t('sidebar.calendar'))}><Icon name="calendar" size={16} stroke={1.8} /></div>
          </div>
          <div className="ink-sb-group">
            <NavRow icon="newChat" label={t('sidebar.newChat')} />
            <NavRow icon="library" label={t('sidebar.library')} />
          </div>
          {favs.length > 0 && (
            <Section id="favorites" title={t('sidebar.favorites')}>
              {favs.map((id) => <TreeRow key={'f' + id} id={id} level={0} keyPrefix="fav" />)}
            </Section>
          )}
          <Section id="upcoming" title={t('sidebar.upcoming')}>
            <NavRow iconNode={<CalendarBadge />} label={t('sidebar.connectCalendar')} weight={400} />
          </Section>
          <Section id="teamspaces" title={t('sidebar.teamspaces')} spaced>
            {space.teamspaces.map((ts) => (
              <TeamspaceRow key={ts.id} name={ts.name} pageId={ts.pages[0]} />
            ))}
            <NavRow icon="plus" label={t('sidebar.addNew')} muted className="ink-sb-addnew" iconSize={16} />
          </Section>
          <Section id="private" title={t('sidebar.private')} spaced onAdd={() => createPage('private')}>
            {priv.map((id) => <TreeRow key={id} id={id} level={0} />)}
          </Section>
          <NavRow icon="sliders" label={t('sidebar.customize')} muted className="ink-sb-customize" iconSize={18} />
        </div>
        {promo && <PromoCard onClose={() => { setPromo(false); kvPut('promoDismissed', true); }} />}
        <div className="ink-sb-bottom">
          <div className="ink-sb-divider" />
          <div className="ink-sb-footer">
            <div className="ink-sb-switcher" role="button" onClick={(e) => openWorkspaceSwitcher(e.currentTarget)}>
              <span className="ink-ws-icon">{space.icon}</span>
              <span className="ink-sb-switcher-name">{space.name}</span>
              <Icon name="chevronDown" size={14} stroke={2} className="ink-sb-switcher-chev" />
            </div>
            <div className="ink-sb-iconbtn" role="button" {...tip(t('sidebar.help'))}><Icon name="help" size={20} stroke={1.5} /></div>
            <div className="ink-sb-iconbtn" role="button" {...tip(t('sidebar.apps'))} onClick={(e) => openAppsMenu(e.currentTarget)}><Icon name="apps" size={20} stroke={1.5} /></div>
          </div>
        </div>
      </div>
      {!floating && <Resizer />}
    </nav>
  );
}

function openAppsMenu(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  openMenu(r, {
    width: 220,
    groups: [[
      { id: 'settings', label: t('sidebar.settings'), icon: 'settings', onSelect: () => openSettings() },
      { id: 'trash', label: t('sidebar.trash'), icon: 'trash', onSelect: () => openTrash() },
    ]],
  }, { placement: 'top-start', anchorEl: el });
}

function CalendarBadge() {
  return (
    <span className="ink-cal-badge" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3" fill="#3478F6" /><rect x="1" y="1" width="14" height="4" rx="2" fill="#2563D9" /><text x="8" y="13" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" fontFamily="var(--ink-font-sans)">31</text></svg>
    </span>
  );
}

function NavRow({ icon, iconNode, label, muted, onClick, className, weight, iconSize = 20 }: { icon?: IconName; iconNode?: ReactNode; label: string; muted?: boolean; onClick?: () => void; className?: string; weight?: number; iconSize?: number }) {
  return (
    <div className={'ink-sb-row ink-sb-nav' + (muted ? ' is-muted' : '') + (className ? ' ' + className : '')} role="button" onClick={onClick}>
      <span className="ink-sb-icon">{iconNode || (icon && <Icon name={icon} size={iconSize} stroke={1.5} />)}</span>
      <span className="ink-sb-label" style={weight ? { fontWeight: weight } : undefined}>{label}</span>
    </div>
  );
}

function TeamspaceRow({ name, pageId }: { name: string; pageId?: string }) {
  const cur = useUi((s) => s.pageId);
  return (
    <div className={'ink-sb-row ink-sb-nav ink-sb-team' + (cur === pageId ? ' is-selected' : '')} role="button" onClick={() => pageId && navigate(pageId)}>
      <span className="ink-sb-icon"><span className="ink-team-icon"><Icon name="home" size={14} stroke={2.2} style={{ fill: 'currentColor' }} /></span></span>
      <span className="ink-sb-label">{name}</span>
    </div>
  );
}

function Section({ id, title, children, spaced, onAdd }: { id: string; title: string; children: ReactNode; spaced?: boolean; onAdd?: () => void }) {
  const [open, setOpen] = useState(() => kvGet<Record<string, boolean>>('sectionsOpen', {})[id] !== false);
  return (
    <div className={'ink-sb-section' + (spaced ? ' is-spaced' : '')}>
      <div className="ink-sb-section-head" role="button" onClick={() => { setOpen(!open); kvPut('sectionsOpen', { ...kvGet('sectionsOpen', {}), [id]: !open }); }}>
        <span className="ink-sb-section-title">{title}</span>
        {onAdd && (
          <span className="ink-sb-row-actions">
            <span className="ink-sb-action" role="button" {...tip(t('sidebar.addPage'))} onClick={(e) => { e.stopPropagation(); onAdd(); }}><Icon name="plus" size={16} stroke={1.8} /></span>
          </span>
        )}
      </div>
      {open && children}
    </div>
  );
}

function TreeRow({ id, level, keyPrefix = '' }: { id: string; level: number; keyPrefix?: string }) {
  const b = store.get(id);
  const cur = useUi((s) => s.pageId);
  const expandedKey = keyPrefix + id;
  const expanded = useUi((s) => !!s.expanded[expandedKey]);
  const [renaming] = useState(false);
  if (!b || !b.alive) return null;
  const target: Block | undefined = b.type === 'alias' ? store.get(b.props?.target) : b;
  const kids = target && b.type !== 'alias' ? sidebarChildren(target.id) : [];
  const selected = cur === target?.id && b.type !== 'alias';
  const open = () => target && navigate(target.id);
  return (
    <>
      <a
        className={'ink-sb-row ink-sb-tree' + (selected ? ' is-selected' : '')}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={b.type === 'alias' ? undefined : expanded}
        data-block-id={id}
        href={'#/p/' + target?.id}
        draggable={false}
        onClick={(e) => { e.preventDefault(); open(); }}
        onContextMenu={(e) => { e.preventDefault(); openRowMenu(e.currentTarget, id, { x: e.clientX, y: e.clientY }); }}
      >
        <span className="ink-sb-indent" style={{ width: level * 8 }} />
        <span className="ink-sb-icon ink-sb-tree-icon">
          <span className="ink-sb-icon-glyph"><PageIcon block={b} size={20} emojiSize={b.type === 'alias' ? 15 : 15} /></span>
          {b.type !== 'alias' && (
            <span className="ink-sb-disclosure" role="button" aria-label="toggle" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(expandedKey, !expanded); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} aria-hidden><path d="M4.4 2.6L7.8 6l-3.4 3.4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          )}
        </span>
        <span className="ink-sb-label">{renaming ? '' : pageTitle(b)}</span>
        <span className="ink-sb-row-actions">
          {b.type !== 'alias' && target?.type === 'page' && (
            <span className="ink-sb-action" role="button" {...tip(t('sidebar.addPageInside'))} onClick={(e) => { e.preventDefault(); e.stopPropagation(); createPage(target.id); setExpanded(expandedKey, true); }}><Icon name="plus" size={16} stroke={1.8} /></span>
          )}
          <span className="ink-sb-action" role="button" {...tip(t('sidebar.more'))} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRowMenu(e.currentTarget, id); }}><Icon name="more" size={16} stroke={2} /></span>
        </span>
      </a>
      {expanded && b.type !== 'alias' && (
        kids.length
          ? kids.map((k) => <TreeRow key={k.id} id={k.id} level={level + 1} keyPrefix={keyPrefix} />)
          : <div className="ink-sb-empty" style={{ paddingLeft: 8 + (level + 1) * 8 + 30 }}>{t('sidebar.noPages')}</div>
      )}
    </>
  );
}

function PromoCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="ink-sb-promo">
      <div className="ink-sb-promo-art" aria-hidden>
        <svg width="96" height="48" viewBox="0 0 72 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="26" height="20" rx="4" /><rect x="40" y="6" width="28" height="24" rx="4" fill="currentColor" fillOpacity=".08" />
          <path d="M10 18h14M10 23h9M46 14h16M46 19h10" /><path d="M32 20h6m-2-2 2 2-2 2" />
        </svg>
        <span className="ink-sb-promo-x" role="button" onClick={onClose}><Icon name="x" size={14} stroke={2} /></span>
      </div>
      <div className="ink-sb-promo-title">{t('sidebar.promo.title')}</div>
      <div className="ink-sb-promo-body">{t('sidebar.promo.body')}</div>
      <div className="ink-sb-promo-cta">{t('sidebar.promo.cta')} <Icon name="arrowRight" size={12} stroke={2} /></div>
    </div>
  );
}

function Resizer() {
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = getUi().sidebarWidth;
    let moved = false;
    setUi({ sidebarResizing: true });
    const move = (ev: PointerEvent) => { if (Math.abs(ev.clientX - startX) > 2) moved = true; setSidebarWidth(startW + ev.clientX - startX); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setUi({ sidebarResizing: false });
      if (!moved) toggleSidebar(); else commitSidebarWidth();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return <div className="ink-sb-resizer" onPointerDown={onDown} onDoubleClick={() => { setSidebarWidth(270); commitSidebarWidth(); }} {...tip(<><div>{t('sidebar.resize')}</div><div className="ink-tooltip-sub">{t('sidebar.resizeClick')}</div></>, '⌘\\', 'right-start')}><div className="ink-sb-resizer-line" /></div>;
}

/** Hover-peek: when the sidebar is closed, approaching the left edge slides in a floating copy. */
export function SidebarPeek() {
  const open = useUi((s) => s.sidebarOpen);
  const peek = useUi((s) => s.peek);
  const hideTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (open) return;
    const onMove = (e: MouseEvent) => {
      const s = getUi();
      if (!s.peek && e.clientX <= 12 && e.clientY > 44) { clearTimeout(hideTimer.current); setUi({ peek: true }); }
      else if (s.peek) {
        const el = document.querySelector('.ink-sidebar.is-floating');
        const inside = el && e.clientX <= el.getBoundingClientRect().right + 8 && !!el;
        const inMenu = (e.target as HTMLElement).closest?.('[data-popover-id]');
        if (!inside && !inMenu) { if (hideTimer.current === undefined) hideTimer.current = window.setTimeout(() => { hideTimer.current = undefined; setUi({ peek: false }); }, 300); }
        else { clearTimeout(hideTimer.current); hideTimer.current = undefined; }
      }
    };
    const onLeave = () => { if (getUi().peek) hideTimer.current = window.setTimeout(() => { hideTimer.current = undefined; setUi({ peek: false }); }, 300); };
    window.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => { window.removeEventListener('mousemove', onMove); document.documentElement.removeEventListener('mouseleave', onLeave); };
  }, [open]);
  if (open) return null;
  return <div className={'ink-sb-peek' + (peek ? ' is-visible' : '')}><Sidebar floating /></div>;
}
