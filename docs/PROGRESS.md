# Inkwell — progress log

Inkwell is an original recreation of a block-based notes desktop app (reference: 7.40.1 captures in `/workspace/notion-research`). The brand lives in `packages/shared/src/brand.ts`.

## How to run
```
cd /workspace/inkwell
npm install            # once
npm run tokens         # regenerate packages/tokens/generated/tokens.css
npm -w @inkwell/app run dev   # Vite on http://127.0.0.1:5200
#   app:            http://127.0.0.1:5200/index.html?fixture=1#/p/page-rea
#   window sim:     http://127.0.0.1:5200/window.html?tabs=5   (tab bar + iframes)
#   hermetic:       add &storage=memory ; theme: &theme=dark ; harness fonts: &harness=1
npm run typecheck      # app + desktop
npm run build          # tokens + renderer dist + Electron main/preloads (esbuild)
npm run rebuild        # once: rebuild better-sqlite3 for Electron's ABI (falls back to JSON storage otherwise)
npm run electron       # desktop shell, serves the built renderer from inkwell://app/
npm run electron:dev   # desktop shell against Vite :5200 (INKWELL_DEV_URL)
#   env: INKWELL_USER_DATA=<dir>  INKWELL_LOCALE=zh-CN|en  INKWELL_FIXTURE=1
#   on the box: xvfb-run -a npx electron packages/desktop --no-sandbox
npm run parity         # every harness (packages/parity/run.mjs [job…]); results in docs/PARITY.md
```

## Layout
- `packages/tokens`: token pipeline → `generated/tokens.css` (`--ink-*` vars, light/dark/high contrast).
- `packages/shared`: brand + IPC channel names.
- `packages/app/src`:
  - `store/`: block model, transactions + undo, fixture (REA reference page), persistence (IndexedDB / native / memory).
  - `app/`: UI state (routing, theme, sidebar), page helpers.
  - `ui/`: icons (Lucide), popover stack, menu, toast, page icon.
  - `shell/`: Sidebar (+peek, resizer), Topbar, TabBar, RowMenu, Trash, Settings, Search, WorkspaceSwitcher, MoveTo.
  - `editor/`: rich text, caret, registry, commands, keyboard, input rules, slash/@/: menus, inline toolbar, block menu, link popover, emoji picker, equation, clipboard, code highlight, Blocks renderers.
  - `page/`: PageView (header/cover/icon/title, handles, DnD, rubber band, selection keys, outline), media.
  - entries: `entry-index.tsx` (app), `entry-window.tsx` (browser window simulator), `entry-tabbar.tsx` (Electron tab bar).
