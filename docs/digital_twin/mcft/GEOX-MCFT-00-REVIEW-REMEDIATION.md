<!-- docs/digital_twin/mcft/GEOX-MCFT-00-REVIEW-REMEDIATION.md -->
# GEOX MCFT-00 Review Remediation

## 0. Review identity

```text
phase: MCFT-00
review_target: PR #2304
reviewed_head: 2d9c2119c21bb4b04fd92d6134e3668dca7ea825
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
review_status: CHANGES_REQUIRED_BEFORE_COMPLETION
```

This document compares PR #2304 against the frozen MCFT-00 Reality Binding task line. It does not change the Reality scope, geometry, root zone, source roles, configuration ownership, or successor sequence.

## 1. Completion verdict

The substantive Reality Binding package is largely present:

```text
scope identity: implemented
candidate adjudication: implemented
governed geometry: implemented
root-zone definition: implemented
7 Evidence source bindings: implemented
2 model configuration bindings: implemented
noncanonical governance artifact: implemented
legacy contamination guard: implemented
57-check Gate definition: present
61 negative fixtures: present
generic repository CI #4318: PASS
```

MCFT-00 is not complete because final-byte acceptance and closure are still pending, and several Gate assertions do not yet prove the semantics they claim.

```text
estimated substantive implementation completion: 90%
estimated acceptance/closure completion: 55%
overall phase completion: approximately 80%
merge verdict: DO NOT MERGE AS COMPLETE
```

## 2. Blocking findings

### MCFT00-REVIEW-001 — Closure transition is currently impossible

Severity:

```text
P0-closure
```

Evidence:

```text
GEOX-MCFT-00-CLOSURE-RECORD.md remains PENDING_ACCEPTANCE.
validated_head, local Gate, predecessor regressions, changed-file boundary,
negative fixture count, working tree, and validated CI remain PENDING.
```

The Gate currently hard-checks that the closure contains:

```text
validated_head: PENDING
```

while its final output also supports `status: COMPLETE`. Updating the closure to a real validated head would therefore cause the same Gate to fail.

Required repair:

1. Introduce two explicit Gate modes derived from closure status:

```text
PENDING_ACCEPTANCE
COMPLETE
```

2. In pending mode, require pending evidence fields.
3. In complete mode, require concrete evidence:

```text
implementation_validated_head: <40-char SHA>
implementation_local_gate: PASS — <pass>/<warn>/<fail>
DT-02 amended regression: PASS
DT-01 repository audit: PASS
DT-01 acceptance: PASS
DT-00 semantic regression: PASS
changed-file boundary: PASS — <count> files
negative_fixture_count: 61
working_tree: CLEAN
implementation_ci: PASS — workflow ci #<number>
closure_input_head: <implementation_validated_head>
final_pr_head: external PR attestation
final_pr_ci: external GitHub Actions attestation
```

4. Remove any hard assertion that requires `validated_head: PENDING` after closure.
5. Run the Gate once on implementation bytes, update the closure, then run the Gate again on closure bytes.

Acceptance:

```text
The same Gate passes in pending mode before closure and complete mode after closure.
No COMPLETE closure field remains PENDING.
```

### MCFT00-REVIEW-002 — CI #4318 does not prove the MCFT-00 Gate

Severity:

```text
P0-evidence
```

The repository CI passed, but the workflow runs the standard build/test and legacy acceptance suite. It does not contain an explicit invocation of:

```text
node scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
```

The PR description records a development self-test with two explicit skips:

```text
predecessor regressions skipped
Git changed-file scope skipped
```

Required repair:

1. Run the full Gate locally without either skip variable:

```text
MCFT00_ACCEPTANCE_SKIP_PREDECESSOR must be unset
MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE must be unset
```

2. Record the complete output and counts in the closure and PR description.
3. Describe CI #4318 accurately as generic repository CI, not MCFT-00 Gate CI.
4. Do not claim machine-checked CI coverage for MCFT-00 unless a later authorized workflow change adds the exact Gate.

Current task boundary forbids workflow and package changes. Therefore MCFT-00 may close with:

```text
full local MCFT-00 Gate: PASS
generic repository CI: PASS
MCFT-00-specific CI wiring: NOT_CLAIMED
```

### MCFT00-REVIEW-003 — Negative fixture stage is metadata-only

