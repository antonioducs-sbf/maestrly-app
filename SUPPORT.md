# Support

Maestrly App is a `0.x` source preview. Support is best-effort; there is no
service-level agreement or supported public binary.

## Usage and design questions

Use [GitHub Discussions](https://github.com/antonioducs/maestrly-app/discussions)
when it is enabled, or the
[question form](https://github.com/antonioducs/maestrly-app/issues/new?template=question.yml),
for setup help, workflow questions, design exploration, and early feature ideas.
Include the commit, operating system and architecture, what you are trying to do,
and what you already tried. Review the [README](README.md) and
[development guide](docs/development.md) first.

## Reproducible defects

Use [GitHub Issues](https://github.com/antonioducs/maestrly-app/issues) for one
concrete, reproducible product defect. Include:

- the affected commit, operating system, architecture, and source/package mode;
- minimal steps using an isolated profile and synthetic repository;
- expected and observed behavior;
- whether restart changes the result and whether an earlier commit worked; and
- only sanitized diagnostics or screenshots.

Search existing issues before filing a new one. Open-ended troubleshooting and
feature design belong in Discussions.

## Provider and tool support

Provider accounts, subscriptions, model availability, rate limits, retention,
and provider-native CLIs remain the responsibility of that provider. Git hosts,
remote MCP servers, downloaded models, and embedded editor distributions also
retain their own support and service terms. Core local workspace features do
not require a provider account; AI-backed actions do.

## Security and privacy

Do not report suspected vulnerabilities in Issues or Discussions. Follow
[SECURITY.md](SECURITY.md).

Community support cannot safely inspect private conversations, repositories, or
profiles. Reproduce problems with synthetic data and remove tokens, emails,
usernames, hostnames, private paths, project names, conversation content, and
credential-bearing URLs before sharing anything. See [PRIVACY.md](PRIVACY.md).
