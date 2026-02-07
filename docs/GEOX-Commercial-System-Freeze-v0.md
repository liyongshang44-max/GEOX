# GEOX · Commercial System Freeze v0

Status: COMMERCIAL FREEZE (System-level)

Tag target: geox_system_commercial_v0

Acceptance target: scripts/ACCEPTANCE_GEOX_SYSTEM_COMMERCIAL_V0.ps1 (invoked via `pnpm acceptance:system:commercial:v0`)

Deploy target: scripts/DEPLOY_GEOX_SYSTEM_COMMERCIAL_V0.ps1 (invoked via `pnpm deploy:commercial:v0`)

## 0. Definition (MUST BE FIRST)

This Sprint establishes GEOX as a single commercial product for the first time.

The commercial deliverable is NOT an individual module.

It is a complete, layered system constrained by the Control Constitution, with one-way dependencies and forbidden paths enforced in commercial state.

The system includes:

- Apple I · Monitor / Evidence
- Apple II · Judge / ProblemState
- Apple III · Execution / Audit
- Apple IV · Agronomy (Explain-only)

Commercial freeze means: any privileged cross-layer coupling, any bypass of Apple II for execution, or any write-path from Apple IV into Apple III is a hard failure.

## 1. Layering Contract (Commercial State)

### 1.1 One-way dependency

Allowed direction only:

Apple I → Apple II → Apple III → Apple IV

In commercial state, the following are forbidden:

- Any import/reference path from a higher layer back into a lower layer.
- Any runtime pathway that allows bidirectional reads/writes between layers.

### 1.2 System-wide forbidden items

The following are explicitly prohibited at system level:

1) Apple III cannot be deployed alone for external use.
2) Execution cannot be driven by bypassing Apple II.
3) Apple IV output must never enter AO-ACT (Apple III).
4) Constitution constraints must not be disabled.

## 2. Commercial Deliverables

### 2.1 One-command full-stack deployment

The commercial deployment is a unified Apple I–IV deployment via:

- `pnpm deploy:commercial:v0`

Commercial default safety state:

- Execution is default-disabled.

Deployment success criteria:

- Backend health ok: `GET /api/health` returns ok=true
- Admin bootstrap health ok: `GET /api/admin/healthz` returns ok=true

### 2.2 One-command system acceptance

System acceptance runs the full chain and produces an auditable report:

- `pnpm acceptance:system:commercial:v0`

Acceptance report output (artifact):

- `artifacts/system_acceptance/commercial_v0/system_acceptance_report.json`

### 2.3 System audit package

The acceptance report is the minimal system audit package v0.

It is append-only as an artifact (not written back into Facts). It records:

- Which checks ran
- Which checks passed/failed
- Any notes/reasons on failure
- Any overlays used for negative acceptance

## 3. System-level Negative Acceptance (Must be HARD)

All negative items below must be encoded as executable checks. Any violation is a hard fail.

### 3.1 Remove Apple II → system unusable

Commercial state must not tolerate Apple II removal/disable.

The system acceptance enforces this by applying a temporary commercial overlay which disables Apple II behavior and asserting that the system becomes unusable.

### 3.2 Apple IV output → AO-ACT must fail

Agronomy (Apple IV) is explain-only.

It must not encode AO-ACT semantics.

Commercial acceptance asserts Agronomy write payloads containing `ao_act*` keys are rejected.

### 3.3 AO-ACT receipt must not alter ProblemState

Apple III receipts must not accept ProblemState identifiers or fields.

Commercial acceptance asserts AO-ACT receipt payloads containing `problem_state_id` are rejected.

### 3.4 Any bidirectional layer access → fail

Commercial acceptance includes a static forbidden dependency scan.

Minimal enforced rule set (v0):

- Apple IV routes must not import Apple III control routes.
- Apple III control routes must not import Apple IV routes.

Any detected forbidden import path is a hard failure.

## 4. How to Run (Commercial v0)

### 4.1 Deploy

From repo root:

- `pnpm deploy:commercial:v0`

### 4.2 Accept

From repo root:

- `pnpm acceptance:system:commercial:v0`

### 4.3 Artifacts

After acceptance:

- `artifacts/system_acceptance/commercial_v0/system_acceptance_report.json`

## 5. Non-goals (Commercial Freeze Discipline)

The following are NOT part of commercial v0 and are explicitly excluded:

- Introducing new control semantics
- Changing Judge/ProblemState meaning
- Adding automatic execution triggers
- Adding any uncertainty aggregation/gating capability
- Adding hidden inference paths or convenience APIs that bypass the constitution

## 6. Freeze Output Checklist

This document is the required freeze doc for Sprint 24:

- docs/GEOX-Commercial-System-Freeze-v0.md

Other freeze outputs (tracked separately):

- Acceptance script: scripts/ACCEPTANCE_GEOX_SYSTEM_COMMERCIAL_V0.ps1
- Deploy script: scripts/DEPLOY_GEOX_SYSTEM_COMMERCIAL_V0.ps1
- Tag target: geox_system_commercial_v0
- Manifest: (to be produced in the next task)
