# H57 — ROI Governance Boundary

## Purpose

H57 defines the ROI governance boundary from existing repository capabilities.

This task does not add a new ROI implementation path.

The purpose is to prevent the ROI layer from being treated as a single undifferentiated downstream step after water response verification.

## Repository facts

The repository already contains ROI capability files:

- `apps/server/src/routes/roi_ledger_v1.ts`
- `apps/server/src/domain/roi/roi_ledger_v1.ts`
- `apps/server/db/migrations/2026_04_24_roi_ledger_v1.sql`
- `scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs`

The repository already exposes two ROI write lanes:

```text
POST /api/v1/roi-ledger/from-as-executed
POST /api/v1/roi-ledger/formalize-from-acceptance
```

## Lane boundary

### AS_EXECUTED_SIGNAL lane

`POST /api/v1/roi-ledger/from-as-executed` creates ROI signal rows from as-executed evidence.

This lane is allowed to produce operational ROI signals.

It must remain:

```text
customer_visible_value = false
trust_level = INTERIM_SUPPORTED
source_lane = AS_EXECUTED_SIGNAL
```

It must not be used as:

- billing source
- yield promise
- profit promise
- customer-visible formal value
- Field Memory trigger

### FORMAL_ACCEPTANCE lane

`POST /api/v1/roi-ledger/formalize-from-acceptance` formalizes ROI from a formal acceptance result.

This lane is the customer-visible value lane.

It must remain:

```text
customer_visible_value = true
trust_level = FORMAL_ACCEPTED
source_lane = FORMAL_ACCEPTANCE
```

It must require formal acceptance and chain validation.

It must also require an existing interim ROI row before formal ROI is created.

## Field Memory separation

H57 does not create Field Memory.

ROI governance must not directly write `field_memory_v1`.

Field Memory remains a separate H58 boundary, even though ROI rows may later be referenced by memory or reports.

## Current acceptance coverage

Existing ROI runtime acceptance covers the `from-as-executed` lane.

This H57 governance boundary records that fact and does not claim complete formal ROI runtime coverage for `formalize-from-acceptance`.

If formal customer-visible ROI needs stronger runtime proof, it should be handled as a focused follow-up inside H57, not as a new business feature.

## H57 stop rule

H57 stops at ROI lane governance.

It does not implement:

- new ROI calculation logic
- billing
- Field Memory
- learning memory
- report generation

## Acceptance commands

```powershell
node scripts/governance_acceptance/H57_ROI_GOVERNANCE_BOUNDARY.cjs
pnpm run typecheck:server
```

Expected result:

```text
ok = true
h57_roi_governance_boundary = PASS
roi_lane_split_present = true
as_executed_signal_not_customer_visible = true
formal_acceptance_customer_visible = true
formal_acceptance_gate_protected = true
interim_roi_required_before_formal_roi = true
roi_field_memory_separated = true
next_step = H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY
```
