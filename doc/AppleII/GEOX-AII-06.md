# 🍎 Apple II · Judge — Runtime / API Contract v1
Doc ID: GEOX-AII-06
Status: READY TO FREEZE
Applies to: Apple II (Judge)

Depends on:
- GEOX-AII-01 ProblemStateV1 (FROZEN)
- GEOX-AII-02 Pipeline v1 (FROZEN)
- GEOX-AII-03 ReferenceViewV1 (FROZEN)
- GEOX-AII-05 LBCandidateV1 (FROZEN)
- GEOX-AII-00-APP-A Enums & Constraints (FROZEN)
- Apple I Phase-5 APIs (Series, Ledger read)

## Constitutional Statement (FROZEN)
Judge is deployable as a separate service, reads Apple I in a read-only manner, and is deterministic and auditable.
Persistence (if enabled) is append-only and MUST NOT express "current truth".
Silent-by-default: when no ProblemState is declared, the API returns empty problem_states (not OK).

## Judge Persistence Rule (FROZEN)
All Judge outputs (ProblemStateV1, AO-SENSE, ReferenceViewV1, LBCandidateV1) are append-only.
The same {subjectRef, scale, window} may be evaluated multiple times; every run MUST have a unique run_id.
Storage MUST NOT overwrite/replace to imply current truth.

## Core API (FROZEN)
POST /api/judge/run
- Input: subjectRef, scale, window, options (persist/include_reference_views/include_lb_candidates/config_profile)
- Output: run_id, problem_states (0..1), ao_sense (0..n), optional reference_views/lb_candidates, silent flag, run_meta incl determinism_hash

GET /api/judge/problem_states
GET /api/judge/reference_views
GET /api/judge/ao_sense

## Determinism Hashing (FROZEN)
determinism_hash MUST hash a canonical input bundle (subjectRef/scale/window/pipeline_version/config_profile + canonicalized input refs).
Must exclude run_id and created_at_ts.
