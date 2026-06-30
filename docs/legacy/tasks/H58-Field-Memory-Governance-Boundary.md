# H58 — Field Memory Governance Boundary

## Purpose

H58 defines the Field Memory governance boundary from existing repository capabilities.

This task does not add a new Field Memory implementation path.

The purpose is to prevent technical memory, ROI rows, skill traces, simulated data, or object existence from being treated as formal learning.

## Repository facts

The repository already contains Field Memory capability files:

- `apps/server/src/routes/field_memory_v1.ts`
- `apps/server/src/services/field_memory_service.ts`
- `apps/server/db/migrations/2026_04_27_field_memory_v1.sql`
- `scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs`

The repository already exposes the formal Field Memory write lane:

```text
POST /api/v1/field-memory/from-acceptance
```

## Formal Field Memory lane

`POST /api/v1/field-memory/from-acceptance` is the formal memory entry point.

It must require:

```text
field_memory.write
operation_plan_id
acceptance_id
acceptance_result_v1
verdict = PASS
formal_acceptance = true
formal_evidence_passed = true
chain_validation_passed = true
field_id
observation pair
```

Successful formal memory must remain:

```text
memory_type = FIELD_RESPONSE_MEMORY
memory_lane = FORMAL_FIELD_MEMORY
trust_level = FORMAL_ACCEPTED
source_lane = FORMAL_OPERATION
customer_visible_memory = true
learning_eligible = true
```

## Technical memory lanes

Technical memory lanes may exist as raw operational signals.

They must not be treated as formal learning.

Technical memory includes:

```text
TECHNICAL_SKILL_MEMORY
TECHNICAL_EXECUTION_MEMORY
DIAGNOSTIC_NOTE
```

These lanes must remain:

```text
customer_visible_memory = false
learning_eligible = false
```

## Simulated / development memory

Simulated or development memory must remain downgraded.

It must remain:

```text
memory_lane = SIMULATED_DEV_MEMORY
trust_level = SIMULATED_DEV_ONLY
customer_visible_memory = false
learning_eligible = false
```

## Operator learning boundary

Learning is effective only when formal Field Memory exists.

The backend learning validation boundary must preserve these rules:

- `FORMAL_FIELD_MEMORY` plus `FORMAL_ACCEPTED` is required for formal learning.
- ROI rows alone are not formal learning.
- Skill success alone is not formal learning.
- Technical memory alone is not formal learning.
- Simulated or development signals block formal learning.

## H58 stop rule

H58 stops at Field Memory governance.

It does not implement:

- new Field Memory write logic
- ROI
- billing
- frontend changes
- new learning algorithms
- report generation

## Acceptance commands

```powershell
node scripts/governance_acceptance/H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY.cjs
pnpm run typecheck:server
```

Expected result:

```text
ok = true
h58_field_memory_governance_boundary = PASS
formal_field_memory_gate_present = true
technical_memory_not_formal_learning = true
simulated_memory_not_formal_learning = true
operator_learning_requires_formal_memory = true
roi_not_learning_effective = true
next_step = STOP_AFTER_H58
```
