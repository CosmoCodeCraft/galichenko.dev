# GitHub Pages deployment

Status: **ready with small external configuration changes**. The site is a fully static Astro build, and all collection routes are generated at build time, so GitHub Pages can serve `dist/` without an adapter.

The local draft workflow at `.github/workflows/deploy.yml` follows Astro's official [GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/). On a push to `main`, `withastro/action` installs the locked pnpm dependencies, runs lint, typecheck and build, uploads the Pages artifact, and `actions/deploy-pages` publishes it. Playwright stays outside the fast publishing path.

## One-time GitHub setup

1. Create or connect the GitHub repository and push this source tree, including `pnpm-lock.yaml`.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. In **Settings → Pages → Custom domain**, enter `sergeygalichenko.dev`.
4. Configure DNS, wait for GitHub's domain check and certificate provisioning, then enable **Enforce HTTPS**.

GitHub documents the required permissions and artifact flow in [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). No repository, Pages setting, DNS record or deployment has been changed from this workspace.

Before the first push, confirm that the local repository is on `main` and that `origin` points to `CosmoCodeCraft/galichenko.dev`.

## Domain and base path

`astro.config.mjs` is already correct for the intended production URL:

```js
site: "https://sergeygalichenko.dev";
```

With the custom apex domain, `base` must remain unset. Assets, root-relative internal routes, canonical URLs, hreflang links, Open Graph URLs, robots and sitemap then all resolve from `https://sergeygalichenko.dev`.

Before the custom domain is connected, a normal project Pages URL would be `https://<account>.github.io/<repository>/`. That temporary URL requires `site: "https://<account>.github.io"`, `base: "/<repository>"`, and base-aware internal links. The current site intentionally does not support that temporary subpath. Configure the custom domain before treating the Pages deployment as public; do not add a temporary base and then remove it.

GitHub's current documentation says a `CNAME` file is ignored and is not required when publishing with a custom Actions workflow. Configure the domain in repository settings instead.

## DNS for `sergeygalichenko.dev`

GitHub Pages supports apex domains. At the DNS provider, use either an apex `ALIAS`/`ANAME` to `<account>.github.io`, or GitHub's four documented `A` records:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

GitHub also publishes optional IPv6 `AAAA` records. Add `www` as a `CNAME` to `<account>.github.io` if the `www` redirect is wanted. Avoid wildcard DNS records. Verify the domain in GitHub before changing DNS when practical. Follow the current [custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) rather than copying stale DNS values from this file.

## Before production

- Confirm the repository default branch is `main` and Pages uses GitHub Actions.
- Confirm the custom domain and DNS checks pass, then enforce HTTPS.
- Open the deployed Home and at least one generated detail route.
- Verify `https://sergeygalichenko.dev/robots.txt` and `/sitemap.xml`.
- Check canonical and hreflang values in rendered HTML.
- Keep skeleton/detail routes `noindex` until their content is ready; the sitemap currently lists Home only by design.

## Repository hygiene

`node_modules`, `dist`, `.astro`, Playwright results/reports and `.DS_Store` are ignored. The lockfile and the four visual-review screenshots are suitable to commit. The two standalone design-research HTML files are not shipped in `dist`; keep them if the public repository should preserve design rationale, or move them to `docs/reference/` before the first commit. No source material was deleted or moved during this audit.
