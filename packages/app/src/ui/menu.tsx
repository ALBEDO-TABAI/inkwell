import { t } from '../i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { openPopover, closePopover, type Anchor, type Placement } from './overlay';

export interface MenuItemSpec {
  kind?: 'item';
  id: string;
  label: ReactNode;
  /** plain text used for filtering (defaults to label if string) */
  text?: string;
  keywords?: string[];
  icon?: IconName | ReactNode;
  shortcut?: string;
  /** opens a submenu (spec factory) */
  sub?: () => MenuSpec;
  onSelect?: () => void;
  /** trailing checkmark */
  checked?: boolean;
  /** renders a switch on the right; value */
  toggle?: boolean;
  danger?: boolean;
  disabled?: boolean;
  right?: ReactNode;
  /** keep menu open after select */
  keepOpen?: boolean;
  accent?: boolean;
}
export interface MenuLabel { kind: 'label'; label: ReactNode }
export interface MenuCustom { kind: 'custom'; key: string; render: (close: () => void) => ReactNode }
export type MenuEntry = MenuItemSpec | MenuLabel | MenuCustom;
export interface MenuSpec {
  width?: number;
  search?: string;
  groups: MenuEntry[][];
  footer?: ReactNode;
  maxHeight?: number | string;
  /** as a submenu: centre vertically on the parent item instead of top-aligning */
  centered?: boolean;
  className?: string;
}

const isItem = (e: MenuEntry): e is MenuItemSpec => !e.kind || e.kind === 'item';

export function openMenu(anchor: Anchor | (() => Anchor), spec: MenuSpec | (() => MenuSpec), opts: { placement?: Placement; offset?: number; id?: string; parent?: string; onClose?: () => void; anchorEl?: HTMLElement } = {}) {
  const id = opts.id || 'menu-' + Math.random().toString(36).slice(2, 8);
  opts.anchorEl?.setAttribute('data-popover-anchor', id);
  opts.anchorEl?.classList.add('is-open');
  openPopover({
    id, anchor, placement: opts.placement || 'bottom-start', offset: opts.offset ?? 4, parent: opts.parent,
    onClose: () => { opts.anchorEl?.classList.remove('is-open'); opts.onClose?.(); },
    render: (close) => <Menu spec={typeof spec === 'function' ? spec() : spec} close={close} popId={id} />,
  });
  return id;
}

