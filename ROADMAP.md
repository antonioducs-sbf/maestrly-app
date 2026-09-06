# Roadmap

Maestrly App is in `0.x` source development. This roadmap communicates current
direction, not a release promise. Priorities can change as testing exposes data,
security, provider, or packaging constraints; no item has a committed date.

## Completed foundation

- Independent local-first desktop identity, profile, and Git history.
- Removal of Maestrly login, license, hosted backend, telemetry, feedback, cloud
  runners, and mandatory updater dependencies.
- Integrated chat, Maestro, Git/worktrees, terminal, editor, browser,
  notes, memory, MCP, settings, i18n, export, and reset workflows.
- Atomic SQLite migrations and recovery, isolated test repositories/profiles,
  and source CI on macOS, Linux, and Windows.
- macOS arm64 package, native terminal, and Local ML smoke coverage.

## Current hardening

- Publication-ready repository governance, contribution guidance,
  security/privacy model, dependency policy, secret scanning, and scheduled
  package verification.
- First GitHub-hosted Linux and Windows native package-smoke runs.
- Keep the dependency advisory allowlist empty or narrowly justified as upstreams change.
- Continued negative testing at IPC, permission, migration, credential, and
  package-content boundaries.

## Publication readiness

Before a public source or binary release, the project intends to complete:

- an explicit publication and branding review;
- active default-branch rules with required CI and security checks;
- repeatable native package verification for every advertised platform;
- signing, notarization, checksums, and clean-machine validation for each binary;
- a reviewed dependency and third-party notice inventory, with an SBOM when its
  output can be verified;
- an upgrade, backup, rollback, and security-fix policy tied to published
  versions; and
- accessibility and onboarding review on supported operating systems.

## Possible later work

- Additional local inference backends and smaller offline model bundles.
- More import/export interoperability between isolated profiles.
- Broader accessibility automation and keyboard-only workflow coverage.
- Optional reproducible package provenance and signed attestations.

Hosted Maestrly accounts, telemetry, mandatory cloud storage, and an updater that
blocks local use are not roadmap goals for this repository.
