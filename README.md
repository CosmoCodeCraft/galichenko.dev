# galichenko.dev

Static Astro + strict TypeScript portfolio. English Home, collection archives, publication details, project case studies and About are content-driven; CV remains a temporary route. GitHub Pages deployment is handled by the repository workflow.

## Local development

Tested with Node.js 24.19 and pnpm 11.25 (version recorded in package.json).

```sh
pnpm install
pnpm dev
```

Open http://localhost:4321. The dev server binds to all interfaces; use the computer's LAN IP and port 4321 from a phone on the same network.

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test
pnpm preview
```

Tests run against the production build. Screenshots are written to `docs/screenshots/` at 1440×900 and 390×844, in both themes. Other checks cover 1920, 1280, 900 and 320 widths, alignment, menu/keyboard, themes, clipboard, routes and no-JS content.

## Structure

```text
src/
  assets/projects/        Project cover and detail-media sources
  assets/about/           About portrait source
  components/home/       Independent Home sections
  components/            Header, cards, figures and detail-page shells
  config/                Site, navigation and Home order
  content/               Projects, publications, notes and profile data
  content.config.ts      Validated content schemas
  i18n/                  Dictionaries and locale/date/route helpers
  layouts/               Metadata and shared shell
  pages/                 Collection-driven static routes, sitemap, robots
  styles/                Central design tokens and responsive styles
  utils/                 Content queries and small enhancements
tests/                   Production smoke tests
public/media/projects/   Static project video assets
docs/deployment.md       GitHub Pages deployment guide
```

## Content boundaries

Project covers and the first media on each project case study use supplied real media; later case-study positions remain labelled neutral placeholders until further photographs, diagrams and results are supplied. SIRD technologies and unknown dates/venues are not invented. The UralCon paper remains accepted, not published. Russian UI is ready but its pages are disabled until translations are supplied. Substantive project, publication and About pages are indexed; the unfinished CV route remains noindex.

CV, Russian content, remaining case-study media and hero animation remain outside the current scope.

In this Codex workspace, Node/pnpm are bundled rather than on the shell PATH. To use the existing installation:

```sh
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
pnpm dev
```

See [validation](docs/validation.md) for the tested scope and remaining review items.

Deployment is documented in [GitHub Pages deployment](docs/deployment.md). Routine content is added through the typed Markdown/MDX collections under `src/content/`; `pnpm content:new` creates draft records without publishing them.
