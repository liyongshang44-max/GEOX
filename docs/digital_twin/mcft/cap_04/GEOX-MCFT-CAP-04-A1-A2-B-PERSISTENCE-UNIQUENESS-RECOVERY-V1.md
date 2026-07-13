<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1.md -->

# GEOX MCFT-CAP-04 S5B — A1/A2/B Persistence, Uniqueness and Recovery V1

```text
baseline merged main: 2c6a0834488f367eb927430a15c9590c1bf348a3
branch: agent/mcft-cap-04-s5b-persistence-uniqueness-recovery-v1
delivery slice: MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

S5B extends the existing D transaction family. Canonical history remains exclusively in `public.facts`. Exactly one additive migration introduces the CAP-04 idempotency kinds, cross-variant terminal uniqueness, Scenario canonical uniqueness and rebuildable Forecast/Scenario projections.

A1 and A2 atomically persist eight-member record sets. Both variants compete for one terminal tick identity; exactly one may commit. B atomically persists one Scenario Set bound to the latest successful source Forecast. Idempotent retries reconstruct the canonical result instead of appending duplicates.

The Runtime can detect an A1-success/B-missing recovery barrier, read back A and B identities, and explicitly rebuild Forecast/Scenario projections from append-only facts. Fault injection proves rollback before commit.

S6 single-tick orchestration remains blocked and unauthorized.
