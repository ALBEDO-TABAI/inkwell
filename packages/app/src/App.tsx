import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { setUi, useUi, toggleSidebar, cycleTheme, setTheme, goBack, goForward, getUi, onNavigate, navigate } from './app/state';
import { Sidebar, SidebarPeek } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { PageView } from './page/PageView';
import { OverlayHost, isPopoverOpen } from './ui/overlay';
import { PeekHost } from './shell/Peek';
import { FindBar, openFind } from './shell/FindBar';
import { RightPanel } from './shell/RightPanel';
import { openShortcuts } from './shell/HelpMenus';
import { commentOnSelection } from './comments/Comments';
import { activeEditable } from './editor/registry';
import { getSelectionOffsets } from './editor/caret';
import { startHistory } from './app/history';
import { startReminders } from './app/reminders';
import { kvPut } from './store/persistence';
import './editor/date-mention';
import { ToastHost } from './ui/toast';
import { openSearch } from './shell/Search';
import { openSettings } from './shell/Settings';
import { onLocaleChange } from './i18n';
import { store } from './store/store';
import { pageTitle, createPage } from './app/pages';
import { onShellCommand, shellSend } from './platform/bridge';
import { undo, redo } from './editor/keyboard';
import { copyPageLink } from './shell/RowMenu';

