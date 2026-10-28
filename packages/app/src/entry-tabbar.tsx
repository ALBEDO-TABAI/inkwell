/** Electron tab-bar renderer: a thin view over the main-process tab model. */
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '@tokens/tokens.css';
import './styles/tabbar.css';
import './styles/studio.css';
import { TabBar } from './shell/TabBar';
import type { TabsSnapshot } from '@shared/ipc';
import { IPC } from '@shared/ipc';
import { initMotion } from './app/motion';
initMotion();

declare global { interface Window { inkwellTabs?: { on(f: (s: TabsSnapshot) => void): void; send(channel: string, ...a: unknown[]): void } } }

function Bar() {
  const [s, setS] = useState<TabsSnapshot | null>(null);
  useEffect(() => { window.inkwellTabs?.on((x) => { setS(x); document.documentElement.dataset.theme = x.theme; }); window.inkwellTabs?.send('inkwell:tabbar-ready'); }, []);
  if (!s) return <div className="ink-tabbar" />;
  const send = (c: string, ...a: unknown[]) => window.inkwellTabs?.send(c, ...a);
  return (
    <TabBar tabs={s.tabs} canGoBack={s.canGoBack} canGoForward={s.canGoForward} sidebarOpen={s.sidebarOpen} sidebarWidth={s.sidebarWidth}
      trafficLights={false}
      onNew={() => send(IPC.tabNew)} onClose={(id) => send(IPC.tabClose, id)} onActivate={(id) => send(IPC.tabActivate, id)}
      onBack={() => send(IPC.navBack)} onForward={() => send(IPC.navForward)} onToggleSidebar={() => send(IPC.toggleSidebar)}
      onMove={(id, to) => send(IPC.tabMove, id, to)} onMenu={(id, x, y) => send(IPC.tabMenu, id, x, y)} />
  );
}
createRoot(document.getElementById('root')!).render(<Bar />);