- `packages/desktop`: Electron main (`src/main.ts`: WindowController with a tab-bar WebContentsView + one view per tab, B02b menus, deep links, protocol), `db.ts` (SQLite WAL / JSON fallback), `state.ts` (window-state.json), `labels.ts` (menu strings), preloads; bundled by `build.mjs` (esbuild → dist/*.cjs).
- `packages/parity`: Playwright harness (Chrome for Testing 1208 in ~/.cache/ms-playwright):
  - `geometry.mjs [light|dark]` → `docs/parity/geometry-*.md` (rects vs reference computed captures)
  - `editor.mjs [light|dark]` → `docs/parity/editor-*.md` (hover handles, block menu, slash, toolbar, page menu, search)
  - `b08.mjs` → `docs/parity/B08_p*_*.png` (reference | ours | diff, 7 scroll pages × 2 themes) + `out/b08.json`
  - `b04.mjs` → header variants (none / icon / cover / icon+cover)
  - `smoke.mjs` → interaction smoke tests (slash, media, markdown, undo, selection, sidebar, theme, toolbar, link, @, :, menus, settings, DnD)
  - `b03.mjs` sidebar states, `b05.mjs` block menus, `b05b.mjs` editor popovers
  - `electron.mjs` → real Electron under Xvfb over CDP (`cdp-lite.mjs`): tabs, SQLite, restore, deep link, menus (20 checks)
  - helpers: `compare.py` (pixel diff), `rows.py` (text-row drift), `bbox.py` (glyph bbox), `shot.mjs`

## Status
- [x] Monorepo, tokens, shared brand/IPC
- [x] Store, fixture, persistence
- [x] Shell components (sidebar, topbar, menus, settings, trash, search, switcher)
- [x] Editor modules; CSS; typecheck clean; runs on 5200 with no page errors
- [x] Parity harness running from the first render (geometry, B08 pixels, B04 header, B02 tab bar, editor menus)
  - page/block geometry: 65/67 within 1px (table is intentionally in-column; reference is full-bleed)
  - header variants: title position ±1px in all four variants
  - tab bar: tab pitch/edges exact for 1/5/15 tabs
  - menus: block menu, page menu, slash menu, handles within 1px; search modal + inline toolbar pending
- [x] Smoke tests: 16/16 pass
- [x] Search modal rebuilt to B07 (filters row, recents/results, preview pane, footer hints); geometry exact (surface/input/rows within 0.4px)
- [x] Inline toolbar grid (editor.mjs 37/38 light & dark; remaining miss is a test artifact)
- [x] B03 sidebar variants (`b03.mjs`: default/collapsed/peek/max/min/restored, 2.7–4.6% mismatch, mostly font glyphs); promo card restyled, customise row moved into the scroller, bottom fade
- [x] B05 block hover/handle/menu/colour/turn-into (3.5–7.7%); B05b slash, toolbar, colour grid, link popover + hover, mention, emoji inline + picker restyled to the refs
- [x] docs/PARITY.md (all harness results, side-by-sides, accepted differences)
- [x] Electron shell: window + tab views, native menus (51/51 vs B02b), tab context menu, state restore, SQLite (WAL) + JSON fallback, cross-tab live sync, new-tab palette, deep links (`inkwell://page/<id>`), troubleshooting menu; `electron.mjs` 20/20

- [x] Mac test build: `scripts/build-mac.sh` (electron-builder zip arm64 on Linux, rcodesign ad-hoc, symlink-safe zip, 25 MB parts, md5); see docs/MAC_TEST.md
  - v1 21:45 JST (pre-M4) md5 59cedbcf2a33597b69b9cd433263470a
  - v2 22:26 JST from 0915893 (M3 + M4) md5 0de66e7361477ab8158e590497e394d3
- [x] M3: sub-pages, link to page, @ page/person/date mentions, `[[`, back/forward (⌘[ / ⌘]), side peek 660 / center peek 960×680 r12 (Alt / Alt+Shift click on page links, rows), page menu (appearance, lock, trash, move, duplicate), page lock (read-only editables, 已锁定 chip), trash search / restore / delete, find in page (⌘F, highlights, n/m, Enter / ⇧Enter)
- [x] M4: `packages/app/src/db/` — inline + full-page DBs, 13 property types (text, number, select, multi, status, date, person, checkbox, URL, email, phone, formula, created time), Table / Board / List / Gallery S-M-L views, filter / sort / group, calculations, cell editors, header / type / new-view / settings menus, view tabs with overflow, row peek; REA DB fixture 14 props × 12 rows
  - `db.mjs` pixel parity (20 cases × light/dark) and `db-geometry.mjs` (42/44 within 1px vs computed/db_*.json); `m3m4.mjs` behaviour checks 26/26
- [x] M3 additions: `[[` opens a pages-only link menu (caret fix: `textLength` skipped editables carrying `data-placeholder`), version history (B07: per-minute snapshots, preview, restore), trash no-match state
- [x] M5: Calendar and Timeline views (drag to move dates, today line at the current time, month labels), relation + rollup properties, database templates
  - `b07.mjs` (page menu / trash / history), B01c dark comparisons in `db.mjs`; `m3m4.mjs` 41/41

## Next
1. Help / updates / shortcuts panels and library menu (rest of B07).
2. Files property; multiple data sources; view drag reorder; timeline zoom levels.
3. Comments, sharing/publish UI (local only), export (HTML/PDF via printToPDF).
4. Signing / notarisation, auto-update stub.
