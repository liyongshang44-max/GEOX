# Legacy Agronomy Skills (Frozen)

This directory is **legacy/frozen** and kept only for backward compatibility, migration, and historical reference.

## Guardrails

- Do **not** add new runtime features here.
- Do **not** introduce new request-path entry points that depend on `apps/server/src/domain/agronomy/skills/*`.
- If data must be backfilled/seeded, use explicit migration/seed scripts (manual execution), not normal route/runtime chains.

## Allowed maintenance scope

- compatibility fixes for existing legacy callers
- historical test support
- comments/docs clarifying deprecation and migration direction