export function Menu({ spec, close, popId, closeAll, initialActive = -1 }: { spec: MenuSpec; close: () => void; popId: string; closeAll?: () => void; initialActive?: number }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(initialActive);
  const subRef = useRef<{ id: string; item: string } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const doCloseAll = closeAll || close;

  const groups = useMemo(() => {
    if (!q.trim()) return spec.groups;
    const s = q.trim().toLowerCase();
    const flat: MenuEntry[] = [];
    for (const g of spec.groups) for (const e of g) {
      if (!isItem(e)) continue;
      const hay = [(e.text ?? (typeof e.label === 'string' ? e.label : '')), ...(e.keywords || [])].join(' ').toLowerCase();
      if (hay.includes(s)) flat.push(e);
    }
    return [flat];
  }, [q, spec]);
  const items = groups.flat().filter(isItem).filter((i) => !i.disabled);

  const openSub = (it: MenuItemSpec, el: HTMLElement) => {
    if (subRef.current?.item === it.id) return;
    if (subRef.current) closePopover(subRef.current.id);
    if (!it.sub) { subRef.current = null; return; }
    const id = popId + '-sub';
    subRef.current = { id, item: it.id };
    const r = el.getBoundingClientRect();
    const subSpec = it.sub();
    openPopover({ id, parent: popId, anchor: subSpec.centered ? { left: r.left - 4, right: r.right + 4, top: r.top, bottom: r.bottom } : { left: r.left - 4, right: r.right + 4, top: r.top - 6, bottom: r.bottom }, placement: subSpec.centered ? 'right-center' : 'right-start', offset: 0, noFocus: false,
      onClose: () => { if (subRef.current?.id === id) subRef.current = null; el.classList.remove('is-sub-open'); },
      render: (c) => <Menu spec={subSpec} close={c} popId={id} closeAll={doCloseAll} initialActive={subSpec.centered ? 0 : -1} /> });
    el.classList.add('is-sub-open');
  };
  const select = (it: MenuItemSpec, el?: HTMLElement) => {
    if (it.disabled) return;
    if (it.sub) { if (el) openSub(it, el); return; }
    it.onSelect?.();
    if (!it.keepOpen && it.toggle === undefined) doCloseAll();
  };

  useEffect(() => {
    const el = root.current!;
    const onKey = (e: KeyboardEvent) => {
      const popEl = el.closest('[data-popover-id]');
      if (!popEl || !popEl.contains(document.activeElement)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => { const n = items.length; if (!n) return -1; return e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n; });
      } else if (e.key === 'Enter') {
        const it = items[active]; if (!it) return;
        e.preventDefault();
        select(it, el.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(it.id)}"]`) || undefined);
      } else if (e.key === 'ArrowRight') {
        const it = items[active];
        if (it?.sub) { e.preventDefault(); openSub(it, el.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(it.id)}"]`)!); }
      } else if (e.key === 'ArrowLeft' && popId.endsWith('-sub')) {
        e.preventDefault(); close();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    const it = items[active];
    if (it) root.current?.querySelector(`[data-item-id="${CSS.escape(it.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div ref={root} className={'ink-menu ' + (spec.className || '')} style={{ width: spec.width ?? 265 }} role="dialog" tabIndex={-1} data-autofocus={spec.search ? undefined : true}>
      {spec.search !== undefined && (
        <div className="ink-menu-search-wrap">
          <input className="ink-menu-search" data-autofocus placeholder={spec.search} value={q} onChange={(e) => { setQ(e.target.value); setActive(e.target.value ? 0 : -1); }} />
        </div>
      )}
      <div className="ink-menu-body" style={{ maxHeight: spec.maxHeight }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="ink-menu-divider" />}
            <div className="ink-menu-group">
              {g.map((e, ei) => {
                if (e.kind === 'label') return <div key={'l' + ei} className="ink-menu-label">{e.label}</div>;
                if (e.kind === 'custom') return <div key={e.key}>{e.render(doCloseAll)}</div>;
                const idx = items.indexOf(e);
                return (
                  <div
                    key={e.id}
                    data-item-id={e.id}
                    role="option"
                    aria-selected={idx === active}
                    className={'ink-menu-item' + (idx === active ? ' is-active' : '') + (e.danger ? ' is-danger' : '') + (e.disabled ? ' is-disabled' : '') + (e.accent ? ' is-accent' : '')}
                    onMouseMove={(ev) => {
                      if (idx !== active) setActive(idx);
                      const el = ev.currentTarget;
                      clearTimeout(hoverTimer.current);
                      hoverTimer.current = window.setTimeout(() => { if (el.matches(':hover')) openSub(e, el); }, e.sub ? 60 : 160);
                    }}
                    onMouseLeave={() => setActive(-1)}
                    onClick={(ev) => select(e, ev.currentTarget)}
                  >
                    {e.icon !== undefined && <span className="ink-menu-icon">{typeof e.icon === 'string' ? <Icon name={e.icon as IconName} size={20} /> : e.icon}</span>}
                    <span className="ink-menu-text">{e.label}</span>
                    {e.right}
                    {e.shortcut && <span className="ink-menu-sc">{e.shortcut}</span>}
                    {e.checked && <span className="ink-menu-check"><Icon name="check" size={16} /></span>}
                    {e.toggle !== undefined && <Switch on={e.toggle} />}
                    {e.sub && <span className="ink-menu-chev"><Icon name="chevronRight" size={16} /></span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {q && items.length === 0 && <div className="ink-menu-group"><div className="ink-menu-empty">{t('common.noResults')}</div></div>}
      </div>
      {spec.footer && <><div className="ink-menu-divider" /><div className="ink-menu-footer">{spec.footer}</div></>}
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <span className={'ink-switch' + (on ? ' is-on' : '')} role="switch" aria-checked={on} onClick={onChange ? (e) => { e.stopPropagation(); onChange(!on); } : undefined}>
      <span className="ink-switch-knob" />
    </span>
  );
}
