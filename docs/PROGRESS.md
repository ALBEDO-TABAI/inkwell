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
- `packages/parity`: Playwright harness (to write).

## Status
- [x] Monorepo, tokens, shared brand/IPC
- [x] Store, fixture, persistence
- [x] Shell components (sidebar, topbar, menus, settings, trash, search, switcher)
- [x] Editor modules (all written, NOT yet typechecked/run)
- [ ] CSS (styles/app.css, styles/tabbar.css) — in progress
- [ ] First typecheck + Vite run on 5200
- [ ] Playwright parity harness + docs/PARITY.md
- [ ] Electron shell (window, tab views, native menus, state restore, SQLite)
- [ ] Commits per milestone

## Next
1. Write CSS, typecheck, run Vite, fix runtime errors.
2. Parity harness: screenshot B08/B03/B05 states, pixel diff per region, computed deltas.
3. Electron desktop package.
