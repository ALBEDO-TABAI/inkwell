/** Messages between the app renderer and its window shell (Electron main via preload, or the browser window simulator via postMessage). */
export type ShellCommand = 'back' | 'forward' | 'toggle-sidebar' | 'search' | 'new-page' | 'theme-light' | 'theme-dark' | 'theme-system' | 'toggle-theme' | 'undo' | 'redo' | 'settings' | 'reload' | 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'find' | 'copy-link' | 'copy-title' | 'navigate' | 'focus';
export const inShell = () => !!window.inkwellNative || window.parent !== window;

export function shellSend(type: string, payload: Record<string, unknown> = {}) {
  if (window.inkwellNative) window.inkwellNative.send(type, payload);
  else if (window.parent !== window) window.parent.postMessage({ type, ...payload, tabId: new URLSearchParams(location.search).get('tab') }, '*');
}
export function onShellCommand(f: (cmd: ShellCommand, arg?: unknown) => void): () => void {
  if (window.inkwellNative) return window.inkwellNative.on('inkwell:command', (p: unknown) => { const o = p as { cmd: ShellCommand; arg?: unknown }; f(o.cmd, o.arg); });
  const h = (e: MessageEvent) => { if (e.data?.type === 'inkwell:command') f(e.data.cmd, e.data.arg); };
  window.addEventListener('message', h);
  return () => window.removeEventListener('message', h);
}
