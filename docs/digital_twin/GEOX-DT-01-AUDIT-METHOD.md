<!-- docs/digital_twin/GEOX-DT-01-AUDIT-METHOD.md -->
# GEOX DT-01 Repository Capability Audit Method

## 0. Position

```text
phase: DT-01
type: repository evidence audit and architecture input
baseline: bce918d1eea423397bdd329148b7a2e7eb181b6c
predecessor: DT-00 Mainline Governance Reset
successor: DT-02 Runtime Architecture Freeze
```

DT-01 does not implement new Twin capability. It determines what the repository actually defines, calls, persists, exposes, and proves.

## 1. Corrections applied to the proposed task line

The task line is accepted with these required corrections:

1. DT-01 is based on the DT-00 merge commit, not the pre-DT-00 PFA-2 commit.
2. Every capability has an explicit `capability_status`.
3. Evidence is multi-layered: `evidence_levels[]` and `highest_evidence_level` are recorded separately.
4. Adapter, extraction, replacement, deprecation, and unknown-resolution responsibilities are structured fields.
5. A missing capability has `components: []` and a structured `missing_gap`; it is not assigned a fictional reuse decision.

## 2. Evidence priority

Highest evidence wins:

```text
1. actual server/runtime caller
2. actual database write/read path
3. route registration
4. domain function call site
5. migration/schema
6. executed acceptance evidence
7. static acceptance source
8. documentation
9. PR title / commit title
```

A low-level claim cannot override stronger code evidence. A file called `runtime`, `production`, `complete`, or `freeze` does not establish a continuous runtime.

## 3. Evidence levels

```text
DEFINITION_ONLY
TEST_OR_ACCEPTANCE_ONLY
SCRIPT_RUNNER
DATABASE_READBACK
SERVER_ROUTE
SERVER_WRITE_PATH
SCHEDULED_RUNTIME
LIVE_INGRESS
UNKNOWN
```

These values are orthogonal. A component may have more than one evidence level.

Examples:

```text
exported function != integrated runtime
acceptance caller != server caller
server read route != continuous state progression
acceptance-output JSONL != database canonical persistence
historical replay != live ingress
task fact created != action executed
acceptance result != causal effect
```

## 4. Capability status

```text
ESTABLISHED
ESTABLISHED_WITH_LIMITATIONS
MISSING
NOT_CLAIMED
```

`MISSING` is used when no component satisfies the target capability. Similar names, controlled gates, UI tabs, and fixtures do not change that status.

## 5. Reuse decisions

### REUSE_AS_IS

The component's core semantics and implementation boundary are compatible. New callers may be required, but the retained implementation does not require semantic change.

Required evidence:

```text
real call path or explicit pure-library boundary
stable input/output
no fixture-only runtime inflation
applicable regression command
```

### REUSE_WITH_ADAPTER

The core is retained, but an adapter is required. The record must identify:

```text
responsibility
existing side
new MCFT side
must-not-do rules
```

### EXTRACT_ALGORITHM

The formula or deterministic rule is useful, but its current contract, time grain, persistence, or caller is not.

The record must identify:

```text
formula_or_rule
pure_boundary
parameter_semantics
blocking_reasons
```

### REFERENCE_ONLY

The contract, negative boundary, evidence package, or acceptance pattern is useful, but the implementation must not enter the MCFT runtime path.

### REPLACE

The existing semantics would misstate State, Forecast, Runtime, persistence, or learning.

The record must identify:

```text
replacement_reasons
danger_if_retained
replacement_owner
compatibility_or_readback_policy
```

### DEPRECATE

The old entry would duplicate or conflict with the new canonical path.

DT-01 records only:

```text
replacement_path
compatibility_period
current_callers
deletion_prerequisites
owner_phase
```

DT-01 does not delete code.

## 6. Persistence modes

```text
NONE
IN_MEMORY
FIXTURE
CHECKED_IN_SNAPSHOT
ACCEPTANCE_OUTPUT_FILE
APPEND_ONLY_FACT
DATABASE_CANONICAL_APPEND
DATABASE_INDEX_INSERT
DATABASE_INDEX_UPSERT
EXTERNAL_SYSTEM
UNKNOWN
```

Mandatory interpretation:

```text
APPEND_ONLY_FACT != canonical MCFT State
DATABASE_INDEX_UPSERT != immutable canonical history
ACCEPTANCE_OUTPUT_FILE != database persistence
latest index may be reused only as a read index
```

## 7. Clock and data modes

Clock:

```text
EXPLICIT_REPLAY_CLOCK
INPUT_AS_OF_TS
REQUEST_TIME
WALL_CLOCK
DATABASE_TIME
SCHEDULER_TIME
NO_TIME_DEPENDENCE
UNKNOWN
```

Data:

```text
STATIC_FIXTURE
CONTROLLED_FIXTURE
HISTORICAL_REPLAY
CHECKED_IN_SNAPSHOT
DATABASE_READBACK
LIVE_INGRESS
MIXED
UNKNOWN
```

`LIVE_INGRESS` requires an actual ingress entry. A field named `live` is not evidence.

## 8. Static audit limitations

`AUDIT_DT_01_REPOSITORY_CAPABILITIES.cjs` verifies file existence and exact static references. It reports:

```text
static_reference_found
direct_call_found
runtime_entry_found
not_found
manual_review_required
```

It does not build a complete TypeScript semantic call graph and must not claim transitive certainty where only text references were found.

## 9. Verification status

Existing verification commands are recorded with one of:

```text
HISTORICAL_PASS_RECORDED_NOT_RERUN
PASS_IN_DT01
NOT_RUN_IN_DT01
NOT_APPLICABLE_TO_STATIC_RECONCILIATION
```

A historical PASS is recorded separately from a DT-01 rerun. An existing PASS proves only the original boundary. It does not promote a component from test-only to server runtime.

## 10. Audit outputs

Committed:

```text
GEOX-DT-01-CAPABILITY-INVENTORY.json
GEOX-DT-01-CALL-CHAIN-MATRIX.json
GEOX-DT-01-PERSISTENCE-MATRIX.json
GEOX-DT-01-RUNTIME-ENTRY-MATRIX.json
```

Generated and ignored:

```text
tmp/dt-01/repository-capability-audit.json
```

## 11. Completion boundary

DT-01 may claim a code-, call-, persistence-, and entry-level reconciliation. It may not claim any new estimator, scheduler, forecast, assimilation, checkpoint, execution, or production capability.
