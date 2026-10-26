# Round 4 side-by-sides (reference | Inkwell | diff)

Reference: 7.40.1 desktop captures in `/workspace/notion-research/ref`. Ours: Inkwell renderer at 1320×824, same fixture state. Diff = pixels with channel delta > 24 (red).

| File | Feature | Mismatch |
|---|---|---|
| `B07_help_menu_light.png` | Help menu with release-notes rail | 4.62% |
| `B07_shortcuts_modal_light.png` | Keyboard-shortcuts modal | 3.07% |
| `B07_updates_panel_light.png` | Updates right panel (from version snapshots) | 5.62% |
| `B06_group_menu_light.png` | DB group panel, docked right of the table | 4.57% |
| `B06_view_timeline_light.png` | DB timeline view (zoom levels) | 2.17% |
| `B05b_mention_menu_light.png` | `@` menu with the `@今天` ghost (visual pair; reference shot at a different scroll offset) | — |

`motion/*-strip.png`: frames at fixed times (paused Web Animations) for sidebar collapse, center peek, menu fade, spring switch, topbar idle fade (`packages/parity/motion.mjs`, 13/13 timings vs SPEC).
