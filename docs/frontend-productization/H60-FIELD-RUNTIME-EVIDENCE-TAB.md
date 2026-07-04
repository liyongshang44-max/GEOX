<!-- docs/frontend-productization/H60-FIELD-RUNTIME-EVIDENCE-TAB.md -->
# H60-E Field Runtime Evidence Tab
# H60-E Field Runtime 证据标签页

Status: H60-E EVIDENCE TAB  
Language: zh-CN  
Scope: Frontend Productization / Field Runtime Evidence / Read-only Evidence Quality Adapter  
Repo basis: main after H60-D merge  
Write impact: NONE  
Backend impact: NONE  
DB impact: NONE  
Route topology impact: NONE  

---

## 0. Purpose

H60-E migrates Evidence tab only.

Canonical route is:

```text
/operator/fields/:fieldId/evidence
```

Legacy route remains:

```text
/operator/twin/fields/:fieldId/evidence
```

The source is the existing read-only evidence quality read model:

```text
source: operator_field_twin_evidence_quality_v1
```

H60-E reuses `fetchOperatorFieldTwinEvidenceQuality`.
H60-E does not create backend contract.
H60-E does not create a new backend endpoint.
H60-E does not change route topology.

---

## 1. Migrated content

H60-E migrates:

```text
Evidence
Evidence Trace
Data Coverage
Quality Summary
Source Index
Evidence Gaps
Evidence Boundary
```

H60-E does not migrate:

```text
Forecast
Scenario
Residual
Calibration
Health
Audit drawer
Replay Demo productization
Pilot Readiness
```

Forecast remains H60-F.
Scenario split remains H60-G.
Residual remains H60-H.
Calibration remains H60-I.
Health remains not_enabled / planned for H62.
Audit remains H60-K.

---

## 2. Data strategy

H60-E adds:

```text
apps/web/src/features/operator/fieldRuntime/fieldRuntimeEvidenceAdapter.ts
```

The adapter reuses:

```text
fetchOperatorFieldTwinEvidenceQuality
```

It maps `operator_field_twin_evidence_quality_v1` into a Field Runtime Evidence ViewModel.
It does not change backend response shape.
It does not add backend endpoints.
It does not write facts.
It does not create recommendation.
It does not approve / dispatch / create AO-ACT.
It does not write ROI / Field Memory.

Allowed frontend work:

```text
rename
group
format
count
presence / absence
source label mapping
quality status display
evidence refs truncation / expansion
```

Forbidden frontend work:

```text
risk scoring
priority sorting
recommendation generation
state estimation
forecast generation
scenario ranking
causal inference
model calibration
```

---

## 3. Product language

Canonical Evidence tab product titles use:

```text
Evidence
Evidence Trace
Data Coverage
Quality Summary
Source Index
Evidence Gaps
Evidence Boundary
```

Canonical main titles do not use:

```text
Operator Twin Evidence Quality
H25 Evidence Page
operator_field_twin_evidence_quality_v1
raw evidence contract
Twin 工作区
```

`operator_field_twin_evidence_quality_v1` is allowed only as a source label, contract detail, or audit source metadata.

Evidence quality status is not agronomic risk.
Evidence gaps do not trigger observation requests.
Source index tables are audit/detail metadata, not primary product titles.
Table names are detail metadata, not primary Field Runtime titles.

---

## 4. Boundary

H60-E shows the no-write boundary:

```text
No facts write
No recommendation creation
No approval
No dispatch
No AO-ACT task
No ROI write
No Field Memory write
No evidence mutation
No backend contract change
```

H60-E does not write facts.
H60-E does not create recommendation.
H60-E does not approve / dispatch / create AO-ACT.
H60-E does not write ROI / Field Memory.
H60-E does not mutate evidence.
H60-E does not create backend contract.

---

## 5. Route behavior

H60-E does not add routes.
H60-E does not change `App.tsx`.
H60-E does not change `operatorFieldRuntimeRoutes.tsx` route topology.
H60-E does not redirect legacy routes.
H60-E does not delete legacy routes.

Route behavior:

```text
/operator/fields/:fieldId/evidence        -> Field Runtime Evidence
/operator/twin/fields/:fieldId/evidence   -> legacy Operator Field Twin Evidence page
```

---

## 6. Acceptance

H60-E acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```

H60-D acceptance is phase-specific. H60-E acceptance checks that H60-D Overview / State, H60-C layout/tabs, and H60-B route topology remain intact without reusing their changed-file allowlists.

---

## 7. Completion definition

H60-E complete means:

```text
/operator/fields/:fieldId/evidence shows real Field Runtime Evidence content
Evidence content is loaded from existing fetchOperatorFieldTwinEvidenceQuality
source is operator_field_twin_evidence_quality_v1
Evidence Trace is visible
Data Coverage Matrix is visible
Quality Summary is visible
Source Index Inventory is visible
Low-quality reasons / Evidence gaps are visible
Evidence Boundary is visible
legacy /operator/twin/fields/:fieldId/evidence remains available
H60-D Overview / State remains intact
H60-C layout/tabs remain intact
Health remains not_enabled / planned for H62
no write surface is introduced
no new backend endpoint is introduced
H60-E acceptance passes
typecheck passes
build passes
```

H60-E does not mean:

```text
Forecast migrated
Scenario readonly split completed
Residual migrated
Calibration migrated
Runtime Health completed
Audit drawer completed
Replay Demo productization completed
Pilot Readiness completed
```
