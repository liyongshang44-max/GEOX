Apple II · Judge — AI IMPLEMENTATION PACKET
Audience: AI Code Generator ONLY
Status: CONSTITUTIONAL — DO NOT REDESIGN
Scope: Implement Apple II (Judge) on top of frozen Apple I

────────────────────────────────
	0.	Absolute Positioning (READ FIRST)

This repository implements a layered control OS:

Apple I   = Monitor (Evidence-only, replayable)
Apple II  = Judge   (Problem & Uncertainty Declaration)
Apple III = Control (Permission / Execution) — NOT INCLUDED

Your task: IMPLEMENT Apple II ONLY.

Hard non-goals:
	•	NO actions
	•	NO recommendations
	•	NO permissions
	•	NO diagnoses
	•	NO risk scoring
	•	NO “OK / NORMAL / SAFE” system verdicts

Silent-by-default rule:
	•	If no defined ProblemState condition is satisfied → output no ProblemState.
	•	Silence does NOT mean “healthy”, “normal”, or “safe”.

Runtime clarification:
	•	“Output nothing” means returning:
	•	problem_states: []
	•	silent: true
as defined in GEOX-AII-06.
	•	It does NOT mean HTTP 204, null response, or missing fields.

────────────────────────────────
	1.	Canonical Objects (DO NOT INVENT NEW ONES)

Apple II outputs ONLY these objects:
	1.	ProblemStateV1      ← ONLY authoritative problem anchor
	2.	ReferenceViewV1     ← Optional, read-only contrast evidence
	3.	AO-SENSE            ← Derived observation request (weakest)
	4.	LBCandidateV1       ← Non-authoritative interpretation asset

Allowed construction paths (FROZEN):
	•	Evidence / State → ProblemState
	•	Evidence / State → ReferenceView → ProblemState
(ReferenceView is OPTIONAL and internal; ProblemState MUST remain derivable without it.)
	•	ProblemState → AO-SENSE
	•	ProblemState → LBCandidate

Forbidden (INVALID):
	•	LBCandidate → ProblemState
	•	AO-SENSE without ProblemState
	•	ReferenceView → AO-SENSE (standalone)
	•	Any Control / Permission / Recommendation semantics anywhere in Apple II

ReferenceView clarification:
	•	ReferenceView is an optional organizational component.
	•	ProblemState MUST NOT depend on the existence of any ReferenceView.
	•	ReferenceView MUST NOT consume ProblemState.

────────────────────────────────
	2.	Normative Documents (MUST READ, NO EXCEPTIONS)

Treat the following as constitutional law:
	•	doc/AppleII/GEOX-AII-01.md   (ProblemStateV1 Schema)
	•	doc/AppleII/GEOX-AII-02.md   (Judge Pipeline v1)
	•	doc/AppleII/GEOX-AII-03.md   (ReferenceViewV1)
	•	doc/AppleII/GEOX-AII-04.md   (Judge Logic Rules v1)
	•	doc/AppleII/GEOX-AII-05.md   (LBCandidateV1)
	•	doc/AppleII/GEOX-AII-06.md   (Runtime / API Contract)
	•	doc/AppleII/GEOX-AII-00-APP-A.md (Enums & Constraints)

If any implementation conflicts with these documents → implementation is INVALID.

────────────────────────────────
	3.	Deterministic Execution Model (MANDATORY)

Judge MUST be:
	•	deterministic
	•	stateless between runs
	•	silent-by-default

Same input ⇒ same output (or same silence).

FORBIDDEN:
	•	randomness
	•	learned thresholds
	•	heuristic guessing
	•	time-dependent behavior (except created_at_ts, which is non-semantic)

Ambiguity handling rule (FROZEN):
	•	Ambiguity MUST NOT be represented by emitting multiple ProblemStates.
	•	Per GEOX-AII-02, emit at most ONE ProblemState per window (first-hit wins).
	•	Encode ambiguity ONLY via:
	•	uncertainty_sources
	•	supporting_evidence_refs
	•	confidence
	•	Silence is NOT a tool for expressing ambiguity.

────────────────────────────────
	4.	Pipeline Execution (FIXED ORDER)

You MUST implement the pipeline in this exact order:
	1.	Input Assembly
	2.	Evidence Sufficiency
	3.	Time Coverage
	4.	QC / Device Health
	5.	Reference Assembly (optional)
	6.	Conflict Detection
	7.	Scale Policy
	8.	Exclusion / Marker
	9.	ProblemState Emission
	10.	AO-SENSE Derivation (only if ProblemState exists)

Rules:
	•	First hit wins
	•	One ProblemState per window
	•	No merging, no ranking

Step1 Hooks (MANDATORY):

Every emitted ProblemStateV1 MUST include:
	•	state_layer_hint
	•	rate_class_hint
	•	problem_scope

Rules:
	•	These fields are REQUIRED
	•	MUST NOT be null
	•	Use “unknown” if undecidable
	•	They carry NO control or decision semantics

────────────────────────────────
	5.	Persistence Rules (APPEND-ONLY)

If persistence is enabled:
	•	Every Judge run MUST generate a unique run_id
	•	All outputs are append-only
	•	NEVER update or overwrite prior records
	•	NEVER express “current truth”

Storage binding rule (FROZEN):
	•	Storage MUST maintain a RunRecord keyed by run_id
	•	All persisted objects MUST be linked to run_id via:
	•	foreign key, join table, or equivalent
	•	Canonical object schemas MUST remain unchanged
	•	Do NOT inject run_id into objects unless the schema explicitly defines it

Objects that may be stored:
	•	ProblemStateV1
	•	ReferenceViewV1
	•	AO-SENSE
	•	LBCandidateV1

────────────────────────────────
	6.	Forbidden Patterns (FAIL IF SEEN)

FAIL the implementation if ANY of the following appear as system verdicts or implied decisions:
	•	should / recommend / need to
	•	allow / deny / legal / illegal
	•	OK / NORMAL / SAFE
	•	risk_level / priority
	•	cause / diagnosis
	•	irrigation / fertilize / intervene

Clarification:
	•	LBCandidateV1.status_word = STABLE is ALLOWED
	•	It MUST NOT be interpreted as system health, permission, or readiness

If uncertain → do nothing.

────────────────────────────────
	7.	Final Instruction

Implement Apple II exactly as specified.

Do NOT:
	•	simplify
	•	optimize semantics
	•	invent meaning
	•	collapse layers

When in doubt:
	•	declare uncertainty
	•	or remain silent

This system is constitutional, not advisory.

————————————