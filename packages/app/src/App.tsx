import { useEffect, useState } from 'react';
import { useUi, toggleSidebar, cycleTheme, setTheme, goBack, goForward, getUi, onNavigate, navigate } from './app/state';
import { Sidebar, SidebarPeek } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { PageView } from './page/PageView';
import { OverlayHost, isPopoverOpen } from './ui/overlay';
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
  useEffect(() => onLocaleChange(() => force((n) => n + 1)), []);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.metaKey || e.ctrlKey;
      if (!m) return;
      const k = e.key.toLowerCase();
      if (k === '\\') { e.preventDefault(); toggleSidebar(); return; }
      if (e.shiftKey && k === 'l') { e.preventDefault(); cycleTheme(); return; }
      if ((k === 'k' || k === 'p') && !e.shiftKey && !e.altKey) {
        if (e.defaultPrevented) return; // handled by the editor (Cmd+K link)
        const inText = (e.target as HTMLElement).closest?.('[contenteditable="true"]');
        const sel = getSelection();
        if (k === 'k' && inText && sel && !sel.isCollapsed) return; // link popover
        e.preventDefault(); openSearch(); return;
      }
      if (k === '[' && !e.shiftKey) { e.preventDefault(); goBack(); return; }
      if (k === ']' && !e.shiftKey) { e.preventDefault(); goForward(); return; }
      if (k === ',' ) { e.preventDefault(); openSettings(); return; }
      if (k === 'n' && !e.shiftKey && !window.inkwellNative) { e.preventDefault(); createPage('private'); return; }
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
    const off3 = onShellCommand((cmd) => {
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
  const theme = useUi((s) => s.resolvedTheme);
  useEffect(() => { shellSend('inkwell:theme-changed', { theme }); }, [theme]);

  return (
    <div className={'ink-app' + (resizing ? ' is-resizing' : '') + (sidebarOpen ? ' sb-open' : ' sb-closed')}>
      {sidebarOpen ? <Sidebar /> : <SidebarPeek />}
      <main className="ink-main">
        <Topbar pageId={pageId} />
        <PageView key={pageId} pageId={pageId} />
      </main>
      <OverlayHost />
      <ToastHost />
    </div>
  );
}