export function App() {
  const pageId = useUi((s) => s.pageId);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const sidebarWidth = useUi((s) => s.sidebarWidth);
  const resizing = useUi((s) => s.sidebarResizing);
  const [, force] = useState(0);
  useEffect(() => startHistory(), []);
  useEffect(() => startReminders(), []);
  useEffect(() => onLocaleChange(() => force((n) => n + 1)), []);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.metaKey || e.ctrlKey;
      if (!m) return;
      const k = e.key.toLowerCase();
      if (k === '\\') { e.preventDefault(); toggleSidebar(); return; }
      if (e.shiftKey && k === 'l' && !e.altKey) { e.preventDefault(); cycleTheme(); return; }
      if ((k === 'k' || k === 'p') && !e.shiftKey && !e.altKey) {
        if (e.defaultPrevented) return; // handled by the editor (Cmd+K link)
        const inText = (e.target as HTMLElement).closest?.('[contenteditable="true"]');
        const sel = getSelection();
        if (k === 'k' && inText && sel && !sel.isCollapsed) return; // link popover
        e.preventDefault(); openSearch(); return;
      }
      if (k === 'm' && e.shiftKey && !e.altKey) { const a = activeEditable(); const o = a && getSelectionOffsets(a.el); if (a && o && o.start !== o.end) { e.preventDefault(); commentOnSelection(a.id, o.start, o.end); } return; }
      if (e.code === 'KeyU' && e.shiftKey && e.altKey) { e.preventDefault(); setUi({ rightPanel: getUi().rightPanel === 'updates' ? null : 'updates' }); return; }
      if ((k === '/' || e.code === 'Slash') && e.altKey && !e.shiftKey) { e.preventDefault(); openShortcuts(); return; }
      if (e.code === 'KeyM' && e.shiftKey && e.altKey) { e.preventDefault(); setUi({ rightPanel: getUi().rightPanel === 'comments' ? null : 'comments' }); return; }
      if (e.code === 'KeyL' && e.shiftKey && e.altKey) { e.preventDefault(); const v = !getUi().highContrast; setUi({ highContrast: v }); kvPut('highContrast', v); return; }
      if (k === 'f' && !e.shiftKey && !e.altKey) { e.preventDefault(); openFind(); return; }
      if (k === '[' && !e.shiftKey) { e.preventDefault(); goBack(); return; }
      if (k === ']' && !e.shiftKey) { e.preventDefault(); goForward(); return; }
      if (k === ',' ) { e.preventDefault(); openSettings(); return; }
      if (/^[1-9]$/.test(k) && !e.shiftKey && !e.altKey && window.inkwellNative) { e.preventDefault(); shellSend('inkwell:tab-index', { n: Number(k) }); return; } // normally caught by the main process first
      if (k === 'n' && !e.shiftKey) { e.preventDefault(); createPage('private'); return; }
      if (k === 'l' && e.altKey) { e.preventDefault(); copyPageLink(getUi().pageId); return; }
      if (k === 'z' && !(e.target as HTMLElement).closest?.('[contenteditable="true"], input, textarea') && !isPopoverOpen()) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // shell bridge: report state, accept commands
  useEffect(() => {
    const report = () => {
      const s = getUi(); const p = store.get(s.pageId);
      const title = p ? pageTitle(p) : '';
      document.title = title;
      shellSend('inkwell:nav-state', { pageId: s.pageId, title, icon: p?.format?.page_icon && !p.format.page_icon.startsWith('icon:') ? p.format.page_icon : '', canGoBack: s.back.length > 0, canGoForward: s.forward.length > 0 });
    };
    report();
    const off1 = onNavigate(report);
    const off2 = store.subscribe(() => { const p = store.get(getUi().pageId); if (p && document.title !== pageTitle(p)) report(); });
    const off3 = onShellCommand((cmd, arg) => {
      if (cmd === 'navigate' && typeof arg === 'string') { navigate(arg); return; }
      if (cmd === 'copy-title') { const p = store.get(getUi().pageId); navigator.clipboard?.writeText(p ? pageTitle(p) : '').catch(() => {}); return; }
      if (cmd === 'back') goBack(); else if (cmd === 'forward') goForward();
      else if (cmd === 'toggle-sidebar') toggleSidebar();
      else if (cmd === 'search') openSearch();
      else if (cmd === 'new-page') createPage('private');
      else if (cmd === 'toggle-theme') cycleTheme();
      else if (cmd === 'theme-light') setTheme('light'); else if (cmd === 'theme-dark') setTheme('dark'); else if (cmd === 'theme-system') setTheme('system');
      else if (cmd === 'undo') undo(); else if (cmd === 'redo') redo();
      else if (cmd === 'settings') openSettings();
      else if (cmd === 'copy-link') copyPageLink(getUi().pageId);
    });
    const onHash = () => { const m = location.hash.match(/^#\/p\/(.+)$/); if (m && m[1] !== getUi().pageId) navigate(m[1]); };
    window.addEventListener('hashchange', onHash);
    return () => { off1(); off2(); off3(); window.removeEventListener('hashchange', onHash); };
  }, []);
  useEffect(() => { shellSend('inkwell:sidebar-state', { open: sidebarOpen, width: sidebarWidth }); }, [sidebarOpen, sidebarWidth]);
  // a tab the user just opened (+ / Cmd+T) shows the "open in new tab…" palette, like the reference app
  useEffect(() => { const q = new URLSearchParams(location.search); if (q.get("newtab") === "1") { openSearch({ newTab: true }); history.replaceState(null, "", location.pathname + location.search.replace(/[?&]newtab=1/, (m) => (m[0] === "?" ? "?" : "")).replace("?&", "?") + location.hash); } }, []);
  const theme = useUi((s) => s.resolvedTheme);
  useEffect(() => { shellSend('inkwell:theme-changed', { theme }); }, [theme]);
  // sidebar collapse / expand animates its width (the content inside keeps its own width and is clipped)
  const [sbAnim, setSbAnim] = useState<null | 'opening' | 'closing'>(null);
  const prevOpen = useRef(sidebarOpen);
  useLayoutEffect(() => {
    if (prevOpen.current === sidebarOpen) return;
    prevOpen.current = sidebarOpen;
    // opening from the hover-peek is already on screen: no width animation
    setSbAnim(sidebarOpen ? (getUi().peek ? null : 'opening') : 'closing');
    const tm = window.setTimeout(() => setSbAnim(null), 1500);
    return () => clearTimeout(tm);
  }, [sidebarOpen]);

  return (
    <div className={'ink-app' + (resizing ? ' is-resizing' : '') + (sidebarOpen ? ' sb-open' : ' sb-closed')}>
      {sidebarOpen || sbAnim === 'closing' ? <div className={'ink-sb-shell' + (sbAnim ? ' is-' + sbAnim : '')} style={{ width: sidebarWidth }} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSbAnim(null); }}><Sidebar /></div> : null}
      {!sidebarOpen && sbAnim !== 'closing' && <SidebarPeek />}
      <main className="ink-main">
        <Topbar pageId={pageId} />
        <PageView key={pageId} pageId={pageId} />
      </main>
      <RightPanel />
      <PeekHost />
      <FindBar />
      <OverlayHost />
      <ToastHost />
    </div>
  );
}
