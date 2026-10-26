/** Window/tab state persisted to userData so a relaunch restores windows, bounds and tabs. */
import fs from 'node:fs';
import path from 'node:path';

export interface SavedTab { hash: string; active: boolean; title?: string; icon?: string }
export interface SavedWindow { bounds?: { x: number; y: number; width: number; height: number }; maximized?: boolean; tabs: SavedTab[] }
export interface SavedState { version: 1; installId: string; windows: SavedWindow[]; gpuDisabled?: boolean; verboseLogging?: boolean }

export class StateFile {
  private file: string;
  private timer: NodeJS.Timeout | undefined;
  data: SavedState;
  constructor(dir: string, name: string) {
    this.file = path.join(dir, name);
    let d: Partial<SavedState> = {};
    try { d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* first run */ }
    this.data = { version: 1, installId: d.installId || cryptoId(), windows: Array.isArray(d.windows) ? d.windows : [], gpuDisabled: d.gpuDisabled, verboseLogging: d.verboseLogging };
  }
  save(now = false) {
    clearTimeout(this.timer);
    const write = () => { try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch (e) { console.error('[inkwell] state save failed', e); } };
    if (now) write(); else this.timer = setTimeout(write, 300);
  }
}
function cryptoId() { return [8, 4, 4, 4, 12].map((n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')).join('-'); }
