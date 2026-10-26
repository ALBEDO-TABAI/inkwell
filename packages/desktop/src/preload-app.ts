/** Preload for page views: storage + shell messaging, exposed as window.inkwellNative. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipc';

contextBridge.exposeInMainWorld('inkwellNative', {
  platform: process.platform,
  db: {
    load: () => ipcRenderer.invoke(IPC.dbLoad),
    write: (c: unknown) => ipcRenderer.invoke(IPC.dbWrite, c),
    reset: (d: unknown) => ipcRenderer.invoke(IPC.dbReset, d),
    kvSet: (k: string, v: unknown) => ipcRenderer.send(IPC.kvSet, k, v),
  },
  send: (channel: string, ...args: unknown[]) => { if (channel.startsWith('inkwell:')) ipcRenderer.send(channel, ...args); },
  on: (channel: string, f: (...args: unknown[]) => void) => {
    const h = (_e: IpcRendererEvent, ...args: unknown[]) => f(...args);
    ipcRenderer.on(channel, h);
    return () => { ipcRenderer.removeListener(channel, h); };
  },
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});
