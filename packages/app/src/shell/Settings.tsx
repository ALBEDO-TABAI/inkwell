import { useState, type ReactNode } from 'react';
import { t, getLocale, setLocale, type Locale } from '../i18n';
import { store } from '../store/store';
import { Icon, type IconName } from '../ui/icons';
import { openPopover } from '../ui/overlay';
import { openMenu, Switch } from '../ui/menu';
import { useUi, setTheme, setUi } from '../app/state';
import { kvPut, kvGet } from '../store/persistence';
import { BRAND } from '@shared/brand';
import { Avatar } from './MenuFooter';

type Pane = 'account' | 'prefs' | 'notifications' | 'mailcal' | 'general' | 'people' | 'sidebar' | 'import' | 'emoji' | 'offline' | 'developer';

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
        <div className="ink-set-nav-label">{t('set.features')}</div>
        <Nav id="emoji" icon="smile" label={t('set.emoji')} />
        <Nav id="offline" icon="download" label={t('set.offline')} />
        <Nav id="developer" icon="codeTag" label={t('set.developer')} />
      </div>
      <div className="ink-set-main">
        <span className="ink-set-close" role="button" onClick={close}><Icon name="x" size={16} stroke={1.8} /></span>
        <div className="ink-set-content">
          {pane === 'prefs' ? <Prefs /> : pane === 'account' ? <Account /> : pane === 'notifications' ? <Notifications /> : pane === 'mailcal' ? <MailCal /> : pane === 'general' ? <General /> : pane === 'people' ? <People /> : pane === 'sidebar' ? <SidebarPane /> : pane === 'import' ? <ImportPane /> : pane === 'emoji' ? <EmojiPane /> : pane === 'offline' ? <OfflinePane /> : pane === 'developer' ? <DeveloperPane /> : <Placeholder title={paneTitle(pane)} />}
        </div>
      </div>
    </div>
  );
}
const paneTitle = (p: Pane) => ({ account: t('set.account'), prefs: t('set.prefs'), notifications: t('set.notifications'), mailcal: t('set.mailCal'), general: t('set.general'), people: t('set.people'), sidebar: t('set.sidebar'), import: t('set.import'), emoji: t('set.emoji'), offline: t('set.offline'), developer: t('set.developer') }[p]);

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
      <KvToggle k="enterNewline" title={t('set.enterNewline')} desc={t('set.enterNewline.desc')} def={false} />
      <div className="ink-set-section">{t('set.langTime')}</div>
      <Row title={t('set.language')} desc={t('set.language.desc')}>
        <Select value={getLocale()} options={[{ v: 'zh-CN', label: '简体中文' }, { v: 'zh-TW', label: '繁體中文' }, { v: 'en', label: 'English' }]} onChange={(v) => { setLocale(v as Locale); force((x) => x + 1); }} />
      </Row>
      <Row title={t('set.numberFormat')}><Select value="default" options={[{ v: 'default', label: t('set.default') }]} onChange={() => {}} /></Row>
      <KvToggle k="weekStartsMonday" title={t('set.startWeek')} desc={t('set.startWeek.desc')} def={false} />
      <div className="ink-set-section">{t('set.desktop')}</div>
      <Row title={t('set.openOnStart')} desc={t('set.openOnStart.desc')}><KvSelect k="openOnStart" def="last" options={[{ v: 'last', label: t('set.lastVisited') }, { v: 'home', label: t('set.home') }]} /></Row>
      <KvToggle k="openLinksInApp" title={t('set.openLinksInApp')} desc={t('set.openLinksInApp.desc')} def={true} />
      <Row title={t('set.zoom')} desc={t('set.zoom.desc')}><span className="ink-set-kbd"><kbd className="ink-kbd">⌘ +</kbd><kbd className="ink-kbd">⌘ -</kbd><kbd className="ink-kbd">⌘ 0</kbd></span></Row>
    </>
  );
}

