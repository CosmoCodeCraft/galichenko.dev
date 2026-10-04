# galichenko.dev

galichenko.dev is a static Astro + strict TypeScript engineering portfolio and research archive. Projects, research publications, Notes, About and CV are content-driven; GitHub Actions validates and deploys the site to GitHub Pages at sergeygalichenko.dev.

Live: https://sergeygalichenko.dev

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

English public content is enabled; Russian UI remains disabled until translations are supplied. The CV is a production route with a downloadable resume, and the Home Hero includes a bounded client-side interaction model. The first standalone galichenko.dev version is complete, while project, publication and Notes archives will continue to grow. SIRD technologies and unknown dates or venues are not invented, and the UralCon paper remains accepted rather than published. Remaining media placeholders belong only to case studies that still lack supplied evidence.

In this Codex workspace, Node/pnpm are bundled rather than on the shell PATH. To use the existing installation:

```sh
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
pnpm dev
```

See [validation](docs/validation.md) for the tested scope and remaining review items.

Deployment is documented in [GitHub Pages deployment](docs/deployment.md). Routine content is added through the typed Markdown/MDX collections under `src/content/`; `pnpm content:new` creates draft records without publishing them.

## Reusable audit bundles

With the repository's Node and pinned pnpm installed, run `pnpm install` once, then:

```sh
pnpm audit:bundle
```

This builds the current working tree, discovers all `dist/**/*.html`, extracts text,
metadata and links, starts Astro preview, captures screenshots with the locked
Playwright Chromium, and writes `audit-output/galichenko-dev-audit-<SHORT_SHA>.zip`.
Chromium installs automatically if absent. On Linux, install browser system
libraries once with `pnpm exec playwright install-deps chromium` (may need sudo).
No Codex, AI model, API key, or external service is required. Dependencies/browser
installation can need network access; capture uses only local build resources.

In GitHub Actions, select **Generate audit bundle → Run workflow**, choose the
branch/ref, and download the resulting artifact ZIP. The workflow uses the same
command and the pnpm version in `package.json`; it only runs manually.

New routes, Notes, publications, changed copy, metadata and project details enter
HTML/text/metadata automatically. Only emitted `noindex`/`none` robots pages are
excluded, with reasons recorded in the manifest. No current pages are excluded.
Raw HTML is unchanged; text is a structural extraction preserving headings,
lists, tables, links and repeated content. It does not infer CSS visibility, so
navigation, footer and closed-dialog text remain. HTML is evidence, not a bundled
offline application: linked PDFs, media and application assets are not copied.

Edit **`audit.config.mjs`** for screenshot membership or viewport policy. The
initial full-page desktop set covers six top-level pages, four key projects,
the latest publication, and latest/earliest Notes. Publication selection uses
the declared year emitted in its metadata line; Notes use the first header
`time[datetime]`. Ties use ascending route order. When only one Note exists,
latest/earliest are deduplicated. Missing dates or required routes fail loudly.
The config also lists the smaller dark, mobile and initial-viewport subsets.
Major changes to routing, theme storage, or detail-page date markup may require
updating config/selectors or the generator; routine content changes do not.

Each capture uses a fresh page, explicit theme storage and color scheme, scale
factor 1, en-US browser locale, UTC and the site's native reduced-motion mode.
No screenshot CSS is injected. Initial-viewport captures never scroll; full-page
captures load lazy images and return to the top. External requests (including
analytics) are blocked. Missing local resources or broken images fail the run.
Selections, file order and ZIP entry timestamps are deterministic. Generation
time, build-time content (such as copyright year), platform/fonts and browser
versions can affect bytes; manifests record the environment. This does not
promise byte-identical screenshots across operating systems.

The manifest records exact HEAD, branch (null for detached HEAD), and whether the
working tree was dirty. A dirty snapshot represents current files, not just HEAD;
use a clean checkout for commit-only evidence. Repository URLs are sanitized and
no diffs, source files, credentials, logs or browser state are packaged. Artifacts
are allowlisted, hashed, and checked after reopening the ZIP. Equivalent emitted
Person objects are deduplicated with source routes; distinct objects are retained.
Internal links omit query/fragment variants but retain links to public file assets.
Temporary files and preview/browser processes are cleaned up; ZIPs stay ignored
in `audit-output/` and a successful rerun at the same SHA replaces its ZIP.

Run `pnpm test:audit` for focused extraction, selection and safety tests. The normal
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` still apply.
