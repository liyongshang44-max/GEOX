# 🍎 Apple II · Judge — Pipeline v1
Doc ID: GEOX-AII-02
Status: FROZEN
Applies to: Apple II (Judge)

Depends on:
- GEOX-AII-01 ProblemStateV1 (FROZEN)
- GEOX-AII-03 ReferenceViewV1 (FROZEN)
- GEOX-AII-04 Judge Logic Rules (FROZEN)
- GEOX-AII-00-APP-A Enums & Constraints (FROZEN)

## Constitutional Statement (FROZEN)

- Deterministic: no randomness; no ML; no heuristics.
- Silent-by-default: if no defined ProblemState condition is satisfied → emit nothing (0 ProblemState).
- Silence is not a verdict and does not imply OK / normal / safe.
- Append-only: persisted outputs are never overwritten or updated to imply “current truth”.

## Fixed Stage Order (FROZEN)

The Judge Pipeline v1 executes in this exact order. No reordering, skipping, or backtracking:

1) Input Assembly  
2) Evidence Sufficiency Check  
3) Time Coverage Check  
4) QC / Device Health Check  
5) Reference Assembly (optional)  
6) Conflict Detection  
7) Scale Policy Check  
8) Exclusion Window / Marker Check  
9) ProblemState Emission (0..1)  
10) AO-SENSE Derivation (only when ProblemState exists)

## Emission Rule (FROZEN)

Exactly one ProblemState per `{subjectRef, scale, window}` may be emitted.

- If a stage condition is satisfied: emit exactly one ProblemState and stop further stage evaluation.
- Otherwise: emit nothing (silent).

## supporting_evidence_refs Minimum Rule (FROZEN)

When a ProblemState is emitted, `supporting_evidence_refs` MUST follow stage-specific minimums defined in GEOX-AII-04.

Minimums (summary):
- INSUFFICIENT_EVIDENCE: include at least one replayable reference (`qc_summary` or `ledger_slice`).
- TIME_COVERAGE_GAPPY / WINDOW_NOT_SUPPORT: include a replayable reference (`ledger_slice` or `qc_summary`).
- EXCLUSION_WINDOW_ACTIVE / MARKER_PRESENT: include a replayable reference to the marker/overlay slice (`ledger_slice`).
- SCALE_POLICY_BLOCKED: may omit `supporting_evidence_refs` (policy limitation can be declared without slice), but if reference views are included for display, they may be referenced as `reference_view`.

## Core API (FROZEN)

POST `/api/judge/run`
- Input: `subjectRef`, `scale`, `window`, `options`
  - `options.persist` (default false)
  - `options.include_reference_views` (default false)
  - `options.include_lb_candidates` (default false)
  - `options.config_profile` (default "default")
- Output:
  - `run_id` (unique per call)
  - `problem_states` (0..1)
  - `ao_sense` (0..n)
  - optional `reference_views` / `lb_candidates`
  - `silent` (true when `problem_states` is empty)
  - `run_meta` includes `pipeline_version` and `config_profile`
  - `determinism_hash` hashes a canonical input bundle (excluding `run_id` and timestamps)

GET endpoints:
- `/api/judge/problem_states`
- `/api/judge/reference_views`
- `/api/judge/ao_sense`
