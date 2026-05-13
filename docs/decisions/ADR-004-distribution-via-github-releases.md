# ADR-004 — Distribution via GitHub Releases, not Marketplace

**Status**: 🔴 DA REVISIONARE — Documento non ancora approvato
**Date**: 2026-05-13

## Context

Sourcerer Visual needs a distribution channel: a way for Softwell
developers to install the extension on their VSCode and to receive
updates.

The repository `genropy/genro-sourcerer-vscode` is **public on GitHub**.
The extension itself, however, is only useful to people who have a
valid Sourcerer Bearer token (Softwell-internal). Without a token, the
extension is inert: it makes HTTP calls and receives `401 Unauthorized`.

Four candidate channels were considered:

- **A. VSCode Marketplace** (`marketplace.visualstudio.com`).
- **B. Open VSX Registry** (the open-source alternative).
- **C. GitHub Releases** on the public repo, with the `.vsix` attached
  as a release asset.
- **D. Custom server endpoint** on the Sourcerer host
  (e.g. `https://sourcerer.genropy.net/downloads/sourcerer-visual-latest.vsix`)
  fronted by Bearer-token auth.

A `publish.yml` workflow was already present in the repo from the
initial commit but it was set up for the Marketplace path (option A),
which is not what we want for an internal-only extension.

## Decision

**Distribute via GitHub Releases on the public repo** (option C), for
an initial period of **three months** (revisit by 2026-08-13).

Each Release contains the `.vsix` artifact built by a GitHub Action
that fires on every `v*` tag. The Action:

1. Installs dependencies, lints, type-checks, and compiles.
2. Runs `npx @vscode/vsce package` to produce the `.vsix`.
3. Creates a GitHub Release with the `.vsix` attached and auto-generated
   release notes from the commit log between this tag and the previous
   one.

The Action does **not** publish to the VSCode Marketplace, even though
the previous version of `publish.yml` was set up to do so. The
`VSCE_PAT` secret is not configured.

Install path for a Softwell developer:

```text
gh release download --repo genropy/genro-sourcerer-vscode \
  --pattern "*.vsix" -O /tmp/sv.vsix
code --install-extension /tmp/sv.vsix
```

Or, in the VSCode UI: Releases page → click `.vsix` → "Install from
VSIX".

## Consequences

Positive:

- **Zero infrastructure**: GitHub gives us the bandwidth, the URL, and
  the changelog rendering for free.
- **Stable URL**: `…/releases/latest/download/genro-sourcerer-vscode-vX.Y.Z.vsix`
  is a permanent link. Scripts and skills can hardcode it.
- **Auto-changelog**: `generate_release_notes: true` builds the
  changelog from PR titles and commit messages between tags.
- **Each tag is immutable**: `vX.Y.Z` will always download the exact
  bytes we built at that tag, even years later.
- **Reproducible**: the Action runs `npm ci` (lockfile-pinned), so
  rebuilding the same tag produces the same bytes.
- **Audit trail**: the build logs are visible to anyone in the GitHub
  org Settings → Actions.

Negative:

- **The `.vsix` is publicly downloadable**, since the repo is public.
  Acceptable because the `.vsix` is an HTTP client with no embedded
  secrets, no embedded data, and no token. The defense against
  unauthorized access lives server-side, in the Sourcerer Bearer-token
  enforcement.
- **No auto-update inside VSCode**: extensions installed from a
  `.vsix` do not receive Marketplace-style update notifications. Users
  have to re-install when a new version is tagged. Mitigation (future
  work): add a self-update notification inside the extension that
  polls `…/releases/latest` and shows a "new version available" toast.
- **Discoverability is low**: a developer who does not already know the
  repo URL won't find the extension by searching VSCode. Acceptable for
  internal Softwell use — discovery happens through onboarding docs
  and team channels, not through the Marketplace.

## Alternatives considered

### A. VSCode Marketplace (`vsce publish`)

Verdict: rejected for the foreseeable future.
The Marketplace is public by definition. While the `.vsix` itself
carries no secrets, publishing there gives the extension global
visibility, brings non-Softwell users into the issue tracker, and
creates a maintenance surface (Marketplace review process, screenshots,
publisher account, support expectations) that is not justified by the
current Softwell-only audience.

### B. Open VSX Registry

Verdict: rejected. Same trade-offs as A, with smaller reach. Not worth
the setup.

### C. GitHub Releases (chosen)

Verdict: accepted for 3 months.

### D. Custom server on `sourcerer.genropy.net`, behind Bearer auth

Verdict: rejected for now. Adds a moving part (the file server, the
authentication wiring, the file rotation script) for a benefit
(`.vsix` itself is gated by Sourcerer credentials) that is not
necessary because the `.vsix` carries no secrets and the data access is
already gated server-side.

This option becomes attractive if and when one of the following
happens:

- The extension starts carrying privileged code or assets (e.g.
  bundled internal docs, hard-coded internal URLs that map the
  infrastructure).
- A compliance requirement forces "no internal Softwell artifact on
  public infrastructure".

If we revisit this ADR after 3 months and either condition holds,
option D becomes the natural next step.

## Future work (not blocking)

These follow-ups make the chosen distribution more ergonomic but are
not part of this decision:

1. **In-extension update notification.** On activation the extension
   polls `https://api.github.com/repos/genropy/genro-sourcerer-vscode/releases/latest`,
   compares `tag_name` with its own `package.json` version, and shows
   a VSCode notification when a newer release is available. ~50 lines
   of TypeScript, isolated to a new `src/update/` module. No CI
   changes needed.

2. **Sourcerer KB skill: "Install Sourcerer Visual".** Add a skill to
   the Sourcerer Knowledge Base (under `Sourcerer/Tools` or
   `Crew/Workflow`) that describes the exact command sequence for
   Claude Code to install the extension. When a new Softwell developer
   asks Claude "installami Sourcerer Visual", Claude already knows the
   steps.

3. **Pin the VSCode version in tests.** The `xvfb-run npm test` step in
   `ci.yml` may be affected by the same `@vscode/test-electron` vs.
   VSCode 1.119 issue documented in
   `docs/design/workbench-refactor.md` open question #5. Investigate
   after the next CI run.

## Revisit

Set a calendar reminder for **2026-08-13** to re-evaluate this ADR.
Possible outcomes at that point:

- Status quo still fits → keep this ADR as 🟢 APPROVATO with no
  changes.
- Need stronger access control → migrate to option D, supersede this
  ADR.
- Want Marketplace presence → migrate to option A, supersede this ADR.
