# Database Migrations

Migration files live here until the team chooses a final ORM or migration tool.

Rules:

- Use timestamped or numbered migrations.
- Keep migration IDs immutable after review.
- Run migrations through the shared `MigrationRunner` abstraction.
- Capability modules may own tables, but migration execution remains shared.

Current placeholder:

- `0001_foundation.sql`: documents the first migration slot for future schema creation.
