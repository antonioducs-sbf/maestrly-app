# Privacy

Maestrly App is a local desktop application. It has no Maestrly account, hosted
backend, license service, analytics, telemetry, automatic diagnostic upload, or
mandatory updater. Optional integrations can access the network when the user
chooses a feature that depends on them.

## Local data

Workspaces, groups, conversations, messages, settings, usage records,
notes, and search metadata are stored in the application's local profile and
project files. Repositories and Git worktrees stay at their existing filesystem
paths; the application does not copy them into its SQLite database.

Production, beta, and development channels use separate profiles. Development
instances receive an additional suffix. Each running channel opens only its own
profile and does not discover or import another channel automatically.

Application-owned exports include supported local database state and app-owned
assets with integrity metadata. They exclude provider credentials, repository
and worktree files, search indexes, embeddings, and other reproducible caches.
Reset is explicit and preserves repositories/worktrees. Read
[docs/local-data.md](docs/local-data.md) before moving data between profiles.

## Credentials

API keys and user-enabled integration credentials managed by Maestrly App remain
in the Electron main process. Persisted values are encrypted through Electron
`safeStorage`, backed by the operating system's credential protection. If
encryption is unavailable, persistence fails closed; callers may keep a value in
memory for the current process but must not write plaintext as a fallback.

Subscription CLIs, Git credential helpers, SSH agents, operating-system
keychains, browsers, and remote MCP servers manage their own credentials. Their
stores and retention are outside the application database and this policy.

## Logs and diagnostics

Runtime diagnostics remain on the local machine unless the user deliberately
copies them. Maestrly App has no automatic crash or log upload. Error paths are
expected to redact known secrets, authorization headers, credential-bearing
URLs, and private absolute paths, but filenames, project names, timing, model
names, and operational metadata can still be sensitive. Review and sanitize
every excerpt before sharing it.

## Network access

Local project features do not contact a Maestrly service. Network
access can occur in these cases:

- **AI providers:** a configured API provider or enabled Codex, Claude, GitHub
  Copilot, Grok, or ChatGPT Web integration receives the prompt and the
  context/tools approved for that operation. Authentication and retention follow
  the provider's terms.
- **ChatGPT Web:** when enabled, the pinned OpenAI tunnel client connects the
  selected ChatGPT conversation to a capability-protected loopback MCP bridge.
- **Model metadata:** `models.dev` may be queried to enrich model limits and cost
  metadata. Failure does not block local chat state.
- **Git and GitHub:** clone, fetch, push, `gh`, issue, pull-request, release, and
  remote lookup operations contact the chosen Git host when explicitly run.
- **Browser and web tools:** the embedded browser navigates to user-selected
  destinations. Web fetch and browser interactions remain permission-scoped.
- **MCP:** a configured HTTP MCP server is contacted at its configured URL. A
  stdio MCP server is a local process but can make its own network requests.
- **Skills and runtimes:** searches or explicit installs can contact skills.sh,
  GitHub/codeload, npm, OpenAI asset hosts, model hosts, or other pinned upstream
  sources. Integrity checks apply where the installer defines them.
- **Embedded editor:** first-time VS Code CLI/server setup can contact Microsoft's
  download service. The running editor binds to loopback with a local token.
- **Local ML:** prepared model and runtime assets execute locally; obtaining them
  initially may require network access.

Git remotes, arbitrary browser destinations, custom provider base URLs, MCP
servers, skills, and commands are user-controlled. Review their destination and
permissions before use.

Maestrly does not add analytics to provider calls. The GitHub Copilot runtime is
started with session telemetry disabled. Provider requests and authentication
still reach the selected provider and remain subject to that provider's terms.

## Sharing and deletion

Maestrly App does not sell local data or automatically send it to the project
maintainer. Data is shared only with an integration or destination selected by
the user or by an agent operation the user allowed.

Use the in-app export before reset when a recoverable copy is required. Deleting
the application profile removes app-owned state but is not a secure-erasure
guarantee for filesystem snapshots, backups, provider records, Git remotes, or
operating-system credential stores. Remove those through their owning system.

## Third parties

Providers, Git hosts, MCP services, model and skill registries, and downloaded
tools apply their own privacy policies and terms. The packaged component and
license inventory is summarized in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
