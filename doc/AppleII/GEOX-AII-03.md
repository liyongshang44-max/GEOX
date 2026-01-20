# 🍎 Apple II · Judge — ReferenceViewV1 (Replayable Contrast Evidence)
Doc ID: GEOX-AII-03
Status: READY TO FREEZE
Applies to: Apple II (Judge)

Depends on:
- GEOX-P0-00 SpatialUnit & Scale Policy (FROZEN)
- GEOX-P0-01 Evidence & QC Policy (FROZEN)
- Apple I Phase-5 Evidence Rendering / Series Window Slicing (FROZEN)
- GEOX-AII-00-APP-A Enums & Constraints (FROZEN)

## Constitutional Role (FROZEN)
ReferenceViewV1 is NOT Evidence, NOT State, and NOT a conclusion.
It is an optional, read-only contrast view used to organize replayable references for ProblemState.

Hard constraints:
- MUST NOT be written into Apple I Evidence Ledger.
- MUST NOT consume ProblemState/LBCandidate/AO/Control as inputs.
- MUST NOT carry control/recommendation/diagnosis/risk semantics.
- MUST be replayable: same inputs + same window ⇒ same output.

## Persistence Rule (FROZEN)
ReferenceViewV1 MAY be persisted in Judge-owned storage.
If persisted, it MUST be append-only (no overwrite), and must remain replayable for the retention period.
Persistence is optional; an implementation may compute it on-demand.

## Uniqueness Rule (FROZEN)
ReferenceView uniqueness is defined by the natural key:
{ subjectRef, scale, window.startTs, window.endTs, kind, metric }.
Within a single Judge run_id, at most ONE ReferenceViewV1 may exist for a given natural key.

Across runs, multiple ReferenceViewV1 may exist (distinguished by run_id and created_at_ts).

## Failure Semantics (FROZEN)
ReferenceViewV1 MUST NOT encode "failure conclusions" as fields.
If a reference cannot be constructed, Judge MUST NOT generate a fake ReferenceView.
Instead, Judge emits ProblemState:
- problem_type = REFERENCE_MISSING
- uncertainty_sources includes REFERENCE_NOT_AVAILABLE

If a constructed reference view exhibits stable, replayable divergence not explainable by QC alone,
Judge may emit REFERENCE_CONFLICT (declaration only; no blame assignment).

## Kind Enum (FROZEN)
ReferenceViewKindV1:
- WITHIN_UNIT_HISTORY
- WITHIN_UNIT_CONTROL_SENSOR
- NEIGHBOR_SAME_SCALE
- EXTERNAL_CONTEXT

## Machine Schema & Fixtures
- Schema: packages/contracts/reference_view_v1.schema.json
- Fixtures: fixtures/appleii/rv_demo_missing_001.json, rv_demo_conflict_001.json
