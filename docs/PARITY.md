# Inkwell parity report

Reference: captures of the 7.40.1 desktop app in `/workspace/notion-research/ref` (B01–B08, computed styles).
Ours: Inkwell renderer on Vite :5200 (Playwright, Chrome for Testing 1208, 1320×824 webview, dpr 1/2, light + dark), and
the real Electron 44 shell under Xvfb, driven over CDP.

Every number below was produced by the harnesses in `packages/parity` (`npm run parity`, or `node packages/parity/run.mjs <job>`).
Side-by-side images are `reference | ours | diff` (diff = pixels whose channel delta > 24, red); they live in `docs/parity/`.

## Summary

| Area | Harness | Result |
|---|---|---|
| Interaction smoke (slash, markdown rules, undo, selection, sidebar, theme, toolbar, link, @, :, menus, settings, DnD) | `smoke.mjs` | **16/16** |
| Page/block geometry vs computed captures | `geometry.mjs` | **65/67** within 1px (light and dark); the 2 misses are the table block, deliberately kept in-column (reference is full-bleed) |
| Editor chrome geometry (handles, block menu, slash menu, page menu, inline toolbar, search modal) | `editor.mjs` | **37/38** within 1px; the miss is the toolbar x offset (−1.9px), a selection-end measuring artefact |
| Sidebar states B03 (default / collapsed / hover peek / max / min / restored) | `b03.mjs` | 2.7–4.6% pixel mismatch, all font-glyph antialiasing; widths/positions exact |
| Page header variants B04 | `b04.mjs` | none 0.4–0.6%, icon 1.2%; title ±1px. cover variants 22%: the cover *image* differs (ours is an original illustration) |
| Full reference page B08 (7 scroll positions) | `b08.mjs` | sidebar 4.6%; text pages 1.6–3.1%; p3/p5 10–13% and p4 50% are pages dominated by media (embedded images, video, bookmark thumbnails we do not copy) |
| Block hover / handle / block menu / colour / turn-into B05 | `b05.mjs` | 3.5–3.8% (hover, handle, block menu); colour 5.8–6.3%, turn-into 5.7–7.7% (glyphs, plus the ref's own scroll offset) |
| Slash, inline toolbar, colour grid, link popover/hover, mention, emoji inline/picker B05b | `b05b.mjs` | visual side-by-sides (refs were shot at varying scroll offsets, so crops are paired by box, not diffed as a %) |
| Electron shell | `electron.mjs` | **20/20** (below) |
| Native menus vs B02b accessibility dump | `electron.mjs` | **51/51** app-defined items, menu-bar order exact; macOS system-injected items (Services, Speech, AutoFill, window tiling, traditional-Chinese entries) are supplied by the OS |
| Tab bar B02 (1/5/15 tabs) | earlier window-sim checks | tab pitch and edges exact; real Electron tab bar vs `B02_tabs_1` 6.2% (the Linux capture has no traffic lights) |
| New-tab window B02 `newtab_empty` | `electron.mjs` | 5.8% (was 35.6% before the new-tab palette landed) |

## Electron shell checks (`electron.mjs`, real Electron under Xvfb)

1. Storage backend is SQLite (better-sqlite3 rebuilt for Electron's ABI; JSON fallback if the module does not load)
2. Tab view is 1320×824 under a 36px tab-bar view
3. Preloads expose `inkwellNative` (page views) and `inkwellTabs` (tab bar)
4. Tab-bar pixel diff vs B02_tabs_1 (6.16%)
5. Ctrl/Cmd+N creates a page; typing into its title
6. Tab-bar "+" opens a second WebContentsView
7. Only the active tab view is visible
8. Tab title follows the page title
9. A new tab opens the "在新选项卡中打开…" palette (新对话 / 新页面 first, then recents)
10. New-tab window diff vs B02_newtab_empty (5.82%)
11. Ctrl/Cmd+1 activates the first tab
12. Editing the title in tab 1 updates the hidden tab 2 live (main-process fan-out of writes)
13. window-state.json holds both tabs with their hash, title and active flag
14. SQLite file on disk (`inkwell.db` + WAL)
15. Restart restores both tabs
16. The restored active tab is the one that was active at quit
17. A page created before restart is still there (read back from SQLite)
18. `inkwell://page/<id>` passed to a second instance navigates the running window's active tab
19. Native menu items match B02b (51/51)
20. Menu bar order: Inkwell / 文件 / 编辑 / 视图 / 历史 / 窗口 / 帮助

## Side-by-sides worth opening

- `docs/parity/B03_default_light.png`: sidebar default state
- `docs/parity/B08_p1_light.png`: top of the reference page (headings, inline styles, lists)
- `docs/parity/B05_block_menu_light.png`: block (⋮⋮) menu
- `docs/parity/B05b_slash_menu_top_light.png`: slash menu
- `docs/parity/B05b_emoji_picker_full_light.png`: emoji picker
- `docs/parity/E02_newtab_light.png`: real Electron window, new-tab palette vs B02_newtab_empty
- `docs/parity/E01_window_light.png`: real Electron window (tab bar + page view)
- tables: `docs/parity/geometry-light.md`, `docs/parity/editor-light.md` (computed rect deltas, ✅/❌ per element)

## Known, accepted differences

- **Fonts.** We ship the system stack (no Lyon/iA), so glyph shapes differ; this accounts for most of the 2–5% residue.
- **Media.** Cover images, embedded images, video posters and bookmark thumbnails are original or placeholder art, never the reference's assets (B04 cover, B08 p3–p5).
- **Table width.** Tables stay in the text column; the reference is full-bleed (2 geometry misses).
- **Drag ref.** The B05b drag-in-progress reference shows no indicator (capture failed), so there is nothing to compare.
- **Emoji ordering.** Inline `:` results are ordered by our own keyword index, not the reference's popularity data.
- **Not implemented.** The tabs block, and the `@今天` ghost placeholder in the mention menu.
- **macOS-only bits** (traffic lights, system menu items) cannot be shot on the Linux box; menus are checked structurally against the accessibility dump instead.
