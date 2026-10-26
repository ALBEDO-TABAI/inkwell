/**
 * Inkwell desktop main process.
 * One BrowserWindow per window (1320×860, hiddenInset title bar). Inside it a 36px tab-bar
 * WebContentsView plus one WebContentsView per tab, only the active one visible.
 */
import { app, BrowserWindow, WebContentsView, ipcMain, Menu, nativeTheme, protocol, net, session, contentTracing, systemPreferences, shell, dialog, clipboard, screen, type MenuItemConstructorOptions, type WebContents } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fetchOg } from './og';
import { BRAND } from '@shared/brand';
import { IPC, type TabState, type TabsSnapshot } from '@shared/ipc';
import { openStore, type Store } from './db';
import { StateFile, type SavedWindow } from './state';
import { labels } from './labels';

const TABBAR_H = 36;
const DEFAULT_W = 1320, DEFAULT_H = 860;
const DEV_URL = process.env.INKWELL_DEV_URL; // e.g. http://127.0.0.1:5200 (vite)
// packaged: renderer ships as Resources/renderer (extraResources); dev: the workspace build
const APP_DIST = [path.join(process.resourcesPath || '', 'renderer'), path.resolve(__dirname, '../../app/dist')].find((d) => fs.existsSync(path.join(d, 'index.html'))) || path.resolve(__dirname, '../../app/dist');
const BG = { light: '#f9f8f7', dark: '#202020' };

