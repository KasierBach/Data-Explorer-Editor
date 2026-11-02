# R12 — Accessibility, modal, i18n and 2FA state

Status: VERIFIED_LOCAL. Current uncommitted frozen tree retains R00–R11 and `.zcode/`.

## Scope and impact

- `ProfileDialog` now uses the existing Radix dialog primitive for role/name, focus trap, Escape and return focus. LOW risk: direct `Navbar`/shell callers.
- Associated Profile, Security and Connection field labels with controls. `ConnectionDialog` was HIGH risk through five entry points (SQL/NoSQL shells, ERD and visualization); the change is limited to semantics and accessible names.
- Added names for audited Explorer, tab, AI and navigation controls; decorative engine SVGs are hidden from assistive technology.
- `ResultTable` scroll region is focusable and named.
- Dashboard quick actions and Provision Server use native buttons. Recent-connection edit/share/delete actions now have localized accessible names, and their desktop hover-only opacity also becomes visible on keyboard focus. The last Dashboard RED was zero named delete buttons in both EN/VI; focused Chromium/Firefox name/focus/axe checks passed 4/4 after the fix.
- `App` remains the sole runtime owner of `<html lang>`; the critical-risk shared SEO component was not changed. Browser checks cover public route → workspace → reload.
- 2FA now displays “Not supported yet” / “Chưa hỗ trợ”; no enable CTA or fake success remains.
- Mobile workspace controls use existing VI/EN translations.
- `SaveQueryDialog` field labels now resolve through IDs; visibility/workspace selectors have accessible names and save errors have an alert/described-by association. A valid keyboard-entered query produced an axe `button-name` RED before this change; Chromium and Firefox focused Save checks passed afterward.
- Header stacking follows the existing portal layers: `Navbar` is below the dialog/dropdown `z-50` layer. The Firefox small-screen menu pointer-interception failure was reproduced before the fix; the reflow regression now checks both keyboard and pointer entry into Profile.
- Theme names and AI assistant toolbar, input and welcome copy follow the active VI/EN language. The synthetic `welcome` message is localized at render and copy time; the HIGH-impact persisted `aiChatSlice` was deliberately not changed.

## Verification

- Profile regression: dialog appears with a name, labels resolve, 30 Tab presses remain inside, Security exposes labels, 2FA is unavailable, Escape closes, focus returns to Profile. Axe critical/serious: zero in dialog.
- Authenticated data-loaded query result: Dashboard keyboard action, real query result scroll region focus, full workspace axe critical/serious zero in light and dark.
- Connection dialog: key fields resolve by label; dialog axe critical/serious zero.
- Language: `/docs` → SQL workspace → reload preserves `html[lang=en]`.
- Mobile Vietnamese labels, localized theme names and render-time AI welcome/input controls have focused browser assertions. Existing mobile Chromium/WebKit SQL/NoSQL interaction tests remain in the browser gate.
- Reflow checks cover 320/640 CSS-pixel widths × EN/VI × light/dark, Profile focus trap/return, pointer reachability and SQL/NoSQL keyboard navigation. These are viewport-reflow checks, not a fabricated browser zoom result.
- The real-backend browser suite includes a keyboard-only login, connection creation/selection, query execution, saved-query database readback, and Profile/Security/Escape round-trip. Monaco's native Ctrl+M enables Tab navigation out of the editor; no editor contribution change was needed.
- Focused component tests and client typecheck/lint/build are included in final clean gates.

Evidence: historical 26/10–27/10 logs remain under `output/roadmap-resume-20261026-*` and `output/roadmap-final-clean-20261026/`. Current Save error/labels, Dashboard controls, reflow, keyboard full-stack and direct-browser observations are in `output/roadmap-cleanup-20261031/` and the [31/10 verification manifest](cleanup-r10-r14-verification-2026-10-31.json).

Final totals and scope-qualified container/full-stack snapshots are recorded in [manifest31/10](cleanup-r10-r14-verification-2026-10-31.json). A later Dashboard-only accessible-name/focus correction was verified by a fresh complete client gate; earlier full-stack/container results remain tied to their tested snapshots, not silently relabelled as later image bytes.

## Limits

- Automated axe cannot prove all contrast/zoom/assistive-technology behavior. Actual zoom was attempted in the host browser on 31/10, but measured scale and viewport did not change; it remains NOT_VERIFIED_HOST_CAPABILITY rather than PASS. Direct 320px reflow/geometry/pointer/Tab/Escape/return-focus checks passed separately. Screen-reader acceptance is NOT_RUN.
- External 2FA/passkey enrollment/recovery remains a separate product/security package.
- Status is VERIFIED_LOCAL, not DONE or production-ready.
