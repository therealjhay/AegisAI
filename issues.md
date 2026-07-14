# AegisAI — Audit Issues

> Generated from `/audit` on 2026-07-14. Score: 12/20 (Acceptable). All issues resolved 2026-07-14.

## P0 — Blocking

- [x] **#1** — BAN 1: Remove side-stripe border on `.alert-card::before` (`globals.css:168-178`) — *removed, commit 578e10d*
- [x] **#2** — Fix interactive map `role="img"` → `role="application"` (`MapHeatmap.tsx:195`) — *fixed, commit ad66d1e*

## P1 — Major

- [x] **#3** — Add visible `<label>` to sector filter `<select>` (`CommandCenter.tsx:237-245`) — *added visible "Sector" label, commit d9dfe52*
- [x] **#4** — Replace hard-coded hex colors in `globals.css` with design tokens — *replaced with hsl(var(...)) tokens, commit 578e10d*
- [x] **#5** — Replace hard-coded colors in MapHeatmap paint properties with shared constants — *extracted to lib/theme.ts MAP_COLORS, commit b6f2eda*
- [x] **#6** — Add keyboard accessibility for Mapbox point markers (`MapHeatmap.tsx:149-155`) — *added Enter/Space keydown handler, commit b6f2eda*
- [x] **#7** — Remove glassmorphism: drop `backdrop-filter: blur(14px)` on `.hud-metric` (`globals.css:125`) — *removed, commit 578e10d*
- [x] **#8** — Restructure hero metrics from 3-card grid to compact status strip (`CommandCenter.tsx:270-286`) — *condensed to single inline status bar, commit d9dfe52*
- [x] **#9** — Replace Geist Sans font with distinctive, intentional pairing (`layout.tsx:4-13`) — *replaced with Public Sans (body) + Saira (headings), commit 0875855*
- [x] **#10** — Remove decorative scanline/radar animations (`globals.css:215-245`) — *removed scanline, radar-grid, radar-sweep + keyframes, commit 578e10d*
- [x] **#11** — Fix badge contrast: `text-red-100`/`text-amber-100` on low-opacity backgrounds (`PrioritySidebar.tsx:28-32`) — *switched to solid bg colors with white text, commit 1b6450c*

## P2 — Minor

- [x] **#12** — Add `will-change` hints to animated elements (`globals.css`) — *added to tactical-pulse, funding-fill::after, brand-lockup::after, commit 578e10d*
- [x] **#13** — Increase sheet handle touch target from 32px to 44px (`PrioritySidebar.tsx:86-93`) — *increased to h-11, commit 1b6450c*
- [x] **#14** — Consolidate multiple `useEffect` hooks in `CommandCenter.tsx` — *merged fetch + polling into single effect, commit d9dfe52*

## P3 — Polish

- [x] **#15** — Replace hardcoded `body` background `#0a0a0b` with `hsl(var(--background))` (`globals.css:38`) — *fixed, commit 578e10d*
- [x] **#16** — Improve loading skeleton contrast (`loading.tsx`, `PrioritySidebar.tsx:108-112`) — *changed to bg-border/50, commit cf69767*
- [x] **#17** — Replace close button `x` with `×` entity or SVG icon (`CommandCenter.tsx`) — *replaced with ×, commit d9dfe52*