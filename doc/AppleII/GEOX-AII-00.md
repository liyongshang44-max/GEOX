# 🍎 Apple II · Judge — Design Overview
Doc ID: GEOX-AII-00
Status: READY TO FREEZE
Applies to: Apple II (Judge)
Depends on: Apple I Phase-5 (Evidence-Only Monitoring)

## Explicit Non-Goal
Apple II MUST NOT output:
- actions
- recommendations
- permissions / prohibitions
- diagnoses
- risk scoring
- "OK / NORMAL / SAFE" verdict objects

## Role Definition
Apple II (Judge) is an uncertainty declaration system built on replayable evidence.
Its single purpose is to expose *where the system cannot reliably understand the current state*.

## Canonical Output Objects (Frozen)
Apple II may output only:
- ProblemStateV1 (ONLY authoritative problem anchor)
- LBCandidateV1 (0..n, non-authoritative interpretation)
- AO-SENSE (0..n, derived sensing request, weakest action)
- ReferenceViewV1 (optional, replayable contrast evidence used by ProblemState)

## Frozen Dependency Direction
Allowed:
- Evidence / State → ProblemStateV1
- ProblemStateV1 → LBCandidateV1
- ProblemStateV1 → AO-SENSE
- Evidence → ReferenceViewV1 → ProblemStateV1 (optional internal organization; never required)

Forbidden:
- LBCandidate → ProblemState (any backflow)
- AO-SENSE without ProblemState
- ReferenceView → AO-SENSE (standalone)
- Any Control / Permission / Recommendation semantics in Apple II
