import { t } from '../i18n';
import { store } from '../store/store';
import { Icon } from '../ui/icons';
import { openPopover } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { openSettings } from './Settings';

export function openWorkspaceSwitcher(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  el.classList.add('is-open');
  openPopover({
    id: 'ws-switcher', anchor: { left: r.left - 2, right: r.right, top: r.top, bottom: r.top }, placement: 'top-start', offset: 4,
    onClose: () => el.classList.remove('is-open'),
    render: (close) => <Switcher close={close} />,
  });
}

function Switcher({ close }: { close: () => void }) {
  const u = store.users.get(store.currentUser)!;
  const s = store.space;
  const Item = ({ icon, label, accent, onClick, right }: { icon?: React.ReactNode; label: string; accent?: boolean; onClick?: () => void; right?: React.ReactNode }) => (
    <div className={'ink-menu-item ink-ws-item' + (accent ? ' is-accent' : '')} role="option" onClick={() => { onClick?.(); }}>
      {icon && <span className="ink-menu-icon">{icon}</span>}<span className="ink-menu-text">{label}</span>{right}
    </div>
  );
  return (
    <div className="ink-menu ink-ws-menu" style={{ width: 300 }} tabIndex={-1} data-autofocus>
      <div className="ink-menu-group">
        <div className="ink-ws-email">
          <span>{u.email}</span>
          <span className="ink-ws-email-more" role="button" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 220, groups: [[{ id: 'logout', label: t('ws.logout'), icon: 'logout' }]] }, { anchorEl: e.currentTarget, parent: 'ws-switcher' })}><Icon name="more" size={16} stroke={2} /></span>
        </div>
        <Item icon={<span className="ink-ws-icon ink-ws-icon-sm">{s.icon}</span>} label={s.name} right={<span className="ink-menu-check"><Icon name="check" size={16} stroke={2} /></span>} onClick={close} />
        <Item icon={<Icon name="plus" size={16} stroke={2} />} label={t('ws.newWorkspace')} accent />
      </div>
      <div className="ink-menu-divider" />
      <div className="ink-menu-group">
        <Item icon={<Icon name="settings" size={16} stroke={1.8} />} label={t('ws.settings')} onClick={() => { close(); openSettings(); }} />
        <Item icon={<Icon name="mail" size={16} stroke={1.8} />} label={t('ws.invite')} />
        <Item icon={<Icon name="upgrade" size={16} stroke={1.8} />} label={t('ws.upgrade')} accent />
      </div>
      <div className="ink-menu-divider" />
      <div className="ink-menu-group">
        <Item icon={<Icon name="addUser" size={16} stroke={1.8} />} label={t('ws.addAccount')} />
        <Item icon={<Icon name="logout" size={16} stroke={1.8} />} label={t('ws.logout')} />
      </div>
    </div>
  );
}
