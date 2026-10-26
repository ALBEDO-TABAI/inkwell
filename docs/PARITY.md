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
| Database views B06 (table, board, list, gallery S/M/L, calendar, timeline), light + dark | `db.mjs` | board 1.5–1.6%, list 2.0–2.1%, calendar 1.8%, timeline 2.2%, gallery 2.8–3.8%, table 4.1–4.2% |
| Row peeks B06 (side 660 from table, center 960×680 from gallery) | `db.mjs` | side 4.7–4.9%, center 2.8–2.9% |
| DB menus and editors B06b (views, header, type, filter, sort, calc, select/multi/status/text cells) | `db.mjs` | 2.4–7.0% (views 2.4, filter 4.3, header 4.4, cells 4.1–5.0, calc 5.8, sort 6.3, type 6.9) |
| B01c dark DB views (native window capture, tab bar cropped) | `db.mjs` | board 1.9%, calendar 2.1%, list 2.3%, timeline 2.6%, gallery 3.9%, table 4.5% |
| DB geometry vs `computed/db_light.json` / `db_dark.json` | `db-geometry.mjs` | **42/44** within 1px in both themes (below) |
| B07 page menu, trash (filtered), version history | `b07.mjs` | page menu 4.9–5.0%, trash 4.2–4.3%, history 4.2–4.8% (history text rows within 1px of the reference) |
| M3/M4/M5 behaviour (find, lock, peeks, cell editors, sort/filter/group/calc, formula, `[[`, @date, back/forward, history restore, relation + rollup, templates) | `m3m4.mjs` | **41/41** |
| Round 5 gaps (view drag, timeline zoom, @今天, emoji usage, files prop, group panel, comments, media, tabs, table, reminders) | `round5.mjs` | **44/44** |
| B07 help / 更多 / library menus, shortcuts modal, updates panel | `b07.mjs` | help 4.6–4.7%, 更多 4.8%, library 4.3–4.4%, shortcuts 2.5–3.1%, updates panel 5.6% |
| M7 (quick window, templates, settings panes, zh-TW, high contrast, import/export) | `m7.mjs` | **30/30** |
| Motion timings vs SPEC (sidebar width, peeks, menu/modal fades, spring, hover bg, chevron, topbar idle, tab-strip blur) | `motion.mjs` | **13/13**; frame strips in `packages/parity/out/motion/` |
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

## DB geometry (`db-geometry.mjs`)

Exact (±1px): DB title, view tabs, 新建 button, all header cells (160/200/100/110 × 36), rows (37), hover 打开 chip, board cards (260×40, pitch 48) and group pills, gallery cards S/M/L (198.5/270/413 × 128.5, gaps 16), calendar weekday labels, cells (120.14 × 124), today badge and event lanes, views menu (290), side peek (660×824) and its title, center peek (960×680 at 180,72) and its title.
The two misses: the second view tab is 1.5px narrower (glyph widths), and the computed capture puts the first select tag 6px further right than the reference screenshot does (the screenshot and ours agree at x=842).

## Side-by-sides worth opening

- `docs/parity/B06_view_board_light.png`, `B06_view_calendar_light.png`, `B06_view_timeline_light.png`, `B06_view_table_dark.png`: DB views
- `docs/parity/B06_row_peek_from_gallery_light.png`: center peek
- `docs/parity/B06_sort_menu_light.png`: sort chip bar + panel
- `docs/parity/B07_page_history_light.png`: version history
- `docs/parity/db-geometry-light.md`: DB rect deltas

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
- **Emoji ordering.** Inline `:` results rank by local usage, then our own keyword index (no reference popularity data).
- **Icons.** Lucide outline icons where the reference uses its own filled glyphs (DB property icons, toolbar), a large part of the 4–7% on DB menus.
- **Not implemented.** Multiple data sources per database; sharing/publish; analytics tab is a stub.
- **macOS-only bits** (traffic lights, system menu items) cannot be shot on the Linux box; menus are checked structurally against the accessibility dump instead.
