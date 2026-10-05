# Security policy

## Security model

`galichenko.dev` is currently a statically generated Astro site deployed to
GitHub Pages. It has no application backend, authentication, database, user
uploads, user-generated content, or server-side sessions.

Its main security surfaces are the GitHub account and repository, CI/CD and
GitHub Actions, the dependency supply chain, DNS and domain ownership,
third-party browser scripts, and accidental publication of sensitive information
or metadata. Reassess this model whenever the architecture changes.

## Security invariants

- Pin GitHub Actions to full immutable commit SHAs.
- Give each workflow and job only the permissions it needs.
- Keep `pnpm security:check` in deployment validation.
- Keep development and preview servers bound to localhost by default. The LAN
  scripts are deliberate opt-in commands.
- Do not weaken release-age or other supply-chain safeguards solely to make a
  vulnerability audit report zero findings.
- Add infrastructure only when a concrete requirement justifies its security and
  maintenance cost.

## Sensitive data

The repository and published site must not unintentionally expose real SNILS
numbers, passport data, phone numbers, Telegram contact details, home addresses,
precise coordinates or GPS metadata, private keys, access tokens, passwords,
other credentials, or private identifiers.

The public academic email `sagalichenko@edu.hse.ru` is intentional. The word
“SNILS” is also allowed as a document or project-domain term; legitimate academic
and project descriptions using it are not personal data. Cloudflare Web Analytics
beacon identifiers are public configuration rather than secrets.

## Binary and media review

Before publishing a new PDF, photograph, WebP/PNG/JPEG image, video, or other
binary file, review it for:

- unintended personal information;
- EXIF, XMP, GPS, or similar metadata where applicable;
- embedded attachments, scripts, or forms where relevant;
- filenames and document metadata that reveal unnecessary private information.

Original scientific papers that are already published should not be rewritten
solely to remove historical publication metadata unless a specific privacy or
security reason requires it.

## Dependencies

Dependabot monitors dependencies and GitHub Actions. Evaluate alerts using both
severity and the realistic attack path in this deployment. A transitive advisory
without a reachable production path may remain as accepted residual risk until
an upstream fix is available.

Keep dependencies on supported, secure versions when reasonably possible. Do not
use incompatible overrides or bypass release-age and supply-chain safeguards
solely to report `0 vulnerabilities`.

## Manual security controls

The repository owner should keep these controls enabled or periodically verify
them where the relevant service supports them:

- protect the default branch against deletion and force-push;
- protect the GitHub account with 2FA or a passkey;
- protect registrar and domain-management accounts;
- enforce HTTPS for the production site;
- enable Dependabot alerts and security updates;
- enable secret scanning and push protection where available;
- verify the production domain;
- avoid unnecessary wildcard DNS records;
- require full-SHA GitHub Actions references where repository policy supports it.

This document does not assert the live state of controls that cannot be proven
from repository contents.

## Accepted residual risks

Under the current static architecture, the following may be acceptable:

- no Content Security Policy while there is no meaningful user-controlled HTML
  or input surface;
- Cloudflare Web Analytics as the intentional third-party executable script;
- historical personal email or benign metadata in original, already-published
  academic PDFs;
- unsigned Git commits;
- dependency advisories with no reachable production path and/or no upstream fix.

Reconsider these decisions if the architecture, threat model, or published data
changes.

## Re-audit triggers

Require a new security review if the site gains or materially changes any of the
following: a backend or server-side runtime, authentication or authorization,
forms that process user data, API endpoints, a CMS, user uploads, user-generated
content, a database or other storage, cookies or sessions, additional third-party
scripts or widgets, hosting or CI/CD architecture, or DNS/domain setup.

Routine content edits do not require a full security audit, but remain subject to
the sensitive-data and media-review rules above.

## Incident response

If a secret or credential is exposed, revoke or rotate it immediately. Assume Git
history may retain the old value; a later commit that deletes it is not sufficient
remediation.

If sensitive personal information is published accidentally, remove it from the
live site promptly and assess whether Git history, build artifacts, caches, or
other copies also require remediation.

## Reporting a vulnerability

To report a security concern about this personal open-source portfolio, email
`sagalichenko@edu.hse.ru` with a concise description and reproduction details.
There is no commercial bug-bounty program.
