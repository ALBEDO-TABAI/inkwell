/** Preload for the tab-bar view, exposed as window.inkwellTabs. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipc';

contextBridge.exposeInMainWorld('inkwellTabs', {
  on: (f: (s: unknown) => void) => { ipcRenderer.on(IPC.tabsState, (_e: IpcRendererEvent, s: unknown) => f(s)); },
  send: (channel: string, ...args: unknown[]) => { if (channel.startsWith('inkwell:')) ipcRenderer.send(channel, ...args); },
});
