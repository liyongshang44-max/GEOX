# MCFT-CAP-06 Task Amendment — S5 Entry Controls V1

## Decision

The prior transition:

```text
S4 merged-effective -> S5 authorized
```

is superseded by:

```text
S4 merged-effective
-> S5 entry authority-graph / preflight / PR-hygiene prerequisite
-> S5 authorized
```

Inserted prerequisite:

```text
MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1
```

S5 remains blocked until this prerequisite is merged-main effective.

## Frozen authority graph

S5 must consume the machine-readable graph at:

```text
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json
```

Required resolution order:

```text
Residual
-> Forecast
-> Forecast Config
-> source posterior
-> Forecast Evidence Window

Residual
-> Residual Config
-> Assimilation
-> observation posterior
-> Observation Evidence Window
-> selected Observation
```

The source-Forecast Runtime Config and Residual Runtime Config are distinct authorities. No alternate traversal, latest lookup, time-range lookup, scope-range lookup, or raw-observation side lookup is permitted.

## Push precondition

Before a new S5 candidate head is pushed, the same clean head must pass:

```text
node scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_ENTRY_PREFLIGHT.cjs
```

The command covers typecheck, build, domain acceptance, PostgreSQL exact-ref acceptance, formal composition, exact S2 compatibility, S3 regression, and the structured governance Gate.

CI confirms a preflighted candidate. CI is not the discovery loop for unresolved object relationships.

## Structured governance evidence

S5 and later Gates must consume structured JSON evidence. Exact prose, comments, stdout PASS markers, and source-sentence matching are not governance authority.

Required final shape includes:

```json
{
  "schema_version": "geox_mcft_cap_06_s5_entry_preflight_result_v1",
  "status": "PASS",
  "canonical_write_count": 0
}
```

## Protected predecessor contracts

Changes to the following paths are forbidden inside an S5 candidate PR:

```text
apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts
apps/server/src/domain/twin_runtime/canonical_identity_v1.ts
apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts
apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts
```

A required change must be handled by an independent prerequisite PR with A0, CAP-04, CAP-05 formal composition, S4 formal composition, and full standard-CI regression before S5 resumes.

## Draft history policy

A Draft PR may contain exploratory commits during local development, but it may not become ready for review or merge with failure-fix noise preserved as long-term history. The final branch must contain no more than six logical commits and no WIP, debug, temporary, retry, or CI-fix commit messages.

Merged PRs #2536 and #2538 will not be rewritten. This policy applies to the corrective prerequisite PR and all subsequent S5 work.

## Nonclaims

```text
NO_S5_IMPLEMENTATION
NO_CANDIDATE_APPEND
NO_SHADOW_EVALUATION_APPEND
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_RUNTIME_PARAMETER_CHANGE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_MIGRATION
NO_PUBLIC_ROUTE
NO_WEB
NO_SCHEDULER
NO_MCFT_CAP_07_AUTHORIZATION
```
