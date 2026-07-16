<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-PREDECESSOR-CONSUMPTION-STABILIZATION.md -->

# MCFT-CAP-06 S4 — Predecessor Consumption Stabilization

```text
delivery_slice_id:
MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1

status:
AUTHORIZED_NOT_STARTED

predecessor_slice:
MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1

successor_slice:
MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1

runtime_source_authorized:
true

canonical_write_authorized:
false

migration_authorized:
false
```

## 1. Why S4 is inserted here

S3 establishes Candidate/Evaluation persistence and an exact-ref Residual repository port. S5 is the first production Slice that must resolve real CAP-05 canonical graphs and feed the exact S2 calibration engine.

The remaining CAP-05 structural debt therefore becomes correctness-critical at the S3-to-S5 seam. S4 is inserted after S3 effectiveness and before S5 authorization. It does not reopen CAP-05 closure and does not redefine CAP-05 scope.

The authoritative debt register is:

```text
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json
```

## 2. S4 owns

### 2.1 Positive CAP-04 execution projection

The current CAP-05 execution resolver derives a CAP-04 execution view by subtracting CAP-05-only fields. S4 must replace this with positive selection of the exact CAP-04 execution payload fields.

Required properties:

```text
validate canonical CAP-05 Runtime Config first
select only frozen CAP-04 execution fields
set CAP-04 purpose and selection mode in the non-canonical view
validate the resulting CAP-04 payload
retain source CAP-05 object ref/hash
assign no canonical identity to the execution view
```

Acceptance must prove:

```text
new CAP-05-only policy fields cannot leak into the CAP-04 view
missing CAP-04 execution fields fail closed
extra execution-view fields fail closed
source Config ref/hash are preserved
no second canonical Runtime Config is created
```

S4 does not authorize the long-term nested schema refactor:

```text
Cap05RuntimeConfigPayloadV1 = {
  execution: Cap04ExecutionConfigPayloadV1,
  feedback_policy: ...
}
```

That refactor remains a separately registered post-MCFT-6 debt because it changes a completed predecessor contract.

### 2.2 Reusable non-canonical graph assembler

S4 must establish a single reusable read-only graph assembler for a Forecast-to-Observation calibration case.

The target consumption view is non-canonical and may be named:

```text
ResolvedForecastObservationCaseV1
```

It must resolve and validate, by exact refs and hashes:

```text
Forecast
Forecast point
source posterior State
source Runtime Config
CAP-05 to CAP-04 execution view
actual Observation
Observation Evidence Window cutoff
forcing refs
observation operator refs
geometry refs
Runtime replay numeric policy
lineage and revision
forecast issued/as-of/target time
observation observed/available-to-runtime time
no-future-leakage constraints
```

The assembler must:

```text
consume exact refs only
preserve caller-provided order
expose no list/search/latest/time-range/scope-range surface
perform no canonical append
perform no projection write
perform no State/checkpoint mutation
be reusable by S5, S6 and later audit/drift consumers
```

S5 and S6 are forbidden from implementing an alternative graph traversal authority.

### 2.3 CAP-05 effective runtime baseline aggregate pointer

S4 must add one append-only machine-readable aggregate pointer that makes CAP-05 authority precedence unambiguous without rewriting historical closure.

It must expose:

```text
historical_closure_ref
historical_closure_commit
latest_effective_amendment_ref
latest_effective_amendment_commit
effective_runtime_baseline_commit
current_successor_eligibility
formal_runner_proof_ref
```

The aggregate is a governance read model only. It does not change CAP-05 completion history or Runtime behavior.

### 2.4 Acceptance topology hardening

Before S4 effectiveness, the following four layers must all pass on the same exact head and again on merged main:

```text
1. domain acceptance
2. repository acceptance
3. orchestration / graph-assembler acceptance
4. formal production composition acceptance
```

Component-only proof is insufficient.

The formal composition proof must exercise:

```text
canonical CAP-05 Config
→ positive CAP-04 execution view
→ exact PostgreSQL Residual lookup
→ complete read-only canonical graph assembly
→ exact S2 case builder
→ exact S2 calibration/shadow engines in non-writing readiness mode
```

## 3. S4 boundaries

S4 must not:

```text
change S2 calibration or shadow mathematics
append twin_calibration_candidate_v1
append twin_shadow_evaluation_v1
create twin_model_activation_v1
create or modify an active-config index
change an active Runtime parameter
mutate State or checkpoint
add a migration
add a public route
change Web
add a scheduler
claim a production calibration run
claim a production shadow run
authorize MCFT-CAP-07
```

## 4. S4 effectiveness condition

```text
positive execution projection implemented and accepted
AND
single reusable exact-ref graph assembler implemented and accepted
AND
CAP-05 effective runtime baseline aggregate pointer implemented and accepted
AND
four-layer exact-head composition acceptance PASS
AND
standard repository CI PASS
AND
merge to main
AND
head-to-merge file delta = 0
AND
head-to-merge tree equivalence = PASS
AND
exact merged-main proof PASS
AND
separate S4 effectiveness writeback merged
```

Only after S4 effectiveness may S5 become authorized.