Severity:

```text
P1-acceptance
```

Each fixture declares:

```text
expected_reason_code
expected_stage
expected_no_write
```

The current validator returns only reason-code strings. The Gate checks that `expected_stage` is non-empty but never compares it with an actual validation stage. It prints the expected stage as though it had been observed.

Required repair:

Change the validator result to structured findings:

```json
{
  "reason_code": "MISSING_TENANT_ID",
  "stage": "SCOPE_VALIDATION"
}
```

The Gate must verify both:

```text
actual reason_code == expected_reason_code
actual stage == expected_stage
```

Acceptance:

```text
A fixture with the correct reason code but wrong expected stage must fail the Gate.
```

### MCFT00-REVIEW-004 — `expected_no_write` is not independently proved

Severity:

```text
P1-acceptance
```

The Gate checks only that fixture metadata contains:

```text
expected_no_write: true
```

Required repair:

At minimum, enforce validator purity by machine check:

```text
no database modules
no network modules
no child process inside private validator helpers
no fs write APIs
no canonical persistence calls
no generated facts or active pointers
```

The negative execution result should expose:

```json
{
  "write_attempt_count": 0
}
```

and compare it with `expected_no_write=true`.

### MCFT00-REVIEW-005 — ID conflict test is tautological

Severity:

```text
P1-determinism
```

The current ID-conflict branch contains an identity comparison equivalent to:

```text
binding_id === binding_id
```

This is always true. It only proves that an alternate payload has a different hash; it does not prove that a repository or semantic idempotency guard rejects the same binding ID with a different payload.

Required repair:

Add a pure governance function such as:

```text
validateIdempotency(existingBinding, candidateBinding)
```

Required result:

```text
same binding_id + same semantic hash => IDEMPOTENT_REPLAY
same binding_id + different semantic hash => IDEMPOTENCY_CONFLICT
```

Use this function in both the positive and negative Gate paths.

### MCFT00-REVIEW-006 — Two hard checks are literal placeholders

Severity:

```text
P1-acceptance
```

The 57-item array currently includes literal `true` values for:

```text
Determinism 04 conflicting payload rejected
Boundary 06 repository scope is governance-only
```

Required repair:

Replace them with actual computed evidence:

```text
Determinism 04 => result from validateIdempotency
Boundary 06 => result from changed-file boundary evaluation
```

The hard-check count may remain 57, but every item must be evidence-bearing.

### MCFT00-REVIEW-007 — Approved-plan release policy is circular

Severity:

```text
P1-time-semantics
```

The frozen rule currently reads:

```text
APPROVED_IRRIGATION_PLAN:
MAX(available_to_runtime_at, approved_at)
```

`available_to_runtime_at` cannot be derived from itself.

Required repair:

Use a non-circular source time, for example:

```text
MAX(ingested_at, approved_at)
```

or freeze an explicit alternative such as `recorded_at`.

The approved-plan binding must then require that source time. Add a negative fixture for circular/self-referential release rules.

### MCFT00-REVIEW-008 — Replay adapter identities are named but not governed

Severity:

```text
P1-contract
```

Origin sources are defined in `source_definitions`, but the seven Replay adapters are only string IDs inside bindings. Their version, provenance, limitations, and semantic hash are not independently frozen.

Required repair:

Add `ingress_adapter_definitions` with, at minimum:

```text
ingress_adapter_id
ingress_adapter_kind
ingress_adapter_version
definition_authority
input_record_type
output_record_type
release_policy_id
provenance
limitations
adapter_semantic_hash
```

Every Evidence binding must reference exactly one defined adapter. Unknown or duplicate adapter identity must fail validation.

### MCFT00-REVIEW-009 — Soil hydraulic parameter semantics are ambiguous

Severity:

```text
P1-configuration
```

The configuration freezes:

```text
field_capacity_fraction = 0.30
wilting_point_fraction = 0.12
saturation_fraction = 0.45
root_zone_storage_capacity_mm = 90
root_zone_depth = 300 mm
```

`90 mm` equals `0.30 × 300 mm`, so the current name can be interpreted as field-capacity storage rather than total/saturation storage capacity.

Required repair:

Either rename the parameter to:

```text
field_capacity_storage_mm
```

or define `root_zone_storage_capacity_mm` precisely.

