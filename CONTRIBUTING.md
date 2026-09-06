# Contributing to Maestrly App

Thank you for helping improve Maestrly App. Contributions can include focused
code changes, tests, documentation, accessibility fixes, reproducible bug
reports, and design feedback.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Use [Support](SUPPORT.md) for
questions and report vulnerabilities only through [SECURITY.md](SECURITY.md).

## Before starting

Search existing issues and discussions first. A small, isolated fix can go
directly to a pull request. Open a discussion or issue before investing in a new
provider, remote service, dependency replacement, storage migration, major UI
flow, or change to an execution, privacy, or security boundary.

Keep pull requests focused. Do not combine a behavior change with unrelated
refactors, generated-file churn, broad dependency upgrades, or formatting of
untouched files.

## Development setup

Use Node.js 22.15 or newer but lower than 23, npm 10 or newer, Git, and the
native toolchain for Electron and `node-pty`. Install exactly from the lockfile:

```sh
npm ci
npm run hooks:install
npm run dev
```

The development launcher creates an isolated profile and must not reuse a
production or beta profile. See the [development guide](docs/development.md) for
operating-system prerequisites, repository layout, profiles, and common build
failures.

## Required checks

Before requesting review, run:

```sh
npm run check
npm run test:e2e
```

Run the live advisory gate when dependencies or the lockfile change:

```sh
npm run audit:dependencies
```

Run native packaging and both packaged smokes when changing Electron,
`electron-builder`, native modules, runtime assets, file allowlists, icons,
signing, or package scripts. Commands and target limitations are documented in
[scripts/README.md](scripts/README.md).

The standard suite must remain deterministic and must not require provider
authentication, a remote MCP server, a user database, Docker, or unrestricted
network access. Tests for a real provider or downloadable runtime must be
explicitly opt-in and skip with a clear reason when prerequisites are absent.

## Security and privacy expectations

Never commit or paste credentials, provider sessions, private conversations,
local databases, private repository names, personal paths, signing material, or
unsanitized logs. Tests, screenshots, and documentation use synthetic data.

Changes must preserve these boundaries:

- application-owned credentials stay in the main process and are persisted only
  through Electron `safeStorage`;
- the preload exposes named operations, not raw IPC, SQL, filesystem handles, or
  arbitrary process access;
- renderer input is validated again in the main process;
- command, file-write, network, and MCP operations retain their permission and
  project-scope checks;
- reset and migration preserve repositories/worktrees and remain recoverable;
- external network access is user-enabled or inherent to the selected external
  operation and is disclosed in [PRIVACY.md](PRIVACY.md); and
- no Maestrly account, license, hosted backend, telemetry, or mandatory updater
  is reintroduced.

Changes touching these boundaries should include negative tests and a concise
threat analysis in the pull request. Read the
[security model](docs/security-model.md).

## Code and architecture

- Keep TypeScript strict and narrow unknown data at process boundaries.
- Keep shared code independent of Electron, React, and Node-only APIs.
- Put domain and persistence invariants in shared rules or the main-process
  store, not only in React.
- Preserve drafts and durable data on failed writes; make conflicts visible.
- Use argument arrays and non-shell process execution for structured commands.
- Test success, denial, cancellation, timeout, restart, and recovery behavior
  where they are meaningful.
- Preserve upstream copyright and license notices. Record persisted-data impact
  in [docs/local-data.md](docs/local-data.md) and derived third-party material in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Branches, commits, and pull requests

1. Branch from current `main` with a descriptive `feat/`, `fix/`, `docs/`,
   `test/`, `ci/`, or `chore/` name.
2. Keep the branch current and update behavior, tests, and documentation in the
   same coherent change.
3. Use a Conventional Commit subject for every commit and for the pull request
   title, which becomes the squash-merge subject.
4. Record the user impact, validation evidence, data compatibility, network or
   permission changes, and third-party attribution.
5. Resolve every review thread. Accepted pull requests are squash-merged.

Each commit subject is one non-empty English line, at most 100 characters:

```text
type(scope): imperative description
```

The scope is optional. Allowed types are `feat`, `fix`, `docs`, `refactor`,
`perf`, `test`, `build`, `ci`, `chore`, and `revert`. A breaking change
may add `!` before the colon. Bodies, `Co-authored-by`, `Signed-off-by`, and
other standard trailers are welcome when accurate and useful. Never rewrite or
impersonate another contributor's identity.

Examples:

```text
feat(chat): persist local conversation filters
fix(git): preserve worktrees after reset
docs: explain offline provider setup
```

Contributors may open pull requests from any GitHub account. Repository
permissions determine who can merge; they never change commit authorship. CI
validates non-merge commit subjects and the pull-request title independently.
Source, comments, test names, logs, and documentation use English; user-facing
copy belongs in locale dictionaries. Intentional multilingual fixtures follow
[docs/language-policy.md](docs/language-policy.md).

## Licensing

Contributions are accepted under the same [MIT License](LICENSE) as this
repository. No separate contributor license agreement is currently required.
Submit only material you have the right to contribute and preserve applicable
third-party notices.
