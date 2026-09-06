## Problem

Describe the concrete problem, affected users/workflow, and relevant issue or
discussion.

## Behavior and implementation

Explain the resulting behavior and the smallest important implementation
decisions. Identify process, storage, provider, runtime, or package boundaries
that changed.

## Validation

List the exact commands and manual checks actually run, with pass/skip results.
Do not list checks that were not executed.

## Screenshots

Include synthetic, sanitized before/after evidence for visible UI changes, or
state why screenshots do not apply.

## Compatibility and migration

Describe persisted-data, profile, Git/worktree, platform, provider, runtime, and
downgrade impact. State "None" only after checking each category.

## Privacy, network, and security

List new data, credentials, permissions, processes, network destinations, or
trust-boundary changes. Include negative tests for a changed security boundary.

## Attribution

Identify copied or adapted code/assets and the notice or provenance update. State
"Original work; no new third-party material" when applicable.

## Checklist

- [ ] The change is focused and excludes unrelated formatting or dependency churn.
- [ ] Source, comments, tests, logs, documentation, and commits are in English.
- [ ] User-visible copy is in locale dictionaries and i18n parity still passes.
- [ ] Tests cover success plus relevant denial, failure, cancellation, or recovery paths.
- [ ] `npm run check` passed.
- [ ] `npm run test:e2e` passed, or its omission is explained above.
- [ ] Dependency, package, or security commands required by the change are recorded above.
- [ ] Fixtures, logs, screenshots, and examples contain no credentials or private data.
- [ ] Migration provenance and third-party notices are updated when applicable.
