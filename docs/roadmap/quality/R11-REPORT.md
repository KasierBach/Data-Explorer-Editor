# R11 — Responsive header and mobile controls

Status: VERIFIED_LOCAL. Baseline HEAD `3d7ec60845ddc2a07284c2873d9d3727acd30744`; current uncommitted frozen tree retained R00–R10 and `.zcode/`.

## Scope and impact

- Replaced the overlapping absolute-positioned header groups with wrapping layout. `Navbar` risk LOW: two direct shell callers/processes (`AppShell`, `NoSqlShell`).
- Kept SQL, NoSQL, Teams, theme, Explorer, result, AI, desktop-mode and profile actions reachable; no action was hidden without another path.
- `ModeToggle` impact HIGH through both shell flows. The theme toast was removed after regression showed it intercepted Teams; changing theme remains immediately visible.
- Mobile bar text now uses the existing VI/EN layout translations.
- Header stacking stays below existing dialog/dropdown portal layers. The 31/10 Firefox 320px Profile-menu interception RED was fixed by lowering only Navbar's layer; shared primitives, shell routing and actions were unchanged.
- UI UX Pro Max lookup used the existing responsive-navigation/touch-target guidance; no design-system rewrite.

## Verification

- Frozen original 360px case RED: SQL mode control absent/unreachable in original clean export.
- Final R11 matrix: 56 cases, widths 360/390/412/768/1024/1280/1440 × VI/EN × light/dark × session timer state. Each case asserts the timer is present above 480px for active sessions and intentionally omitted in narrow mobile chrome, then checks viewport bounds, pairwise control overlap, SQL→NoSQL→SQL navigation, localized theme action and Teams navigation. Because the Windows process was interrupted in a single long run, final evidence used one owned Playwright process per width: all seven batches exit0 in `output/roadmap-final-clean-20261026/r11-localized-final-results.json`.
- Existing mobile Chromium/WebKit flows remain part of the final full browser gate. Vietnamese mobile labels have a focused browser assertion.

## Limits

- Automated geometry and interaction checks cover the configured desktop Chromium/Firefox header suites and mobile Chromium/WebKit flows; the 31/10 reflow regressions also verify Profile menu pointer/keyboard access. Final browser counts and tested snapshots are in [manifest31/10](cleanup-r10-r14-verification-2026-10-31.json); remote CI is NOT_RUN.
- Actual browser zoom was attempted but the host did not change the measured viewport/scale. Keep NOT_VERIFIED_HOST_CAPABILITY; viewport reflow is not substituted as real zoom. Final status remains VERIFIED_LOCAL, not DONE.
