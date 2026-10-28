/** Browser window simulator: tab bar + one iframe per tab. Mirrors what the Electron main process does with WebContentsViews. */
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import '@tokens/tokens.css';
import './styles/app.css';
import './styles/db.css';
import './styles/tabbar.css';
import './styles/studio.css';
import { TabBar } from './shell/TabBar';
import type { TabState } from '@shared/ipc';
import { initMotion } from './app/motion';
initMotion();

interface SimTab extends TabState { canGoBack: boolean; canGoForward: boolean; hash: string }
const q = new URLSearchParams(location.search);
const pass = new URLSearchParams();
for (const k of ['theme', 'storage', 'lang', 'harness', 'promo', 'expand', 'idle', 'sidebarWidth', 'sidebar']) if (q.has(k)) pass.set(k, q.get(k)!);
const LS = 'inkwell.window.tabs';
let seq = 0;
const nid = () => 'tab-' + Date.now().toString(36) + '-' + (seq++);

function initialTabs(): SimTab[] {
  const n = Number(q.get('tabs') || 0);
  const page = q.get('page') || 'page-rea';
  if (n > 0) return Array.from({ length: n }, (_, i) => ({ id: nid(), title: '', url: '', hash: '#/p/' + page, active: i === n - 1, canGoBack: false, canGoForward: false }));
  try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (Array.isArray(s) && s.length && !q.has('fixture')) return s.map((x: SimTab) => ({ ...x, id: nid(), canGoBack: false, canGoForward: false })); } catch {}
  return [{ id: nid(), title: '', url: '', hash: q.get('page') ? '#/p/' + page : '', active: true, canGoBack: false, canGoForward: false }];
}

function Win() {
  const [tabs, setTabs] = useState<SimTab[]>(initialTabs);
  const [sb, setSb] = useState({ open: q.get('sidebar') !== 'closed', width: Number(q.get('sidebarWidth')) || 270 });
  const [theme, setTheme] = useState<'light' | 'dark'>(q.get('theme') === 'dark' ? 'dark' : 'light');
  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const firstLoad = useRef(true);
  const tabsRef = useRef(tabs); tabsRef.current = tabs;

  useEffect(() => { localStorage.setItem(LS, JSON.stringify(tabs.map(({ id, title, icon, hash, active }) => ({ id, title, icon, hash, active, url: '' })))); }, [tabs]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data || {}; const src = [...frames.current.entries()].find(([, f]) => f.contentWindow === e.source)?.[0];
      if (!src) return;
      if (d.type === 'inkwell:nav-state') setTabs((ts) => ts.map((x) => x.id === src ? { ...x, title: d.title, icon: d.icon, canGoBack: d.canGoBack, canGoForward: d.canGoForward, hash: '#/p/' + d.pageId } : x));
      else if (d.type === 'inkwell:sidebar-state') { if (tabsRef.current.find((x) => x.id === src)?.active) setSb({ open: d.open, width: d.width }); }
      else if (d.type === 'inkwell:theme-changed') setTheme(d.theme);
      else if (d.type === 'inkwell:new-tab') newTab(d.url);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  const active = tabs.find((x) => x.active) || tabs[0];
  const cmd = (id: string, c: string) => frames.current.get(id)?.contentWindow?.postMessage({ type: 'inkwell:command', cmd: c }, '*');
  const newTab = (hash = '') => setTabs((ts) => [...ts.map((x) => ({ ...x, active: false })), { id: nid(), title: '', url: '', hash, active: true, canGoBack: false, canGoForward: false }]);
  const close = (id: string) => setTabs((ts) => {
    if (ts.length === 1) return ts;
    const i = ts.findIndex((x) => x.id === id); const rest = ts.filter((x) => x.id !== id);
    if (ts[i].active) rest[Math.min(i, rest.length - 1)].active = true;
    return [...rest];
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 't') { e.preventDefault(); newTab(); }
      if (e.key === 'w') { e.preventDefault(); close(tabsRef.current.find((x) => x.active)!.id); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <div className="ink-window">
      <TabBar
        tabs={tabs} canGoBack={active.canGoBack} canGoForward={active.canGoForward}
        sidebarOpen={sb.open} sidebarWidth={sb.width} trafficLights
        onNew={() => newTab()} onClose={close}
        onActivate={(id) => setTabs((ts) => ts.map((x) => ({ ...x, active: x.id === id })))}
        onBack={() => cmd(active.id, 'back')} onForward={() => cmd(active.id, 'forward')}
        onToggleSidebar={() => cmd(active.id, 'toggle-sidebar')}
        onMove={(id, to) => setTabs((ts) => { const i = ts.findIndex((x) => x.id === id); const c = [...ts]; const [m] = c.splice(i, 1); c.splice(to > i ? to - 1 : to, 0, m); return c; })}
      />
      <div className="ink-window-views">
        {tabs.map((tab) => {
          const params = new URLSearchParams(pass); params.set('tab', tab.id); params.set('theme', theme);
          if (firstLoad.current && q.has('fixture')) params.set('fixture', q.get('fixture') || '1');
          const src = `./index.html?${params}${tab.hash}`;
          return <iframe key={tab.id} ref={(f) => { if (f) frames.current.set(tab.id, f); else frames.current.delete(tab.id); }} className={'ink-window-view' + (tab.active ? ' is-active' : '')} src={src} title={tab.title} onLoad={() => { firstLoad.current = false; }} />;
        })}
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Win />);
