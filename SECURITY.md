# Security Policy

Maestrly App is a local-first developer application with powerful access to
repositories, terminals, browsers, MCP servers, and optional AI providers. We
welcome responsible reports when those boundaries do not behave as documented.

## Supported versions

There is no supported public release yet.

| Version | Supported |
| --- | --- |
| Latest `main` source preview | Best-effort fixes |
| Earlier commits or local packages | No |

A successful source build or CI package is not a supported release. This table
will be revised before any public binary is announced.

## Reporting a vulnerability

Do not open a public issue, discussion, or pull request for a suspected
vulnerability. Use GitHub's
[private vulnerability reporting](https://github.com/antonioducs/maestrly-app/security/advisories/new)
when it is available to your account. If the private form is unavailable, open a
minimal public issue asking maintainers to arrange a private channel. Include no
vulnerability details, logs, screenshots, repository names, or contact data in
that issue.

Include only the information needed to reproduce and assess the report:

- affected commit, operating system, architecture, and installation method;
- impact, prerequisites, and required user interaction;
- minimal steps using a disposable profile and synthetic repository;
- expected and observed behavior;
- a minimal proof of concept, if it can be shared safely; and
- fully redacted diagnostics or screenshots.

Never send real conversations, databases, repositories, tokens, passwords,
provider sessions, signing keys, credential-bearing URLs, or raw logs. Replace
project names, usernames, hostnames, paths, and content with synthetic values.

## Security-relevant scope

Reports are especially useful when they involve:

- renderer-to-main privilege escalation, unsafe IPC, navigation escape, or
  permission-handler bypass;
- command or filesystem writes outside the selected project or granted scope;
- permission-mode bypasses in chat, Maestro, subagents, MCP, Git, terminal, web,
  browser, or review workflows;
- plaintext credential persistence, failed `safeStorage` isolation, or secrets
  reaching renderer state, exports, errors, events, screenshots, or logs;
- loopback services reachable without their capability token or from a
  non-loopback interface;
- cross-project data disclosure in conversations, notes, memory,
  worktrees, browser sessions, or provider context;
- unintended network egress, telemetry, hosted Maestrly dependencies, or
  updater behavior;
- package allowlist bypasses, foreign native runtimes, integrity-check failures,
  or executable content omitted from third-party notices; and
- destructive reset or migration behavior that removes repositories or cannot
  recover after interruption.

The [security model](docs/security-model.md) documents assumptions, trust
boundaries, and known limitations. [PRIVACY.md](PRIVACY.md) describes local data
and expected network access.

## What to expect

Reports are handled privately and on a best-effort basis. Maintainers will try
to acknowledge, reproduce, prioritize, and coordinate a fix and disclosure when
possible. The project does not promise a response or remediation SLA. Timing
depends on severity, reproducibility, maintainer availability, and release
readiness.

Allow reasonable time for investigation before public disclosure. State clearly
if active exploitation or imminent harm changes the urgency. Credit is offered
when requested and safe.
