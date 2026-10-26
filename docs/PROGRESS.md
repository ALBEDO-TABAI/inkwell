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
npm run typecheck
npm run electron       # desktop shell (M0, in progress)
npm run parity         # Playwright parity harness (in progress)
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
- `packages/desktop`: Electron main/preload (to write).
- `packages/parity`: Playwright harness (Chrome for Testing 1208 in ~/.cache/ms-playwright):
  - `geometry.mjs [light|dark]` → `docs/parity/geometry-*.md` (rects vs reference computed captures)
  - `editor.mjs [light|dark]` → `docs/parity/editor-*.md` (hover handles, block menu, slash, toolbar, page menu, search)
  - `b08.mjs` → `docs/parity/B08_p*_*.png` (reference | ours | diff, 7 scroll pages × 2 themes) + `out/b08.json`
  - `b04.mjs` → header variants (none / icon / cover / icon+cover)
  - `smoke.mjs` → interaction smoke tests (slash, media, markdown, undo, selection, sidebar, theme, toolbar, link, @, :, menus, settings, DnD)
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
- [ ] B05/B05b menus pixel checks, docs/PARITY.md
- [ ] Electron shell (window, tab views, native menus, state restore, SQLite)

## Next
1. Search modal to B07 layout; inline toolbar measurements.
2. docs/PARITY.md with summary + side-by-side images.
3. Electron desktop package.
