# Phase 1 validation — 30 September 2026

- Dependencies installed; esbuild/Sharp build scripts explicitly allowed.
- Formatting, ESLint and strict Astro/TypeScript checks pass.
- Static production build: 12 HTML pages plus robots and sitemap.
- 15 Chromium smoke tests pass against production preview.
- Tested 1920×1080, 1440×900, 1280×800, 900×900, 390×844, 320×740 in both Light and Dark.
- No horizontal page overflow; 3/2/1 project columns; all five card rows aligned; hero visual hidden on narrow screens.
- Theme persistence, Light/Dark/System and live OS changes pass.
- Native mobile menu, Escape focus return, skip link focus and anchor clearance pass.
- Real clipboard write/read and rejected clipboard fallback pass.
- Internal links return 200; Home content and native menu remain usable without JS; unsupported enhancement controls stay hidden.
- Four full-page screenshots captured and visually reviewed in `docs/screenshots/`: desktop/mobile × light/dark. Checked section rhythm, title wrapping, cover/card alignment, Cyrillic titles and contact reflow.
- Temporary 1400×900 raster fixture successfully built into five responsive WebP variants with intrinsic dimensions. Fixture and test route removed after verification; illustrative SVGs remain vectors.

Expected build notice: Notes collection is intentionally empty. No fake note has been created to silence it.

Not verified: Safari/Firefox, physical phone, screen reader audit, complete WCAG conformance, production field LCP/CLS/INP. No production deployment.

Review next: hero proportions and type, temporary project illustrations, Experience signal usefulness, publication bibliography, real project dates, SIRD implemented stack, Russian translations. The UralCon paper is still accepted, not represented as published. Phase 2 has not started.

## Phase 1.1 — visual and readiness calibration

- Hero now occupies the viewport below the sticky header; Projects begins after the fold at all existing test sizes.
- Internal “View all” links share one centered pattern; desktop navigation has left/center/right zones.
- Theme control is an accessible System → Light → Dark icon cycle with persisted preference and a visible mobile label.
- Format, ESLint, strict Astro/TypeScript, production build and the existing 15 Playwright tests pass.
- Updated 1440×900 and 390×844 screenshots were reviewed in Light and Dark.
- Official Astro/GitHub Pages deployment path and Git-first authoring flow are documented. No remote repository, Pages setting, DNS record or deployment was changed.
