# Local data and recovery

Maestrly App stores application state locally and keeps project repositories and
Git worktrees at their existing filesystem paths. Treat the application profile
and each project directory as separate backup units.

## Profile isolation

Production, beta, and development use separate Electron profiles:

- production: `maestrly-app`;
- beta: `maestrly-app-beta`; and
- development: `maestrly-app-dev-<instance>`.

The profile identity is selected before SQLite initialization and the instance
lock. A running channel opens only its own profile and does not discover or
import another channel automatically.

## Export before destructive work

Create an in-app export before reset, schema experiments, or moving data between
machines. Exports include supported application-owned database state and assets
with integrity metadata. They do not include provider credentials, repositories,
worktrees, search indexes, embeddings, or other reproducible caches.

Keep the export and project repositories in independent backup locations. Never
test migration or recovery against the only copy of a real profile.

## Schema upgrades

SQLite upgrades are forward-only. Schema changes and their backfills run in a
transaction and roll back when an upgrade fails. If startup reports a migration
error, stop the application, preserve the complete profile, and investigate a
copy rather than editing the database manually.

Downgrading after a schema upgrade may be unsafe even when the older application
starts. Restore a backup created by that older version instead of pointing it at
a newer profile.

## Reset and deletion

Reset is explicit and previews the application-owned state it will remove.
Repositories and worktrees remain at their filesystem paths. A reset is not a
secure-erasure guarantee for operating-system backups, filesystem snapshots,
provider records, Git remotes, or credential stores owned by other tools.

Provider credentials are excluded from exports. Remove provider-side sessions,
CLI credentials, keychain entries, and remote records through the system that
owns them when full account cleanup is required.

## Recovery checklist

1. Stop every Maestrly App process using the affected profile.
2. Copy the complete profile and the relevant project directories before making
   changes.
3. Verify export checksums and preserve the original export unchanged.
4. Reproduce the problem with a disposable profile or copied database.
5. Restore the profile and project data as separate units, then validate
   conversations, notes, assets, repositories, and worktrees.

Do not copy individual SQLite files while the application is running. Database
sidecars and app-owned assets must remain consistent with the main database.
