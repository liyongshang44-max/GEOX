<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-V1.md -->

# GEOX MCFT-CAP-04 S5A — A1/A2 Record-Set Builders V1

## Identity

```text
baseline merged main: f0fc64d487ba6ed34d0c77178fed45e707092a07
branch: agent/mcft-cap-04-s5a-a1-a2-record-set-builders-v1
delivery slice: MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

## Established boundary

S5A provides pure deterministic constructors for the two CAP-04 terminal State-tick variants. A1 emits one completed 72-point Forecast and a completed Tick. A2 emits one zero-point blocked Forecast, a completed-with-limitations Tick, a stop-after-blocked marker, and preserves the previous successful Forecast pointer.

Both variants contain exactly eight canonical candidate envelopes: Evidence Window, Transition, Assimilation Update, posterior State, Forecast, Tick, Checkpoint and Health. All CAP-04 object identifiers are re-derived from the operation identity, source references are rewired to the new graph, every member hash is recomputed, the aggregate hash is constructed, and the existing CAP-04 validator must accept the complete graph.

A1 and A2 share the same terminal uniqueness identity for scope + lineage + revision + logical time, while their operation key, record-set identity and idempotency identity remain distinct. Tick is the recovery root with six direct references; Health remains recoverable only by reverse lookup and `health_ref` is forbidden on Tick.

## Preserved nonclaims

This slice performs no database access, canonical append, terminal uniqueness query, A1/A2/B persistence, B Scenario Set construction, recovery transaction, migration, projection, route, web or scheduler work. Those remain reserved for S5B or later slices.
