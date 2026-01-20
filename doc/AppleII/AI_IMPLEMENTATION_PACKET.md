# 🍎 Apple II · Judge — AI IMPLEMENTATION PACKET
Audience: AI Code Generator ONLY
Status: CONSTITUTIONAL — DO NOT REDESIGN
Scope: Implement Apple II (Judge) on top of frozen Apple I

## Absolute Positioning
Apple II implements problem & uncertainty declaration only.
No actions, recommendations, permissions, diagnoses, risk scoring, or OK/NORMAL verdict objects.

Silent-by-default:
If no defined ProblemState condition is satisfied → output nothing.
Silence does not mean healthy or safe.

## Canonical Objects
Apple II outputs only:
- ProblemStateV1 (ONLY authoritative problem anchor)
- ReferenceViewV1 (optional, contrast evidence)
- AO-SENSE (derived sensing request)
- LBCandidateV1 (non-authoritative interpretation asset)

Allowed paths:
- Evidence/State → ProblemState
- Evidence → ReferenceView → ProblemState (optional; never required)
- ProblemState → AO-SENSE
- ProblemState → LBCandidate

Forbidden:
- LBCandidate → ProblemState
- AO-SENSE without ProblemState
- ReferenceView → AO-SENSE (standalone)
- Any Control/Permission/Recommendation semantics

## Normative Documents (MUST READ)
doc/AppleII/GEOX-AII-00.md
doc/AppleII/GEOX-AII-00-APP-A.md
doc/AppleII/GEOX-AII-01.md
doc/AppleII/GEOX-AII-02.md
doc/AppleII/GEOX-AII-03.md
doc/AppleII/GEOX-AII-04.md
doc/AppleII/GEOX-AII-05.md
doc/AppleII/GEOX-AII-06.md
