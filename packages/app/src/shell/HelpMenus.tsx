/** Sidebar footer menus: help (？) with release notes + 更多 submenu, the library (apps) menu, and the keyboard-shortcuts modal. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import { BRAND } from '@shared/brand';
import { openMenu, type MenuSpec } from '../ui/menu';
import { openPopover } from '../ui/overlay';
import { Icon, type IconName } from '../ui/icons';
import { toast } from '../ui/toast';
import { openTrash } from './Trash';
import { relTime } from './Search';
import { store } from '../store/store';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const BUILT = Number(import.meta.env.VITE_BUILD_TIME || 0) || Date.now() - 8 * 3600_000;

const NOTES = [
  { v: '评论、更新面板与分组设置', date: '2026-10-26' },
  { v: `${BRAND.name} 0.3`, date: '2026-10-25' },
  { v: `${BRAND.name} 0.2`, date: '2026-10-24' },
];

function ReleaseNotes() {
  return (
    <div className="ink-help-notes">
      {NOTES.map((n, i) => (
        <div key={n.v} className="ink-menu-item ink-help-note" role="button" onClick={() => toast(n.v + ' · ' + n.date)}>
          <span className="ink-help-rail"><span className="ink-help-dot" />{i < NOTES.length - 1 && <span className="ink-help-line" />}{i > 0 && <span className="ink-help-line is-up" />}</span>
          <span className="ink-help-note-text">{n.v}</span>
        </div>
      ))}
    </div>
  );
}

function moreSpec(): MenuSpec {
  return {
    width: 210,
    groups: [[
      { id: 'shortcuts', label: t('help.shortcuts'), shortcut: '⌘⌥/', onSelect: () => openShortcuts() },
      { id: 'x', label: t('help.x'), onSelect: () => toast(t('help.offline')) },
      { id: 'terms', label: t('help.terms'), onSelect: () => toast(t('help.offline')) },
      { id: 'status', label: t('help.status'), onSelect: () => toast(t('help.statusOk')) },
      { id: 'backup', label: t('help.backup'), onSelect: () => backup() },
      { id: 'cache', label: t('help.clearCache'), onSelect: () => { try { Object.keys(localStorage).filter((k) => k.startsWith('inkwell:history:')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } toast(t('help.cacheCleared')); } },
    ]],
    footer: <div className="ink-help-ver"><div>{BRAND.name} {BRAND.version}</div><div>{t('help.desktop')} {BRAND.version}</div><div>{t('help.updated', { ago: relTime(BUILT) })}</div></div>,
  };
}
function backup() {
  const data = JSON.stringify({ blocks: [...store.blocks.values()], space: store.space }, null, 1);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `${BRAND.slug}-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}

export function openHelpMenu(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  openMenu({ left: r.left - 1, right: r.left - 1, top: r.top, bottom: r.top }, {
    width: 260, className: 'ink-help-menu',
    groups: [
      [
        { id: 'docs', label: t('help.docs'), icon: 'bookOpen', onSelect: () => toast(t('help.offline')) },
        { id: 'support', label: t('help.support'), icon: 'messageSquare', onSelect: () => toast(t('help.offline')) },
        { id: 'more', label: t('help.more'), icon: 'more', sub: moreSpec },
      ],
      [
        { kind: 'label', label: t('help.whatsNew') },
        { kind: 'custom', key: 'notes', render: () => <ReleaseNotes /> },
        { id: 'all', label: t('help.allReleases'), icon: 'gift', onSelect: () => toast(t('help.offline')) },
      ],
    ],
  }, { placement: 'top-start', offset: 6, id: 'help-menu' });
}

export function openLibraryMenu(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  openMenu({ left: r.left - 11, right: r.left - 11, top: r.top, bottom: r.top }, {
    width: 240,
    groups: [[
      { id: 'library', label: t('lib.library'), icon: 'library', onSelect: () => toast(t('lib.soon')) },
      { id: 'ainotes', label: t('lib.aiNotes'), icon: 'aiNotes', onSelect: () => toast(t('lib.soon')) },
      { id: 'skills', label: t('lib.skills'), icon: 'filePen', onSelect: () => toast(t('lib.soon')) },
      { id: 'tasks', label: t('lib.tasks'), icon: 'squareCheck', onSelect: () => toast(t('lib.soon')) },
      { id: 'market', label: t('lib.market'), icon: 'storeFront', onSelect: () => toast(t('lib.soon')) },
      { id: 'trash', label: t('sidebar.trash'), icon: 'trash', onSelect: () => openTrash() },
    ]],
  }, { placement: 'top-start', offset: 6, id: 'library-menu' });
}

/* ---------------- keyboard shortcuts modal ---------------- */
type Row = [string, string[]];
const M = isMac ? 'Cmd' : 'Ctrl', O = isMac ? 'Option' : 'Alt';
export const SHORTCUTS: { id: string; icon: IconName; title: string; rows: Row[] }[] = [
  { id: 'popular', icon: 'star', title: '热门', rows: [
    ['在当前页面查找', [M, 'F']], ['打开搜索或跳转至最近查看过的页面', [M, 'P']], ['将链接添加到所选文本', [M, 'K']], ['拷贝页面 URL', [M, O, 'L']],
    ['返回一个页面', [M, '[']], ['向前一个页面', [M, ']']], ['切换深色模式', [M, 'Shift', 'L']], ['切换高对比度模式', [M, 'Shift', O, 'L']],
  ] },
  { id: 'desktop', icon: 'monitor', title: '桌面', rows: [
    ['新建窗口', [M, 'Shift', 'N']], ['新建标签页', [M, 'T']], ['关闭标签页', [M, 'W']], ['重新打开关闭的标签页', [M, 'Shift', 'T']], ['切换到第 1–9 个标签页', [M, '1…9']],
    ['快速搜索窗口', [M, 'Shift', 'K']], ['放大', [M, '+']], ['缩小', [M, '-']], ['重置缩放', [M, '0']], ['显示/隐藏侧边栏', [M, '\\']], ['打开设置', [M, ',']],
  ] },
  { id: 'create', icon: 'pencil', title: '创建和设计', rows: [
    ['新建页面', [M, 'N']], ['加粗', [M, 'B']], ['斜体', [M, 'I']], ['下划线', [M, 'U']], ['删除线', [M, 'Shift', 'S']], ['行内代码', [M, 'E']],
    ['行内公式', [M, 'Shift', 'E']], ['为所选文本添加评论', [M, 'Shift', 'M']], ['使用上次的颜色', [M, 'Shift', 'H']],
  ] },
  { id: 'edit', icon: 'copy', title: '编辑和移动', rows: [
    ['撤销', [M, 'Z']], ['重做', [M, 'Shift', 'Z']], ['复制所选块', [M, 'D']], ['上移所选块', [M, 'Shift', '↑']], ['下移所选块', [M, 'Shift', '↓']],
    ['缩进', ['Tab']], ['取消缩进', ['Shift', 'Tab']], ['选中当前块', ['Esc']], ['删除所选块', ['Del']], ['移动到…', [M, 'Shift', 'P']],
  ] },
  { id: 'markdown', icon: 'codeTag', title: 'Markdown', rows: [
    ['一级标题', ['#', 'Space']], ['二级标题', ['##', 'Space']], ['三级标题', ['###', 'Space']], ['项目符号列表', ['-', 'Space']], ['编号列表', ['1.', 'Space']],
    ['待办事项', ['[]']], ['折叠列表', ['>', 'Space']], ['引用', ['"', 'Space']], ['分割线', ['---']], ['代码块', ['```']], ['提及页面', ['[[']],
  ] },
  { id: 'more', icon: 'more', title: '更多…', rows: [
    ['打开键盘快捷键', [M, O, '/']], ['打开更新面板', [M, 'Shift', O, 'U']], ['打开评论面板', [M, 'Shift', O, 'M']], ['斜杠命令', ['/']], ['提及人员、页面或日期', ['@']],
  ] },
];