app.setName(BRAND.name); // userData → ~/Library/Application Support/Inkwell (package name is @inkwell/desktop)
app.setPath('userData', process.env.INKWELL_USER_DATA ? path.resolve(process.env.INKWELL_USER_DATA) : path.join(app.getPath('appData'), BRAND.name));
protocol.registerSchemesAsPrivileged([{ scheme: BRAND.scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

let db: Store;
let state: StateFile;
let L = labels('zh-CN');
let quittingWithoutTabs = false;
let quitting = false;
const closedTabs: { hash: string }[] = [];
const windows = new Set<WindowController>();
let lastFocused: WindowController | null = null;
let tabSeq = 0;

function pageUrl(params: Record<string, string>, hash: string) {
  const q = new URLSearchParams(params).toString();
  return DEV_URL ? `${DEV_URL}/index.html?${q}${hash}` : `${BRAND.scheme}://app/index.html?${q}${hash}`;
}
const tabbarUrl = () => (DEV_URL ? `${DEV_URL}/tabbar.html` : `${BRAND.scheme}://app/tabbar.html`);

interface Tab { id: string; view: WebContentsView; title: string; icon?: string; hash: string; canGoBack: boolean; canGoForward: boolean; sidebar?: { open: boolean; width: number } }

class WindowController {
  win: BrowserWindow;
  tabbar: WebContentsView;
  tabs: Tab[] = [];
  activeId = '';
  theme: 'light' | 'dark' = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  sidebar = { open: true, width: 270 };
  private tabbarReady = false;

  constructor(saved?: SavedWindow) {
    const b = saved?.bounds && visibleOnSomeDisplay(saved.bounds) ? saved.bounds : undefined;
    this.win = new BrowserWindow({
      width: b?.width ?? DEFAULT_W, height: b?.height ?? DEFAULT_H, x: b?.x, y: b?.y,
      minWidth: 480, minHeight: 320, show: false, title: BRAND.name,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      trafficLightPosition: { x: 14, y: 11 },
      ...(process.platform !== 'darwin' ? { titleBarOverlay: { color: BG[this.theme], symbolColor: this.theme === 'dark' ? '#d4d4d4' : '#5f5e5b', height: TABBAR_H } } : {}),
      backgroundColor: BG[this.theme],
      webPreferences: { partition: BRAND.partition },
    });
    if (saved?.maximized) this.win.maximize();
    this.tabbar = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload-tabbar.cjs'), partition: BRAND.partition, sandbox: true, contextIsolation: true } });
    this.tabbar.setBackgroundColor(BG[this.theme]);
    this.win.contentView.addChildView(this.tabbar);
    this.tabbar.webContents.loadURL(tabbarUrl());
    const tabs = saved?.tabs?.length ? saved.tabs : [{ hash: '', active: true }];
    for (const t of tabs) this.addTab(t.hash, { activate: t.active, title: t.title, icon: t.icon, quiet: true });
    if (!this.activeId && this.tabs[0]) this.activate(this.tabs[0].id);
    this.layout();
    this.win.on('resize', () => { this.layout(); this.persist(); });
    this.win.on('move', () => this.persist());
    this.win.on('focus', () => { lastFocused = this; this.active()?.view.webContents.focus(); buildMenu(); });
    this.win.on('enter-full-screen', () => this.layout());
    this.win.on('leave-full-screen', () => this.layout());
    this.win.on('closed', () => { windows.delete(this); if (lastFocused === this) lastFocused = null; for (const t of this.tabs) t.view.webContents.close(); this.tabbar.webContents.close(); if (!quitting) persistAll(); });
    this.win.once('ready-to-show', () => this.win.show());
    // the window has no page of its own, so ready-to-show may never fire: show once the tab bar paints
    this.tabbar.webContents.once('did-finish-load', () => { if (!this.win.isVisible()) this.win.show(); });
    windows.add(this);
    lastFocused = this;
  }

  active() { return this.tabs.find((t) => t.id === this.activeId); }
  find(wc: WebContents) { return this.tabs.find((t) => t.view.webContents === wc); }

  addTab(hash: string, o: { activate?: boolean; index?: number; title?: string; icon?: string; quiet?: boolean } = {}) {
    const id = `tab-${Date.now().toString(36)}-${tabSeq++}`;
    const view = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload-app.cjs'), partition: BRAND.partition, sandbox: true, contextIsolation: true, spellcheck: true } });
    view.setBackgroundColor(this.theme === 'dark' ? '#191919' : '#ffffff');
    const tab: Tab = { id, view, title: o.title || '', icon: o.icon, hash, canGoBack: false, canGoForward: false };
    const idx = o.index ?? this.tabs.length;
    this.tabs.splice(idx, 0, tab);
    view.setVisible(false);
    this.win.contentView.addChildView(view);
    const params: Record<string, string> = { tab: id, theme: this.theme };
    if (process.env.INKWELL_FIXTURE) params.fixture = process.env.INKWELL_FIXTURE;
    if (!hash && !o.quiet) params.newtab = '1'; // user-opened blank tab: the page opens with the "open in new tab…" palette
    view.webContents.loadURL(pageUrl(params, hash));
    wireContents(view.webContents);
    if (o.activate !== false) this.activate(id);
    if (!o.quiet) { this.layout(); this.broadcast(); this.persist(); }
    return tab;
  }

  closeTab(id: string) {
    const i = this.tabs.findIndex((t) => t.id === id); if (i < 0) return;
    const [t] = this.tabs.splice(i, 1);
    closedTabs.push({ hash: t.hash }); if (closedTabs.length > 25) closedTabs.shift();
    this.win.contentView.removeChildView(t.view);
    t.view.webContents.close();
    if (!this.tabs.length) { this.win.close(); return; }
    if (this.activeId === id) this.activate(this.tabs[Math.min(i, this.tabs.length - 1)].id);
    this.broadcast(); this.persist();
  }

  activate(id: string) {
    const t = this.tabs.find((x) => x.id === id); if (!t) return;
    this.activeId = id;
    for (const x of this.tabs) x.view.setVisible(x.id === id);
    if (t.sidebar) this.sidebar = t.sidebar;
    this.layout();
    t.view.webContents.focus();
    this.win.setTitle(t.title || BRAND.name);
    this.broadcast(); this.persist();
  }
  cycle(d: number) { const i = this.tabs.findIndex((t) => t.id === this.activeId); this.activate(this.tabs[(i + d + this.tabs.length) % this.tabs.length].id); }

  move(id: string, to: number) {
    const i = this.tabs.findIndex((t) => t.id === id); if (i < 0) return;
    const [t] = this.tabs.splice(i, 1);
    this.tabs.splice(to > i ? to - 1 : to, 0, t);
    this.broadcast(); this.persist();
  }

  layout() {
    const { width, height } = this.win.getContentBounds();
    const top = this.win.isFullScreen() ? 0 : TABBAR_H;
    this.tabbar.setBounds({ x: 0, y: 0, width, height: TABBAR_H });
    this.tabbar.setVisible(!this.win.isFullScreen());
    for (const t of this.tabs) t.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
  }

  snapshot(): TabsSnapshot {
    const a = this.active();
    return {
      windowId: this.win.id,
      tabs: this.tabs.map<TabState>((t) => ({ id: t.id, title: t.title, icon: t.icon, url: t.hash.replace(/^#\/p\//, `${BRAND.scheme}://page/`), active: t.id === this.activeId })),
      canGoBack: !!a?.canGoBack, canGoForward: !!a?.canGoForward,
      sidebarOpen: this.sidebar.open, sidebarWidth: this.sidebar.width, theme: this.theme,
    };
  }
  broadcast() { if (this.tabbarReady && !this.tabbar.webContents.isDestroyed()) this.tabbar.webContents.send(IPC.tabsState, this.snapshot()); }
  onTabbarReady() { this.tabbarReady = true; this.broadcast(); }

  setTheme(theme: 'light' | 'dark', from?: Tab) {
    if (theme === this.theme && from) return;
    this.theme = theme;
    this.win.setBackgroundColor(BG[theme]);
    this.tabbar.setBackgroundColor(BG[theme]);
    if (process.platform !== 'darwin') try { this.win.setTitleBarOverlay({ color: BG[theme], symbolColor: theme === 'dark' ? '#d4d4d4' : '#5f5e5b', height: TABBAR_H }); } catch { /* not supported */ }
    for (const t of this.tabs) if (t !== from) t.view.webContents.send(IPC.command, { cmd: theme === 'dark' ? 'theme-dark' : 'theme-light' });
    this.broadcast();
  }

  command(cmd: string, arg?: unknown) { this.active()?.view.webContents.send(IPC.command, { cmd, arg }); }

  saved(): SavedWindow {
    return { bounds: this.win.isMaximized() || this.win.isFullScreen() ? this.win.getNormalBounds() : this.win.getBounds(), maximized: this.win.isMaximized(), tabs: this.tabs.map((t) => ({ hash: t.hash, active: t.id === this.activeId, title: t.title, icon: t.icon })) };
  }
  persist() { if (!quitting) persistAll(); }
  /** Cmd/Ctrl+1…8 = nth tab, 9 = last */
  activateIndex(n: number) { const t = n === 9 ? this.tabs[this.tabs.length - 1] : this.tabs[n - 1]; if (t) this.activate(t.id); }
}

function visibleOnSomeDisplay(b: { x: number; y: number; width: number; height: number }) {
  return screen.getAllDisplays().some((d) => { const a = d.workArea; return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40; });
}
function persistAll(now = false) {
  if (quittingWithoutTabs) state.data.windows = [];
  else state.data.windows = [...windows].map((w) => w.saved());
  state.save(now);
}
const current = () => (BrowserWindow.getFocusedWindow() && [...windows].find((w) => w.win === BrowserWindow.getFocusedWindow())) || lastFocused || [...windows][0];
function ownerOf(wc: WebContents): { w: WindowController; tab?: Tab } | null {
  for (const w of windows) { if (w.tabbar.webContents === wc) return { w }; const tab = w.find(wc); if (tab) return { w, tab }; }
  return null;
}

/** Shortcuts that must work while a page view has focus (Ctrl/Cmd+1…9, Ctrl+Tab), plus external links. */
function wireContents(wc: WebContents) {
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const mod = process.platform === 'darwin' ? input.meta : input.control;
    const o = ownerOf(wc); if (!o) return;
    if (mod && !input.shift && !input.alt && /^[1-9]$/.test(input.key)) {
      e.preventDefault();
      o.w.activateIndex(Number(input.key));
    } else if (input.control && input.key === 'Tab') { e.preventDefault(); o.w.cycle(input.shift ? -1 : 1); }
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    const ok = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(`${BRAND.scheme}://app/`);
    if (!ok) { e.preventDefault(); if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); }
  });
}

/* ------------------------------ IPC ------------------------------ */
function wireIpc() {
  ipcMain.handle(IPC.dbLoad, () => db.load());
  ipcMain.handle('inkwell:fetch-og', (_e, url: string) => fetchOg(String(url || '')));
  // every tab is its own renderer with its own in-memory store: fan writes out so the others stay live
  const fanout = (from: WebContents, ch: string, ...a: unknown[]) => { for (const w of windows) for (const t of w.tabs) if (t.view.webContents !== from && !t.view.webContents.isDestroyed()) t.view.webContents.send(ch, ...a); };
  ipcMain.handle(IPC.dbWrite, (e, c) => { db.write(c); fanout(e.sender, 'inkwell:db-changed', c); });
  ipcMain.handle(IPC.dbReset, (_e, s) => { db.reset(s); });
  ipcMain.on(IPC.kvSet, (e, k: string, v: unknown) => { db.kvSet(k, v); fanout(e.sender, 'inkwell:kv-changed', k, v); });

  ipcMain.on('inkwell:tabbar-ready', (e) => ownerOf(e.sender)?.w.onTabbarReady());
  ipcMain.on('inkwell:tab-index', (e, p: { n: number }) => ownerOf(e.sender)?.w.activateIndex(p.n));
  ipcMain.on(IPC.tabNew, (e) => ownerOf(e.sender)?.w.addTab(''));
  ipcMain.on(IPC.tabClose, (e, id: string) => ownerOf(e.sender)?.w.closeTab(id));
  ipcMain.on(IPC.tabActivate, (e, id: string) => ownerOf(e.sender)?.w.activate(id));
  ipcMain.on(IPC.tabMove, (e, id: string, to: number) => ownerOf(e.sender)?.w.move(id, to));
  ipcMain.on(IPC.navBack, (e) => ownerOf(e.sender)?.w.command('back'));
  ipcMain.on(IPC.navForward, (e) => ownerOf(e.sender)?.w.command('forward'));
  ipcMain.on(IPC.toggleSidebar, (e) => ownerOf(e.sender)?.w.command('toggle-sidebar'));
  ipcMain.on(IPC.tabMenu, (e, id: string, x: number, y: number) => { const o = ownerOf(e.sender); if (o) tabContextMenu(o.w, id, x, y); });
  ipcMain.on('inkwell:titlebar-dblclick', (e) => {
    const w = ownerOf(e.sender)?.w.win; if (!w) return;
    if (process.platform === 'darwin') { w.isMaximized() ? w.unmaximize() : w.maximize(); } else { w.isMaximized() ? w.unmaximize() : w.maximize(); }
  });

  // from page views
  ipcMain.on(IPC.navState, (e, p: { pageId: string; title: string; icon?: string; canGoBack: boolean; canGoForward: boolean }) => {
    const o = ownerOf(e.sender); if (!o?.tab) return;
    Object.assign(o.tab, { title: p.title, icon: p.icon || undefined, canGoBack: p.canGoBack, canGoForward: p.canGoForward, hash: p.pageId ? `#/p/${p.pageId}` : o.tab.hash });
    if (o.tab.id === o.w.activeId) o.w.win.setTitle(p.title || BRAND.name);
    o.w.broadcast(); o.w.persist();
  });
  ipcMain.on(IPC.sidebarState, (e, p: { open: boolean; width: number }) => {
    const o = ownerOf(e.sender); if (!o?.tab) return;
    o.tab.sidebar = { open: p.open, width: p.width };
    if (o.tab.id === o.w.activeId) { o.w.sidebar = o.tab.sidebar; o.w.broadcast(); }
  });
  ipcMain.on(IPC.themeChanged, (e, p: { theme: 'light' | 'dark' }) => { const o = ownerOf(e.sender); if (o?.tab) o.w.setTheme(p.theme, o.tab); });
  ipcMain.on('inkwell:new-tab', (e, p: { url?: string }) => { const o = ownerOf(e.sender); o?.w.addTab(p?.url || '', { index: o.tab ? o.w.tabs.indexOf(o.tab) + 1 : undefined }); });
  ipcMain.on('inkwell:new-window', (_e, p: { url?: string }) => new WindowController({ tabs: [{ hash: p?.url || '', active: true }] }));
  ipcMain.on(IPC.setLocale, (_e, locale: string) => { L = labels(locale); buildMenu(); });
}

function tabContextMenu(w: WindowController, id: string, x: number, y: number) {
  const i = w.tabs.findIndex((t) => t.id === id); const t = w.tabs[i]; if (!t) return;
  Menu.buildFromTemplate([
    { label: L.newTab, click: () => w.addTab('', { index: i + 1 }) },
    { label: L.tabDuplicate, click: () => w.addTab(t.hash, { index: i + 1 }) },
    { label: L.tabToWindow, enabled: w.tabs.length > 1, click: () => { const hash = t.hash; w.closeTab(id); new WindowController({ tabs: [{ hash, active: true }] }); } },
    { type: 'separator' },
    { label: L.closeTab, click: () => w.closeTab(id) },
    { label: L.tabCloseOthers, enabled: w.tabs.length > 1, click: () => { for (const o of [...w.tabs]) if (o.id !== id) w.closeTab(o.id); } },
    { label: L.tabCloseRight, enabled: i < w.tabs.length - 1, click: () => { for (const o of w.tabs.slice(i + 1)) w.closeTab(o.id); } },
    { type: 'separator' },
    { label: L.reopenTab, enabled: closedTabs.length > 0, click: () => reopenClosedTab(w) },
  ]).popup({ window: w.win, x: Math.round(x), y: Math.round(y) });
}
function reopenClosedTab(w = current()) { const c = closedTabs.pop(); if (c && w) w.addTab(c.hash); }

/* ------------------------------ menus (B02b) ------------------------------ */
// ---- troubleshooting helpers (all local; results land in the logs folder)
const logFile = (name: string) => { const d = app.getPath('logs'); fs.mkdirSync(d, { recursive: true }); return path.join(d, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}`); };
async function blankTabDiagnostics() {
  const w = current(); const t = w?.active(); if (!w || !t) return;
  const wc = t.view.webContents;
  const info = { url: wc.getURL(), crashed: wc.isCrashed(), loading: wc.isLoading(), visible: await wc.executeJavaScript('document.visibilityState').catch(() => '?'),
    rootChildren: await wc.executeJavaScript('document.getElementById("root")?.childElementCount ?? -1').catch(() => -1), bounds: t.view.getBounds(), gpu: app.getGPUFeatureStatus(), versions: process.versions };
  const f = logFile('blank-tab') + '.json'; fs.writeFileSync(f, JSON.stringify(info, null, 2)); shell.showItemInFolder(f);
}
let tracing = false;
async function recordTrace(ms = 5000) {
  if (tracing) return; tracing = true;
  try { await contentTracing.startRecording({ included_categories: ['*'] }); await new Promise((r) => setTimeout(r, ms)); const f = await contentTracing.stopRecording(logFile('trace') + '.json'); shell.showItemInFolder(f); } finally { tracing = false; }
}
async function recordNetLog(ms = 15000) {
  const ses = session.fromPartition(BRAND.partition); if (ses.netLog.currentlyLogging) return;
  const f = logFile('netlog') + '.json'; await ses.netLog.startLogging(f); setTimeout(async () => { await ses.netLog.stopLogging(); shell.showItemInFolder(f); }, ms);
}
function showMediaStatus() {
  const st = (k: 'microphone' | 'camera') => (process.platform === 'darwin' || process.platform === 'win32' ? systemPreferences.getMediaAccessStatus(k) : 'n/a');
  dialog.showMessageBox({ type: 'info', message: L.mediaStatus, detail: `${L.mic}: ${st('microphone')}\n${L.camera}: ${st('camera')}` });
}

function buildMenu() {
  const mac = (process.env.INKWELL_MENU_PLATFORM || process.platform) === 'darwin'; // override lets the harness dump the mac menu on linux
  const cmd = (c: string, arg?: unknown) => () => current()?.command(c, arg);
  const activeWc = () => current()?.active()?.view.webContents;
  const template: MenuItemConstructorOptions[] = [
    ...(mac ? [{
      label: BRAND.name,
      submenu: [
        { label: L.about, click: showAbout },
        { type: 'separator' },
        { label: L.prefs, accelerator: 'Cmd+,', click: cmd('settings') },
        { label: L.updates, enabled: false },
        { type: 'separator' },
        { label: L.services, role: 'services' },
        { type: 'separator' },
        { label: L.hide, role: 'hide' }, { label: L.hideOthers, role: 'hideOthers' }, { label: L.unhide, role: 'unhide' },
        { type: 'separator' },
        { label: L.quitNoTabs, accelerator: 'Cmd+Alt+Q', click: () => { quittingWithoutTabs = true; app.quit(); } },
        { label: L.quit, accelerator: 'Cmd+Q', click: () => app.quit() },
      ],
    } as MenuItemConstructorOptions] : []),
    {
      label: L.file,
      submenu: [
        { label: L.newTab, accelerator: 'CmdOrCtrl+T', click: () => current()?.addTab('') ?? new WindowController() },
        { label: L.newWindow, accelerator: 'CmdOrCtrl+Shift+N', click: () => new WindowController() },
        { label: L.reopenTab, accelerator: 'CmdOrCtrl+Shift+T', click: () => reopenClosedTab() },
        { label: L.closeTab, accelerator: 'CmdOrCtrl+W', click: () => { const w = current(); const a = w?.active(); if (w && a) w.closeTab(a.id); } },
        { type: 'separator' },
        { label: L.print, click: () => activeWc()?.print() },
        ...(mac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { label: L.prefs, accelerator: 'Ctrl+,', click: cmd('settings') }, { label: L.quit, accelerator: 'Ctrl+Q', click: () => app.quit() }]),
      ],
    },
    {
      label: L.edit,
      submenu: [
        { label: L.undo, accelerator: 'CmdOrCtrl+Z', click: cmd('undo') },
        { label: L.redo, accelerator: mac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: cmd('redo') },
        { type: 'separator' },
        { label: L.cut, role: 'cut' }, { label: L.copy, role: 'copy' },
        { label: L.copyLink, accelerator: 'CmdOrCtrl+L', click: cmd('copy-link') },
        { label: L.copyTitle, click: cmd('copy-title') },
        { label: L.paste, role: 'paste' }, { label: L.pasteMatch, role: 'pasteAndMatchStyle' },
        { label: L.selectAll, role: 'selectAll' },
        ...(mac ? [{ type: 'separator' } as MenuItemConstructorOptions, { label: L.speech, submenu: [{ label: L.startSpeaking, role: 'startSpeaking' }, { label: L.stopSpeaking, role: 'stopSpeaking' }] } as MenuItemConstructorOptions] : []),
      ],
    },
    {
      label: L.view,
      submenu: [
        { label: L.reload, accelerator: 'CmdOrCtrl+R', click: () => activeWc()?.reload() },
        { label: L.forceReload, accelerator: 'CmdOrCtrl+Shift+R', click: () => activeWc()?.reloadIgnoringCache() },
        { label: L.devtools, accelerator: mac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => activeWc()?.toggleDevTools() },
        { type: 'separator' },
        { label: L.toggleSidebar, accelerator: 'CmdOrCtrl+\\', click: cmd('toggle-sidebar') },
        { type: 'separator' },
        { label: L.zoomIn, accelerator: 'CmdOrCtrl+=', click: () => zoom(+0.5) },
        { label: L.zoomOut, accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.5) },
        { label: L.zoomReset, accelerator: 'CmdOrCtrl+0', click: () => zoom(0) },
        { type: 'separator' },
        { label: L.fullscreen, role: 'togglefullscreen' },
      ],
    },
    {
      label: L.history,
      submenu: [
        { label: L.back, accelerator: 'CmdOrCtrl+[', click: cmd('back') },
        { label: L.forward, accelerator: 'CmdOrCtrl+]', click: cmd('forward') },
      ],
    },
    {
      label: L.window, role: 'windowMenu',
      submenu: [
        { label: L.minimize, role: 'minimize' },
        { label: L.zoom, role: 'zoom' },
        { type: 'separator' },
        { label: L.prevTab, accelerator: mac ? 'Cmd+Shift+[' : 'Ctrl+Shift+Tab', click: () => current()?.cycle(-1) },
        { label: L.nextTab, accelerator: mac ? 'Cmd+Shift+]' : 'Ctrl+Tab', click: () => current()?.cycle(1) },
        { type: 'separator' },
        ...(mac ? [{ label: L.front, role: 'front' } as MenuItemConstructorOptions] : []),
      ],
    },
    {
      label: L.help, role: 'help',
      submenu: [
        {
          label: L.troubleshoot,
          submenu: [
            { label: mac ? L.showLogsMac : L.showLogs, click: () => { fs.mkdirSync(app.getPath('logs'), { recursive: true }); shell.openPath(app.getPath('logs')); } },
            ...(mac ? [
              { label: L.openConsole, click: () => shell.openPath('/System/Applications/Utilities/Console.app') },
              { label: L.openActivity, click: () => shell.openPath('/System/Applications/Utilities/Activity Monitor.app') },
            ] : []),
            { type: 'separator' },
            { label: L.blankTabDiag, click: blankTabDiagnostics },
            { label: L.blackScreen, click: () => { app.relaunch({ args: [...process.argv.slice(1).filter((a) => a !== '--disable-gpu-compositing'), '--disable-gpu-compositing'] }); app.quit(); } },
            { label: L.perfTrace, click: () => recordTrace() },
            { label: L.netLog, click: () => recordNetLog() },
            { label: L.mediaStatus, click: showMediaStatus },
            { type: 'separator' },
            { label: L.disableGpu, type: 'checkbox', checked: !!state.data.gpuDisabled, click: () => { state.data.gpuDisabled = !state.data.gpuDisabled; persistAll(true); app.relaunch(); app.quit(); } },
            { label: L.verboseLog, type: 'checkbox', checked: !!state.data.verboseLogging, click: () => { state.data.verboseLogging = !state.data.verboseLogging; persistAll(true); app.relaunch(); app.quit(); } },
            { type: 'separator' },
            { label: L.resetData, click: resetLocalData },
            { label: L.copyInstallId, click: () => clipboard.writeText(state.data.installId) },
          ],
        },
        { label: L.openHelp, enabled: false },
        { label: L.latest(mac ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux'), click: showAbout },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  if (process.env.INKWELL_MENU_DUMP) { // parity harness: structure + accelerators of the native menu
    type Node = { label: string; role?: string; accelerator?: string; enabled: boolean; type: string; submenu?: Node[] };
    const ser = (m: Electron.Menu): Node[] => m.items.map((i) => ({ label: i.label, role: i.role, accelerator: i.accelerator ? String(i.accelerator) : undefined, enabled: i.enabled, type: i.type, submenu: i.submenu ? ser(i.submenu) : undefined }));
    fs.writeFileSync(process.env.INKWELL_MENU_DUMP, JSON.stringify(ser(menu), null, 2));
  }
}
function zoom(d: number) {
  const wc = current()?.active()?.view.webContents; if (!wc) return;
  wc.setZoomLevel(d === 0 ? 0 : Math.max(-3, Math.min(4, wc.getZoomLevel() + d)));
}
function showAbout() {
  dialog.showMessageBox({ type: 'info', title: L.about, message: `${BRAND.name} ${app.getVersion()}`, detail: L.aboutDetail, buttons: ['OK'] });
}
async function resetLocalData() {
  const w = current()?.win;
  const r = await (w ? dialog.showMessageBox(w, { type: 'warning', message: L.resetData, detail: L.resetConfirm, buttons: [L.cancel, L.resetOk], defaultId: 0, cancelId: 0 }) : dialog.showMessageBox({ type: 'warning', message: L.resetData, detail: L.resetConfirm, buttons: [L.cancel, L.resetOk], defaultId: 0, cancelId: 0 }));
  if (r.response !== 1) return;
  db.close();
  for (const f of fs.readdirSync(app.getPath('userData'))) if (f.startsWith(BRAND.dbFile.replace(/\.db$/, ''))) fs.rmSync(path.join(app.getPath('userData'), f), { force: true });
  quittingWithoutTabs = true; app.relaunch(); app.quit();
}

/* ------------------------------ deep links: inkwell://page/<id> ------------------------------ */
function handleDeepLink(url: string) {
  const m = url.match(new RegExp(`^${BRAND.scheme}://page/([\\w-]+)`));
  if (!m) return;
  const w = current() || new WindowController();
  w.win.show(); w.win.focus();
  w.command('navigate', m[1]);
}

/* ------------------------------ boot ------------------------------ */
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on('second-instance', (_e, argv) => { const link = argv.find((a) => a.startsWith(`${BRAND.scheme}://`)); if (link) handleDeepLink(link); else current()?.win.focus(); });
app.on('open-url', (e, url) => { e.preventDefault(); if (app.isReady()) handleDeepLink(url); else app.once('ready', () => setTimeout(() => handleDeepLink(url), 500)); });
if (!app.isDefaultProtocolClient(BRAND.scheme)) { try { app.setAsDefaultProtocolClient(BRAND.scheme); } catch { /* not fatal */ } }

state = new StateFile(app.getPath('userData'), BRAND.stateFile);
if (state.data.gpuDisabled) app.disableHardwareAcceleration();
if (state.data.verboseLogging) { app.commandLine.appendSwitch('enable-logging', 'file'); app.commandLine.appendSwitch('log-file', path.join(app.getPath('userData'), 'logs', 'verbose.log')); }

app.whenReady().then(() => {
  // serve the built renderer from inkwell://app/…
  // (registered on the app partition too — protocol.handle is per-session)
  const serve = (req: Request) => {
    const u = new URL(req.url);
    if (u.host !== 'app') return new Response('not found', { status: 404 });
    const file = path.normalize(path.join(APP_DIST, decodeURIComponent(u.pathname)));
    if (!file.startsWith(APP_DIST)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  };
  protocol.handle(BRAND.scheme, serve);
  session.fromPartition(BRAND.partition).protocol.handle(BRAND.scheme, serve);
  db = openStore(app.getPath('userData'), BRAND.dbFile);
  console.log(`[inkwell] storage: ${db.kind} at ${app.getPath('userData')}`);
  L = labels(process.env.INKWELL_LOCALE || app.getLocale() || 'zh-CN');
  wireIpc();
  buildMenu();
  const saved = state.data.windows.length ? state.data.windows : [{ tabs: [{ hash: '', active: true }] }];
  for (const s of saved) new WindowController(s);
  const link = process.argv.find((a) => a.startsWith(`${BRAND.scheme}://`)); if (link) setTimeout(() => handleDeepLink(link), 800);
  app.on('activate', () => { if (!windows.size) new WindowController(); });
});
app.on('before-quit', () => { persistAll(true); quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { try { db?.close(); } catch { /* ignore */ } });
// graceful shutdown on signals so window/tab state is persisted (also used by the parity harness)
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => app.quit());
