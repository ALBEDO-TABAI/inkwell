/**
 * Single source of truth for product identity. The name is a working title and
 * is expected to change — change it here only.
 */
export const BRAND = {
  name: 'Inkwell',
  version: '0.4.0',
  slug: 'inkwell',
  scheme: 'inkwell',
  appId: 'app.inkwell.desktop',
  dbFile: 'inkwell.db',
  stateFile: 'window-state.json',
  partition: 'persist:inkwell',
  /** MIME types for cross-window tab drag */
  tabMime: 'application/x.inkwell.tab-id',
  windowMime: 'application/x.inkwell.window-id',
} as const;

export type Brand = typeof BRAND;
