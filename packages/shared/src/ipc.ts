/** IPC channel names shared by the Electron main process, preloads and renderers. */
export const IPC = {
  // tabs
  tabsState: 'inkwell:tabs-state',
  tabNew: 'inkwell:tab-new',
  tabClose: 'inkwell:tab-close',
  tabActivate: 'inkwell:tab-activate',
  tabMove: 'inkwell:tab-move',
  tabReopen: 'inkwell:tab-reopen',
  tabHover: 'inkwell:tab-hover',
  tabMenu: 'inkwell:tab-menu',
  // navigation (per-tab history lives in the app renderer; the shell relays)
  navState: 'inkwell:nav-state',
  navBack: 'inkwell:nav-back',
  navForward: 'inkwell:nav-forward',
  navigate: 'inkwell:navigate',
  setTitle: 'inkwell:set-title',
  // sidebar / theme
  sidebarState: 'inkwell:sidebar-state',
  toggleSidebar: 'inkwell:toggle-sidebar',
  setTheme: 'inkwell:set-theme',
  themeChanged: 'inkwell:theme-changed',
  setLocale: 'inkwell:set-locale',
  // app commands from native menu
  command: 'inkwell:command',
  // storage
  dbLoad: 'inkwell:db-load',
  dbWrite: 'inkwell:db-write',
  dbReset: 'inkwell:db-reset',
  kvGet: 'inkwell:kv-get',
  kvSet: 'inkwell:kv-set',
} as const;

export type ThemePref = 'light' | 'dark' | 'system';

export interface TabState {
  id: string;
  title: string;
  icon?: string; // emoji
  url: string; // inkwell://page/<id>
  active: boolean;
  isPinned?: boolean;
}

export interface TabsSnapshot {
  windowId: number;
  tabs: TabState[];
  canGoBack: boolean;
  canGoForward: boolean;
  sidebarWidth: number; // width of the left (sidebar-coloured) zone of the tab bar
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
}
