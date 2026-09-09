# Development

This guide covers a clean source checkout, repository layout, verification, and
native package development. It does not configure provider accounts or production
signing credentials.

## Requirements

All platforms require:

- Git;
- Node.js 22.15 or newer, but lower than 23;
- npm 10 or newer; and
- enough free disk space for Electron, native dependencies, build output, and
  optional runtime archives.

Native modules normally use published binaries, but a compiler toolchain is
required when a matching prebuild is unavailable:

- **macOS:** Xcode Command Line Tools and the SDK for the host architecture.
- **Linux:** Python 3, `make`, a C/C++ compiler, and Electron runtime libraries.
  `npx playwright install-deps chromium` installs the test libraries on supported
  Debian/Ubuntu systems.
- **Windows:** PowerShell, Python 3, and Visual Studio Build Tools with Desktop
  development with C++ when a native rebuild is required.

Use the native host for package validation. The package wrapper supports only
explicitly tested cross-build combinations and refuses multiple target
OS/architecture pairs in one invocation.

## Clean setup

```sh
git clone https://github.com/antonioducs/maestrly-app.git
cd maestrly-app
npm ci
npm run hooks:install
```

`npm ci` is authoritative. Do not hand-edit `package-lock.json`, copy another
checkout's `node_modules`, or switch package managers. The postinstall step
ensures Electron is present and rebuilds native application dependencies. It
does not download every optional provider runtime or model.

Start an isolated development instance:

```sh
npm run dev
```

The launcher detects instance collisions and assigns a
`maestrly-app-dev-<instance>` profile. Stop the process cleanly before deleting
development data.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/desktop/src/main/` | Privileged Electron services, IPC, storage, processes, providers, and windows |
| `src/preload/` | Typed renderer bridge |
| `src/renderer/` | React desktop and styles |
| `src/shared/` | Pure types, schemas, domain rules, and i18n |
| `apps/desktop/test/unit/` | Vitest behavior and contract tests |
| `apps/desktop/test/e2e/` | Real Electron integration tests |
| `tests/policy/` | Node tests for repository and product boundaries |
| `scripts/` | Development, runtime, package, audit, and verification tools |
| `apps/desktop/runtime-assets/` | Optional Local ML build inputs, manifests, and ignored archives |
| `resources/` | Packaged icons, sounds, notices, and staged optional tools |
| `config/` | Versioned limits and reviewed policy exceptions |

Read [Architecture](architecture.md) before moving code between process layers.

## Profiles and local data

The application identity is resolved before SQLite and filesystem state:

- production: `maestrly-app`;
- beta: `maestrly-app-beta`; and
- development: `maestrly-app-dev-<instance>`.

The exact operating-system directory is resolved through Electron. Never point a
development build at a production or beta profile. Tests create temporary
profiles and synthetic repositories and remove only those fixtures.

Use the in-app export flow before experimenting with migration or reset. Reset
preserves repositories/worktrees but removes app-owned profile data according to
the preview shown to the user.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build/watch and launch an isolated desktop |
| `npm run clean:dev` | Remove only this edition's development profiles and build caches |
| `npm run typecheck` | Check main, renderer, and test TypeScript projects |
| `npm run lint` | Run Biome without rewriting files |
| `npm run format` | Rewrite supported files with Biome |
| `npm run test:unit` | Run deterministic Vitest suites |
| `npm run test:policy` | Run repository/product policy tests |
| `npm run test:docs` | Validate local Markdown targets |
| `npm run test:e2e` | Launch real Electron integration tests |
| `npm run build` | Create production main/preload/renderer output in `out/` |
| `npm run check` | Typecheck, lint, test, and build |
| `npm run audit:dependencies` | Query npm and enforce exact advisory policy |

`npm run audit:dependencies` is intentionally outside the deterministic aggregate
because it requires the live npm advisory service. Its allowlist is exact,
review-dated, and tested in `tests/policy/`.

## Testing

Before requesting review, run:

```sh
npm run check
npm run test:e2e
```

Electron tests are serial because they coordinate native windows, profiles,
processes, and filesystem fixtures. The Playwright configuration disables host
Git filters, signing rules, and line-ending conversion for synthetic repositories.

Standard tests must not use personal provider credentials, network services,
local conversations, or an existing project checkout. A test requiring a real
CLI/runtime is skipped unless its explicit fixture or environment prerequisite
is present. Never convert an opt-in test into a silent live call.

When changing dependency policy or workflows, also run:

```sh
npm run audit:dependencies
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7
go run github.com/zricethezav/gitleaks/v8@v8.30.1 git . --config .gitleaks.toml --no-banner --redact
```

The pinned Go tool versions make the command reproducible; first use downloads
their modules.

## Optional runtimes and models

Provider and Local ML assets are not all fetched by `npm ci`. The scripts
`fetch-codex-runtime.mjs`, `fetch-github-copilot-runtime.mjs`,
and `fetch-tunnel-client.mjs` select a target and verify pinned metadata or
integrity. The app can also install supported assets through its settings.

GitHub Copilot device login requires a public OAuth Client ID owned by the
distributor. Set `MAIN_VITE_GITHUB_COPILOT_CLIENT_ID` when building a package,
or `MAESTRLY_GITHUB_COPILOT_CLIENT_ID` for an unpackaged development run.
Without one, the provider remains visible but unavailable; no account-specific
identifier is embedded in the source tree.

For Local ML archive and model preparation, read
[apps/desktop/runtime-assets/local-ml/README.md](../apps/desktop/runtime-assets/local-ml/README.md). Keep
downloaded archives and model caches out of Git.

## Packaging

Build a native validation package on its matching host:

```sh
npm run package
npm run package:linux
npm run package:win
```

The macOS command targets arm64. Linux and Windows commands target x64. Beta and
additional architecture commands are listed in [scripts/README.md](../scripts/README.md).
The wrapper builds the app and Local ML archive, then runs resource checks and a
size report with publication disabled.

After packaging on the same host:

```sh
npm run smoke:packaged-desktop
npm run smoke:packaged-local-ml-runtime
```

On headless Linux, prefix each smoke with `xvfb-run -a`. A passing ad-hoc package
is not a signed release; follow [Releasing](releasing.md).

## Fixture and diagnostic hygiene

Use generated names, temporary directories, synthetic conversations, and
disposable Git repositories. Do not include private remote URLs, usernames,
hostnames, file paths, screenshots, tokens, or provider output in fixtures.

Diagnostics can still reveal project/model names and timing after secret
redaction. Review every excerpt before attaching it to an issue. See
[Privacy](../PRIVACY.md) and [Security](../SECURITY.md).

## Troubleshooting

- **Wrong Node/npm version:** compare `node --version` and `npm --version` with
  `.nvmrc` and `package.json`, then reinstall with `npm ci`.
- **Native module load failure:** delete no user data. Rerun `npm ci`, confirm the
  host compiler prerequisites, and verify Electron and module architectures.
- **Electron library error on Linux:** run
  `npx playwright install-deps chromium` and retry under Xvfb when headless.
- **Development instance collision:** use the existing window or stop the old
  process; do not manually remove a live profile lock.
- **Provider unavailable:** local projects should still open. Confirm the
  provider is explicitly enabled, its separately owned authentication is valid,
  and any required runtime has been installed.
- **Packaging finds a foreign runtime:** run packaging in a clean checkout for
  one target only. Separate checkouts avoid shared staging races.
- **Migration/reset warning:** stop and preserve the profile. Follow the
  recoverable workflow in [local data and recovery](local-data.md) rather than moving
  SQLite files while the application is running.
