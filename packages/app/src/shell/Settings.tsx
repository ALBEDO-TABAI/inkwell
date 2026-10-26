import { useState, type ReactNode } from 'react';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { store } from '../store/store';
import { Icon, type IconName } from '../ui/icons';
import { openPopover } from '../ui/overlay';
import { openMenu, Switch } from '../ui/menu';
import { useUi, setTheme, setUi } from '../app/state';
import { kvPut } from '../store/persistence';
import { Avatar } from './MenuFooter';

type Pane = 'account' | 'prefs' | 'notifications' | 'mailcal' | 'general' | 'people' | 'sidebar' | 'import';

export function openSettings(pane: Pane = 'prefs') {
  openPopover({ id: 'settings', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', modal: true, className: 'ink-settings-pop', render: (close) => <Settings initial={pane} close={close} /> });
}

function Settings({ initial, close }: { initial: Pane; close: () => void }) {
  const [pane, setPane] = useState<Pane>(initial);
  const u = store.users.get(store.currentUser)!;
  const Nav = ({ id, icon, label }: { id: Pane; icon: IconName | ReactNode; label: string }) => (
    <div className={'ink-set-nav-item' + (pane === id ? ' is-active' : '')} role="button" onClick={() => setPane(id)}>
      <span className="ink-set-nav-icon">{typeof icon === 'string' ? <Icon name={icon as IconName} size={16} stroke={1.7} /> : icon}</span>{label}
    </div>
  );
  return (
    <div className="ink-settings" role="dialog" tabIndex={-1} data-autofocus>
      <div className="ink-set-nav">
        <div className="ink-set-search"><Icon name="search" size={14} stroke={1.8} /><span>{t('set.search')}</span></div>
        <div className="ink-set-nav-label">{t('set.account')}</div>
        <Nav id="account" icon={<Avatar size={18} />} label={u.name} />
        <Nav id="prefs" icon="sliders" label={t('set.prefs')} />
        <Nav id="notifications" icon="bell" label={t('set.notifications')} />
        <Nav id="mailcal" icon="mail" label={t('set.mailCal')} />
        <div className="ink-set-nav-label">{t('set.workspace')}</div>
        <Nav id="general" icon="settings" label={t('set.general')} />
        <Nav id="people" icon="users" label={t('set.people')} />
        <Nav id="sidebar" icon="sidebar" label={t('set.sidebar')} />
        <Nav id="import" icon="download" label={t('set.import')} />
      </div>
      <div className="ink-set-main">
        <span className="ink-set-close" role="button" onClick={close}><Icon name="x" size={16} stroke={1.8} /></span>
        <div className="ink-set-content">
          {pane === 'prefs' ? <Prefs /> : pane === 'account' ? <Account /> : <Placeholder title={paneTitle(pane)} />}
        </div>
      </div>
    </div>
  );
}
const paneTitle = (p: Pane) => ({ account: t('set.account'), prefs: t('set.prefs'), notifications: t('set.notifications'), mailcal: t('set.mailCal'), general: t('set.general'), people: t('set.people'), sidebar: t('set.sidebar'), import: t('set.import') }[p]);

function Placeholder({ title }: { title: string }) {
  return <><h1 className="ink-set-h1">{title}</h1><p className="ink-set-sub">{t('set.placeholder')}</p></>;
}
function Account() {
  const u = store.users.get(store.currentUser)!;
  return (
    <>
      <h1 className="ink-set-h1">{t('set.account')}</h1>
      <div className="ink-set-section">档案</div>
      <div className="ink-set-profile"><Avatar size={48} /><div><div className="ink-set-row-desc">偏好名称</div><input className="ink-input" defaultValue={u.name} /></div></div>
      <div className="ink-set-section">帐号安全</div>
      <Row title="邮件地址" desc={u.email}><button className="ink-btn">管理电子邮件地址</button></Row>
    </>
  );
}
function Row({ title, desc, children, badge }: { title: string; desc?: string; children?: ReactNode; badge?: string }) {
  return (
    <div className="ink-set-row">
      <div className="ink-set-row-text"><div className="ink-set-row-title">{title}{badge && <span className="ink-badge">{badge}</span>}</div>{desc && <div className="ink-set-row-desc">{desc}</div>}</div>
      <div>{children}</div>
    </div>
  );
}
function Select({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  const cur = options.find((o) => o.v === value);
  return (
    <span className="ink-select" role="button" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 220, groups: [options.map((o) => ({ id: o.v, label: o.label, checked: o.v === value, onSelect: () => onChange(o.v) }))] }, { anchorEl: e.currentTarget, parent: 'settings', placement: 'bottom-end' })}>
      {cur?.label}<Icon name="chevronDown" size={12} stroke={2} />
    </span>
  );
}
function Prefs() {
  const theme = useUi((s) => s.theme);
  const hc = useUi((s) => s.highContrast);
  const [, force] = useState(0);
  return (
    <>
      <h1 className="ink-set-h1">{t('set.prefs')}</h1>
      <p className="ink-set-sub">{t('set.prefs.desc')}</p>
      <div className="ink-set-section">{t('set.appearance')}</div>
      <Row title={t('set.appearance')} desc={t('set.appearance.desc')}>
        <Select value={theme} options={[{ v: 'light', label: t('set.light') }, { v: 'dark', label: t('set.dark') }, { v: 'system', label: t('set.system') }]} onChange={(v) => setTheme(v as any)} />
      </Row>
      <Row title={t('set.highContrast')} badge={t('set.beta')} desc={t('set.highContrast.desc')}>
        <Select value={hc ? 'on' : 'off'} options={[{ v: 'off', label: t('set.off') }, { v: 'on', label: t('set.on') }]} onChange={(v) => { setUi({ highContrast: v === 'on' }); kvPut('highContrast', v === 'on'); }} />
      </Row>
      <div className="ink-set-section">{t('set.input')}</div>
      <Row title="使用 Enter 键开始新的一行" desc="适用于对话、评论和其他输入字段。"><Switch on={false} /></Row>
      <div className="ink-set-section">{t('set.langTime')}</div>
      <Row title={t('set.language')} desc={t('set.language.desc')}>
        <Select value={getLocale()} options={[{ v: 'zh-CN', label: '简体中文' }, { v: 'en', label: 'English' }]} onChange={(v) => { setLocale(v as Locale); force((x) => x + 1); }} />
      </Row>
      <Row title={t('set.numberFormat')}><Select value="default" options={[{ v: 'default', label: t('set.default') }]} onChange={() => {}} /></Row>
      <Row title={t('set.startWeek')} desc={t('set.startWeek.desc')}><Switch on={false} /></Row>
    </>
  );
}
