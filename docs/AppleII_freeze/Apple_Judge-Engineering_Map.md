Apple II · Judge — Engineering Map (FROZEN)

This file maps constitutional documents to concrete code responsibilities.
Do NOT invent alternative layering or dependency directions.

────────────────────────────────

Core Judge Engine
	•	Pipeline Orchestration
→ doc/AppleII/GEOX-AII-02.md
→ apps/judge/src/pipeline.ts
FROZEN CONSTRAINTS:
	•	Pipeline order MUST match GEOX-AII-02 exactly
	•	First-hit wins
	•	Silent-by-default must be enforced here
	•	Pipeline MUST NOT depend on LBCandidate or AO-SENSE outputs
	•	Deterministic Logic Rules
→ doc/AppleII/GEOX-AII-04.md
→ apps/judge/src/rules/
FROZEN CONSTRAINTS:
	•	Rules MUST be deterministic and config-driven
	•	Rules MUST NOT import or consume:
	•	LBCandidate
	•	AO-SENSE
	•	Control / Permission logic
	•	Rules MUST operate only on Evidence / State / ReferenceView (read-only)

────────────────────────────────

Canonical Objects
	•	ProblemStateV1
→ doc/AppleII/GEOX-AII-01.md
→ packages/contracts/problem_state_v1.schema.json
→ apps/judge/src/problem_state.ts
Role:
	•	ONLY authoritative problem anchor
	•	Exactly 0 or 1 per window
	•	MUST include Step1 hooks
	•	ReferenceViewV1
→ doc/AppleII/GEOX-AII-03.md
→ apps/judge/src/reference/
Role:
	•	Optional, read-only contrast view
	•	MUST be replayable
	•	MUST NOT:
	•	generate ProblemState by itself
	•	generate AO-SENSE
	•	be required for ProblemState emission
	•	LBCandidateV1
→ doc/AppleII/GEOX-AII-05.md
→ packages/contracts/lb_candidate_v1.schema.json
→ apps/judge/src/lb_candidate.ts
Role:
	•	Non-authoritative interpretation asset
	•	MAY be persisted independently (append-only)
	•	MUST NOT:
	•	influence ProblemState
	•	be used as evidence
	•	substitute ProblemState existence
	•	AO-SENSE
→ doc/AppleII/GEOX-AII-00-APP-A.md
→ apps/judge/src/ao_sense.ts
Role:
	•	Derived ONLY from ProblemState
	•	MUST NOT exist without ProblemState
	•	Observation-only (no action semantics)

────────────────────────────────

Runtime / API
	•	Runtime semantics & persistence
→ doc/AppleII/GEOX-AII-06.md
→ apps/judge/src/runtime.ts
→ apps/judge/src/store/
FROZEN CONSTRAINTS:
	•	Append-only storage
	•	run_id required for every run
	•	Store MUST NOT:
	•	compute “current truth”
	•	overwrite previous results
	•	infer system health
	•	HTTP API
→ apps/judge/src/routes.ts

────────────────────────────────

Apple I Integration (READ-ONLY)
	•	Series API (strict window slicing)
	•	Ledger queries (append-only)

Judge MUST NOT:
	•	write to ledger
	•	change series semantics
	•	inject control logic
	•	back-propagate derived objects into Apple I

────────────────────────────────

Acceptance Checklist (MUST PASS)
	•	Silent-by-default verified
	•	One ProblemState per window
	•	Determinism tests pass
	•	Append-only storage enforced
	•	Step1 hooks always present
	•	No forbidden verdict vocabulary present
	•	LBCandidate existence does NOT imply:
	•	problem existence
	•	problem absence
	•	system health

────────────────────────────────