Freeze and validate cross-parameter invariants:

```text
0 <= wilting_point < field_capacity < saturation <= 1
field_capacity_storage_mm = field_capacity_fraction × root_zone_depth_mm
wilting_point_storage_mm = wilting_point_fraction × root_zone_depth_mm
saturation_storage_mm = saturation_fraction × root_zone_depth_mm
0 <= runoff_fraction <= 1
drainage_coefficient_per_hour >= 0
```

Add negative fixtures for invalid ordering, unit mismatch, and inconsistent derived storage.

### MCFT00-REVIEW-010 — Crop root-depth configuration exceeds the frozen model domain

Severity:

```text
P1-configuration
```

The frozen Level-A root zone is 0–300 mm, while the crop configuration contains 600 mm roots for MID and LATE stages.

Required repair:

Freeze one of the following explicit policies:

```text
A. Level-A mapping is capped at 300 mm.
B. crop_root_depth_mm may exceed 300 mm, but effective_model_root_depth_mm = min(crop_root_depth_mm, 300 mm).
```

MCFT-06 must not infer this policy later. Add a validator and negative fixture for an uncapped model depth exceeding the governed root zone.

### MCFT00-REVIEW-011 — Pending and complete claims are not aligned

Severity:

```text
P1-governance
```

The closure status is `PENDING_ACCEPTANCE`, but its claim block already says:

```text
MCFT_00_REALITY_BINDING_FROZEN
```

The capability matrix already marks Reality Binding as `ESTABLISHED_WITH_LIMITATIONS` while its global claim remains pending acceptance.

Required repair:

Before closure:

```text
MCFT_00_REALITY_BINDING_FROZEN_PENDING_ACCEPTANCE
acceptance_status: PENDING
```

After complete Gate and closure:

```text
MCFT_00_REALITY_BINDING_FROZEN
acceptance_status: COMPLETE
```

The DT-02 successor compatibility check and MCFT-00 Gate must enforce this state alignment.

## 3. Non-blocking hardening

### MCFT00-REVIEW-012 — Clarify the scope of `PROVEN`

New provider, ET0, plan, and configuration identities are governance-defined, not operationally proven data sources.

Add:

```text
proof_scope: GOVERNANCE_IDENTITY_ONLY
```

for these definitions. Keep the existing nonclaims that no Replay time series or live source exists.

## 4. Required patch sequence

```text
Patch 1 — repair Gate result model and closure state machine
Patch 2 — replace tautological hard checks and ID conflict logic
Patch 3 — enforce negative stage and no-write assertions
Patch 4 — fix approved-plan availability rule
Patch 5 — add governed Replay adapter definitions
Patch 6 — clarify soil-storage semantics and validate physical configuration invariants
Patch 7 — resolve 600 mm crop depth versus 300 mm governed root-zone policy
Patch 8 — align pending/complete claims and capability acceptance status
Patch 9 — run full local Gate without skips
Patch 10 — update closure evidence and run final-byte Gate again
Patch 11 — obtain final generic repository CI and update PR attestation
```

## 5. Required final commands

```powershell
node scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
git status --short
```

The final execution must not set:

```text
MCFT00_ACCEPTANCE_SKIP_PREDECESSOR
MCFT00_ACCEPTANCE_SKIP_GIT_SCOPE
```

## 6. Final completion criteria

PR #2304 may be marked ready and merged only when:

```text
all blocking findings MCFT00-REVIEW-001 through 011 are closed
closure status = COMPLETE
no closure evidence field remains PENDING
57 hard checks contain no literal placeholders
61 negative fixtures validate reason code and stage
no-write behavior is machine-checked
full local Gate has zero skips and zero failures
changed-file boundary passes
working tree is clean
generic repository CI passes on the final PR head
PR description distinguishes generic CI from MCFT-00 Gate evidence
```

Allowed final claim:

```text
MCFT_00_REALITY_BINDING_FROZEN
GOVERNANCE_INPUT_ONLY
TARGET_RUNTIME_MODE_REPLAY
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_PERSISTENCE
NO_CANONICAL_REPLAY_DATASET
CONTROLLED_SYNTHETIC_REPLAY_SCOPE_ONLY
```

Successor remains:

```text
MCFT-01 — Canonical Replay Dataset
```