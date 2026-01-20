# 🍎 Apple II · Judge — LBCandidateV1 Minimal Schema
Doc ID: GEOX-AII-05
Status: READY TO FREEZE
Applies to: Apple II (Judge)

Depends on:
- GEOX-AII-00-APP-A Enums & Constraints (Enum normative authority)
- GEOX-AII-01 ProblemStateV1 (FROZEN)
- GEOX-AII-06 Runtime / API Contract v1 (FROZEN)

## Constitutional Statement (FROZEN)
LBCandidateV1 is a non-authoritative interpretation asset.
Apple II’s ONLY authoritative problem anchor remains ProblemStateV1.

Hard constraints:
1) Non-authoritative: must not be treated as fact, decision, permission, or conclusion.
2) No backflow: MUST NOT be used as input/evidence to ProblemState, ReferenceView, or AO-SENSE (including by id/summary/derived metrics).
3) No substitution: APIs/UIs MUST NOT use presence/absence of LBCandidate to imply presence/absence of a problem, nor emit OK/NORMAL semantics.

Persistence:
- LBCandidateV1 MAY be persisted in Judge-owned append-only storage.
- run_id MUST be present for audit.
- problem_state_id is optional; if present, code+tests MUST validate it belongs to the SAME run_id.

## Machine Schema
- Schema: packages/contracts/lb_candidate_v1.schema.json