export function openShortcuts() {
  openPopover({ id: 'shortcuts', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', modal: true, className: 'ink-shortcuts-pop', render: (close) => <ShortcutsModal close={close} /> });
}
function ShortcutsModal({ close }: { close: () => void }) {
  const [active, setActive] = useState('popular');
  const [q, setQ] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => SHORTCUTS.map((s) => ({ ...s, rows: q ? s.rows.filter(([l, k]) => (l + k.join(' ')).toLowerCase().includes(q.toLowerCase())) : s.rows })).filter((s) => s.rows.length), [q]);
  useEffect(() => {
    const el = body.current; if (!el) return;
    const onScroll = () => { const top = el.scrollTop + 8; let cur = sections[0]?.id; for (const s of sections) { const h = el.querySelector<HTMLElement>(`[data-sc="${s.id}"]`); if (h && h.offsetTop - el.offsetTop <= top) cur = s.id; } if (cur) setActive(cur); };
    el.addEventListener('scroll', onScroll); return () => el.removeEventListener('scroll', onScroll);
  }, [sections]);
  const jump = (id: string) => { const el = body.current, h = el?.querySelector<HTMLElement>(`[data-sc="${id}"]`); if (el && h) el.scrollTo({ top: h.offsetTop - el.offsetTop, behavior: 'smooth' }); setActive(id); };
  return (
    <div className="ink-shortcuts" role="dialog" aria-label={t('help.shortcuts')} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (q !== null) setQ(null); else close(); } }}>
      <h1 className="ink-sc-title">{t('help.shortcuts')}</h1>
      <div className="ink-sc-tabs">
        {q === null ? SHORTCUTS.map((s) => (
          <span key={s.id} className={'ink-sc-tab' + (active === s.id ? ' is-active' : '')} role="tab" onClick={() => jump(s.id)}>{s.id !== 'more' && <Icon name={s.icon} size={14} />}{s.title}</span>
        )) : <input className="ink-sc-search" data-autofocus placeholder={t('help.searchShortcuts')} value={q} onChange={(e) => setQ(e.target.value)} />}
        <span style={{ flex: 1 }} />
        <span className="ink-sc-searchbtn" role="button" aria-label={t('help.searchShortcuts')} onClick={() => setQ(q === null ? '' : null)}><Icon name={q === null ? 'search' : 'x'} size={16} /></span>
      </div>
      <div className="ink-sc-body" ref={body}>
        {sections.map((s) => (
          <section key={s.id} data-sc={s.id}>
            <h2 className="ink-sc-h">{s.title.replace('…', '')}</h2>
            {s.rows.map(([label, keys]) => (
              <div key={label} className="ink-sc-row"><span>{label}</span><span className="ink-sc-keys">{keys.map((k, i) => <kbd key={i} className="ink-kbd">{k}</kbd>)}</span></div>
            ))}
          </section>
        ))}
        {!sections.length && <div className="ink-sc-empty">{t('search.noResults')}</div>}
      </div>
    </div>
  );
}