function KvToggle({ k, title, desc, def, onChange }: { k: string; title: string; desc?: string; def: boolean; onChange?: (v: boolean) => void }) {
  const [v, setV] = useState(() => kvGet(k, def));
  return <Row title={title} desc={desc}><span data-kv={k} style={{ display: 'flex' }}><Switch on={v} onChange={(n) => { setV(n); kvPut(k, n); onChange?.(n); }} /></span></Row>;
}
function KvSelect({ k, def, options }: { k: string; def: string; options: { v: string; label: string }[] }) {
  const [v, setV] = useState(() => kvGet(k, def));
  return <Select value={v} options={options} onChange={(n) => { setV(n); kvPut(k, n); }} />;
}
function Head({ title, sub }: { title: string; sub?: string }) { return <><h1 className="ink-set-h1">{title}</h1>{sub && <p className="ink-set-sub">{sub}</p>}</>; }
function Notifications() {
  return (
    <>
      <Head title={t('set.notifications')} sub={t('set.notif.sub')} />
      <div className="ink-set-section">{t('set.notif.push')}</div>
      <KvToggle k="pushComments" title={t('set.notif.comments')} desc={t('set.notif.comments.desc')} def={true} />
      <KvToggle k="pushReminders" title={t('set.notif.reminders')} desc={t('set.notif.reminders.desc')} def={true} />
      <KvToggle k="badgeEnabled" title={t('set.notif.badge')} desc={t('set.notif.badge.desc')} def={true} onChange={() => void import('../app/reminders').then((m) => m.__plan())} />
      <Row title={t('set.notif.test')} desc={t('set.notif.test.desc')}><button className="ink-btn" onClick={() => void import('../app/reminders').then((m) => m.testNotification())}>{t('set.notif.testBtn')}</button></Row>
      <div className="ink-set-section">{t('set.notif.inApp')}</div>
      <KvToggle k="inAppReminders" title={t('set.notif.inAppReminders')} desc={t('set.notif.inAppReminders.desc')} def={true} />
    </>
  );
}
function MailCal() {
  return (
    <>
      <Head title={t('set.mailCal')} sub={t('set.mailCal.sub')} />
      <div className="ink-set-section">{t('set.calendar')}</div>
      <KvToggle k="weekStartsMonday" title={t('set.startWeek')} desc={t('set.startWeek.desc')} def={false} />
      <Row title={t('set.defaultReminder')} desc={t('set.defaultReminder.desc')}><KvSelect k="defaultRemind" def="none" options={[{ v: 'none', label: '无' }, { v: '0', label: '事件发生时' }, { v: '15', label: '提前 15 分钟' }, { v: '60', label: '提前 1 小时' }, { v: '1440', label: '提前 1 天' }]} /></Row>
      <div className="ink-set-note">{t('set.localOnly')}</div>
    </>
  );
}
function General() {
  const [name, setName] = useState(store.space.name);
  return (
    <>
      <Head title={t('set.general')} />
      <div className="ink-set-section">{t('set.workspaceSettings')}</div>
      <Row title={t('set.wsName')} desc={t('set.wsName.desc')}><input className="ink-input ink-set-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== store.space.name) store.transact('rename workspace', (tx) => tx.space((s) => ({ ...s, name: name.trim() }))); }} /></Row>
      <div className="ink-set-section">{t('set.export')}</div>
      <Row title={t('set.exportAll')} desc={t('set.exportAll.desc')}><button className="ink-btn" onClick={() => void import('../app/io').then((m) => m.exportWorkspace())}>{t('set.exportBtn')}</button></Row>
      <div className="ink-set-section">{t('set.updates')}</div>
      <UpdateRow />
      <div className="ink-set-section">{t('set.danger')}</div>
      <Row title={t('set.deleteWs')} desc={t('set.deleteWs.desc')}><button className="ink-btn ink-btn-danger" disabled>{t('set.deleteWsBtn')}</button></Row>
    </>
  );
}
function UpdateRow() {
  const [st, setSt] = useState<string>('');
  const check = async () => {
    setSt(t('set.checking'));
    const n = (window as unknown as { inkwellNative?: { invoke?: (c: string) => Promise<{ current: string }> } }).inkwellNative;
    const r = n?.invoke ? await n.invoke('inkwell:check-updates') : { current: BRAND.version };
    setTimeout(() => setSt(t('set.upToDate', { v: r.current })), 400);
  };
  return <Row title={t('set.version', { v: BRAND.version })} desc={st || t('set.updates.desc')}><button className="ink-btn" onClick={check}>{t('set.checkUpdates')}</button></Row>;
}
function People() {
  const users = [...store.users.values()];
  return (
    <>
      <Head title={t('set.people')} sub={t('set.people.sub')} />
      <div className="ink-set-section">{t('set.members', { n: users.length })}</div>
      <div className="ink-set-table">
        <div className="ink-set-trow is-head"><span>{t('set.user')}</span><span>{t('set.role')}</span></div>
        {users.map((u) => <div key={u.id} className="ink-set-trow"><span className="ink-set-user"><span className="ink-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.avatar}</span><span><div>{u.name}{u.id === store.currentUser ? ' ' + t('share.you') : ''}</div><div className="ink-muted ink-small">{u.email}</div></span></span><span className="ink-muted">{u.id === store.currentUser ? t('set.owner') : t('set.member')}</span></div>)}
      </div>
    </>
  );
}
function SidebarPane() {
  return (
    <>
      <Head title={t('set.sidebar')} sub={t('set.sidebar.sub')} />
      <div className="ink-set-section">{t('set.sidebar.sections')}</div>
      <KvToggle k="sbShowAgenda" title={t('set.sidebar.agenda')} def={true} onChange={() => window.dispatchEvent(new Event('ink-sb-prefs'))} />
      <KvToggle k="sbShowTeam" title={t('set.sidebar.team')} def={true} onChange={() => window.dispatchEvent(new Event('ink-sb-prefs'))} />
      <KvToggle k="sbShowFavorites" title={t('set.sidebar.favorites')} def={true} onChange={() => window.dispatchEvent(new Event('ink-sb-prefs'))} />
    </>
  );
}
function ImportPane() {
  return (
    <>
      <Head title={t('set.import')} sub={t('set.import.sub')} />
      <div className="ink-set-import-grid">
        {[['Markdown', '.md'], ['HTML', '.html'], [t('set.textFile'), '.txt']].map(([label, ext]) => (
          <button key={ext} className="ink-set-import-card" onClick={() => void import('../app/io').then((m) => m.pickAndImport())}><Icon name="page" size={20} /><span>{label}</span><span className="ink-muted ink-small">{ext}</span></button>
        ))}
      </div>
      <div className="ink-set-note">{t('set.import.note')}</div>
    </>
  );
}
function EmojiPane() {
  return (
    <>
      <Head title={t('set.emoji')} sub={t('set.emoji.sub')} />
      <Row title={t('set.emoji.reset')} desc={t('set.emoji.reset.desc')}><button className="ink-btn" onClick={() => { kvPut('emojiUsage', {}); kvPut('recentEmoji', []); }}>{t('set.reset')}</button></Row>
    </>
  );
}
function OfflinePane() {
  return (
    <>
      <Head title={t('set.offline')} sub={t('set.offline.sub')} />
      <Row title={t('set.offline.all')} desc={t('set.offline.all.desc')}><Switch on={true} /></Row>
    </>
  );
}
function DeveloperPane() {
  const n = (window as unknown as { inkwellNative?: { platform?: string } }).inkwellNative;
  return (
    <>
      <Head title={t('set.developer')} />
      <Row title={t('set.dev.version')} desc={`${BRAND.name} ${BRAND.version} · ${n?.platform || 'web'} · ${navigator.userAgent.match(/Electron\/[\d.]+|Chrome\/[\d.]+/)?.[0] || ''}`} />
      <Row title={t('set.dev.blocks')} desc={String(store.blocks.size)} />
      <Row title={t('set.dev.deeplink')} desc={`${BRAND.scheme}://page/<id>`} />
    </>
  );
}
