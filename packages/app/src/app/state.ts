import { useSyncExternalStore } from 'react';
import type { ThemePref } from '@shared/ipc';
import { store } from '../store/store';
import { kvGet, kvPut } from '../store/persistence';

export interface UiState {
  pageId: string;
  back: string[];
  forward: string[];
  theme: ThemePref;
  resolvedTheme: 'light' | 'dark';
  sidebarWidth: number;
  sidebarOpen: boolean;
  /** floating peek sidebar visible (when collapsed) */
  peek: boolean;
  /** topbar faded while typing / idle */
  chromeHidden: boolean;
  expanded: Record<string, boolean>;
  highContrast: boolean;
  sidebarResizing: boolean;
}

const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
const resolve = (t: ThemePref): 'light' | 'dark' => (t === 'system' ? (mq?.matches ? 'dark' : 'light') : t);

let state: UiState;
const subs = new Set<() => void>();
export function getUi() { return state; }
export function setUi(p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) {
  const patch = typeof p === 'function' ? p(state) : p;
  state = { ...state, ...patch };
  if ('theme' in patch) state.resolvedTheme = resolve(state.theme);
  applyDocumentState();
  subs.forEach((f) => f());
}
export function useUi<T>(sel: (s: UiState) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => sel(state));
}

function applyDocumentState() {
  const d = document.documentElement;
  d.dataset.theme = state.resolvedTheme;
  d.dataset.contrast = state.highContrast ? 'high' : 'normal';
  d.style.colorScheme = state.resolvedTheme;
}

export function initUi() {
  const q = new URLSearchParams(location.search);
  const theme = (q.get('theme') as ThemePref) || kvGet<ThemePref>('theme', (localStorage.getItem('inkwell.theme') as ThemePref) || 'light');
  const hashPage = parseHash();
  const pageId = hashPage || q.get('page') || kvGet('lastPage', store.space.privatePages[0]);
  state = {
    pageId,
    back: [], forward: [],
    theme, resolvedTheme: resolve(theme),
    sidebarWidth: Number(q.get('sidebarWidth')) || kvGet('sidebarWidth', 270),
    sidebarOpen: q.get('sidebar') === 'closed' ? false : kvGet('sidebarOpen', true),
    peek: false,
    chromeHidden: q.get('idle') === '1',
    expanded: kvGet('sidebarExpanded', {} as Record<string, boolean>),
    highContrast: kvGet('highContrast', false),
    sidebarResizing: false,
  };
  applyDocumentState();
  mq?.addEventListener('change', () => { if (state.theme === 'system') setUi({ theme: 'system' }); });
  window.addEventListener('hashchange', () => { const p = parseHash(); if (p && p !== state.pageId) navigate(p, { fromHash: true }); });
  syncHash();
}

function parseHash(): string | null {
  const m = /^#\/p\/([\w-]+)/.exec(location.hash);
  return m ? m[1] : null;
}
function syncHash() {
  const want = `#/p/${state.pageId}`;
  if (location.hash !== want) history.replaceState(null, '', location.pathname + location.search + want);
}
export const pageUrl = (id: string) => `#/p/${id}`;

const navListeners = new Set<() => void>();
export function onNavigate(f: () => void) { navListeners.add(f); return () => navListeners.delete(f); }

export function navigate(pageId: string, opts: { replace?: boolean; fromHash?: boolean } = {}) {
  if (pageId === state.pageId) return;
  setUi((s) => ({ pageId, back: opts.replace ? s.back : [...s.back, s.pageId], forward: [] }));
  kvPut('lastPage', pageId);
  syncHash();
  navListeners.forEach((f) => f());
}
export function goBack() {
  const s = state; if (!s.back.length) return;
  setUi({ pageId: s.back[s.back.length - 1], back: s.back.slice(0, -1), forward: [s.pageId, ...s.forward] });
  syncHash(); navListeners.forEach((f) => f());
}
export function goForward() {
  const s = state; if (!s.forward.length) return;
  setUi({ pageId: s.forward[0], forward: s.forward.slice(1), back: [...s.back, s.pageId] });
  syncHash(); navListeners.forEach((f) => f());
}

export function setTheme(theme: ThemePref) {
  setUi({ theme });
  kvPut('theme', theme);
  try { localStorage.setItem('inkwell.theme', theme); } catch {}
  window.inkwellNative?.send('inkwell:theme-set', theme);
}
export function cycleTheme() { setTheme(state.resolvedTheme === 'dark' ? 'light' : 'dark'); }
export function toggleSidebar() {
  const open = !state.sidebarOpen;
  setUi({ sidebarOpen: open, peek: false });
  kvPut('sidebarOpen', open);
}
export function setSidebarWidth(w: number) {
  const width = Math.round(Math.max(270, Math.min(600, w)));
  setUi({ sidebarWidth: width });
}
export function commitSidebarWidth() { kvPut('sidebarWidth', state.sidebarWidth); }
export function setExpanded(id: string, v: boolean) {
  setUi((s) => ({ expanded: { ...s.expanded, [id]: v } }));
  kvPut('sidebarExpanded', state.expanded);
}
