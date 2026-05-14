# GEOX Contract Alignment Matrix V1

Status: audit baseline  
Scope: Apple I / Apple II / Apple III / Controlplane / Stage-1 sensing / Skill / AO-ACT / Acceptance / Flight Table / Customer and Operator frontend.

## Purpose

This matrix prevents upper product surfaces from drifting away from the documented base contracts. It is intentionally stricter than a page-level UI review. The question is not whether a page can render; the question is whether every rendered business conclusion can be traced back to the correct contract layer.

The matrix separates four ideas that have been mixed in prior implementations:

1. **Observable fact**: something recorded in append-only facts or a read model.
2. **Evidence quality**: whether the fact is sufficient, timely, continuous, and scale-correct.
3. **Business node validity**: whether a chain node is formally allowed to count as formed.
4. **Customer/operator presentation**: whether the valid node may be rendered as a product conclusion.

## Hard precedence

When documents appear to overlap, apply this precedence:

1. Repository SSOT and frozen constitutional documents.
2. Apple I / Apple II / Apple III frozen contracts.
3. Controlplane constitution and AO-ACT contracts.
4. Stage-1 sensing and recommendation trigger contracts.
5. Skill safety boundary and skill trace contracts.
6. Customer/operator API inventories and frontend same-source rules.
7. Page-level VM and UI copy rules.

Frontend same-source rules never make an invalid backend projection valid. They only ensure the page and export use the same already-valid report payload.

---

## Matrix

| Layer | Contract source | Formal source-of-truth | Must be consumed by | Forbidden bypass / drift | Current risk to check |
| --- | --- | --- | --- | --- | --- |
| Repository SSOT | `docs/SSOT.md` | `/api/v1/*`, migrations + health checks, build artifacts | API registration, docs, release gates | Legacy/debug/admin APIs becoming customer/operator source | Route and API inventory must stay updated in same PR as route changes |
| Raw evidence envelope | `docs/Fact_Envelope_Contract_v1.md` | RawSample / SeriesResponse / overlays | sensing projections, evidence viewers | samples interpolation, fake gaps, overlays used as recommendations/conclusions | Customer/report VM must not treat overlays as action or acceptance |
| Apple I monitor base | `docs/AppleI_freeze/*`, `doc/Policies/*` | SpatialUnit, evidence ledger, QC, StateVector | Judge, Stage-1 sensing, report guards | raw metric interpreted as diagnosis/action; no data treated as stable | Report must not convert a single soil moisture value into formal diagnosis |
| Apple II Judge base | `doc/AppleII/*`, `docs/AppleII_freeze/*` | ProblemState / uncertainty outputs | Controlplane, AO-SENSE, report guard as audit context | Judge emitting diagnosis, recommendation, action, OK/safe/risk score | Operation report guard must not become a mini Judge |
| Apple II time coverage | Apple II pipeline / logic rules | Evidence Sufficiency, Time Coverage, QC, Device Health, Conflict Detection | sensing summary, problem states, diagnostic warnings | ignoring coverage gaps, single-point windows, stale windows | Stage-1 and report must distinguish point evidence from window-supported evidence |
| Apple III AO-SENSE | `docs/appleiii_v0_aosense_freeze.md`, sprint5 executor | AO_SENSE_TASK / AO_SENSE_RECEIPT | sensing executor, dev/operator audit | AO-SENSE receipt treated as AO-ACT or agronomy conclusion | Sense receipt may update knowledge, not execution success |
| Control input constitution | `GEOX-ControlConstitution-AllowedInputs-v0.md`, `AllowedInputPaths` | ProblemState + UncertaintyEnvelope + PermissionSet field map | Control kernel only | raw samples, AO-ACT, agronomy interpretation, UI/manual input directly read by kernel | Control verdict must remain isolated from report/business advice |
| Control output constitution | `GEOX-ControlKernel-AllowedOutputs-v0.md`, `ControlKernel-NonGoals` | ControlVerdict only | audit, safe display | kernel outputting explanation, recommendation, task, priority, parameters | UI must not turn control verdict into next action without allowed layer |
| Ruleset loading | `RepoConst-Ruleset-Loading-Policy-v0.md` | explicit ruleset object if supplied; otherwise not loaded | kernel admission/audit only | UI/scheduler behavior based on `ruleset_status`; runtime auto-loading rules | Any ruleset status shown must be audit-only, not readiness/action gating |
| Stage-1 sensing summary | `STAGE1_FIELD_SENSING_SUMMARY_CONTRACT.md` | `stage1_sensing_summary` | decision engine, report guard, customer/field report | `field_sensing_overview_v1` or raw telemetry used as customer formal source | Operation report must not formalize diagnosis from raw skill soil moisture alone |
| Stage-1 recommendation trigger | `STAGE1_RECOMMENDATION_TRIGGER_BOUNDARY.md` | formal fields: `irrigation_effectiveness`, `leak_risk` | recommendation generation, chain guard | support-only/internal fields triggering formal recommendation | Recommendation guard should check formal trigger provenance, not just `deficit_detected` |
| Agronomy interpretation | `GEOX-CP-Agronomy-Interpretation-Contract-v1.md` | interpretation fact, external to Judge/control determinism | decision/plan/policy as explanatory input | direct action, control, task, ProblemState, AO-SENSE mutation from interpretation | Report must label interpretation as explanation, not authority |
| Skill safety | `GEOX_SKILL_SAFETY_BOUNDARY_V1.md` | skill contract + skill trace | skill runtime, agronomy explain, technical disclosure | `skill_run success` treated as operation success; AGRONOMY skill emits task/approval/device command | Skill output must not skip formal trigger, approval, AO-ACT, acceptance gates |
| Decision / Plan | `GEOX-CP-Decision-Plan-Contract-v0.md` | decision_plan candidate | approval / plan UI as candidate only | `decision_plan exists -> execute`; plan treated as prescription/control command | Operation plan must require explicit approval decision and plan authorization |
| AO-ACT task | `GEOX-CP-AO-ACT-Contracts-v0.md`, execution contract | human-explicit physical task fact | dispatch, receipt, operator workbench | ProblemState/recommendation automatically creates task; template/default task generation | Flight Table helper task must be marked simulated/dev-only |
| AO-ACT receipt | AO-ACT execution/read contracts, `IRRIGATION_RECEIPT_MINIMUM_CONTRACT.md` | execution receipt fact | acceptance/evidence as input only | receipt success -> acceptance pass/final_status/ROI/learning | Report and frontend must preserve `receipt success != acceptance pass` |
| Judge AO-ACT read | `GEOX-CP-AO-ACT-Judge-Read-Contract-v0.md`, readable facts partition | AO-ACT as Execution Evidence / explain mirror | Judge audit context only | AO-ACT driving ProblemState or agronomy conclusions | Report must not infer problem resolved from receipt status |
| Acceptance verdict | `ACCEPTANCE_RESULT_VERDICT_SEMANTICS.md` | acceptance result/verdict | report, customer/operator UI | frontend or receipt/evidence count deriving PASS/FAIL | Acceptance must remain backend-owned and formal-path-owned |
| ROI / Field Memory | ROI and memory contracts / report payload | accepted evidence and learning records | customer report, operator ledger | ROI/learning conclusion from simulated chain or unaccepted operation | Simulated helper chain may be diagnostic only, not trusted learning |
| Flight Table | `docs/flight-table/*` | dev-only run, manifest, snapshots | dev route/API only; formal API probes as snapshots | Flight Table entering formal customer/operator navigation or replacing formal APIs | `ft_op_*` reports must be marked helper/simulated unless formal chain is proven |
| Customer official APIs | `API_ROUTE_INVENTORY.md`, frontend route inventory | `/api/v1/customer/*`, `/api/v1/reports/field|operation/*` | customer pages and exports | fallback/debug/admin/legacy used as primary customer source | Official report API itself must be contract-guarded before frontend trusts it |
| Frontend same-source | `P2_FULL_CLOSURE_UI_ACCEPTANCE.md`, fallback retirement | page VM + export VM from same report payload | customer pages and exports | page/export divergence, local final_status inference, business API calls from export | Same-source can still be consistently wrong if report payload violates base contracts |
| Operator workbench | API inventory, fallback retirement | official operator read/write facades | operator pages | fallback enabling write buttons or inferring readiness | Operator write readiness must remain backend-owned and audited |

---

## Immediate alignment findings

1. `operation_report_chain_v1` and `operation_chain_validator_v1` are necessary as report guards, but they must not become Apple II Judge or Control Kernel replacements.
2. A report guard may check references, provenance, simulated/helper status, and upstream authorization. It must not independently decide agronomy truth from raw data.
3. Formal irrigation recommendation validity must be traced through Stage-1 formal trigger fields and sensing/Judge quality outputs, not only through `skill_trace.inputs.soil_moisture`.
4. Flight Table facts may exist in the same facts ledger, but customer reports must downgrade them unless they can prove formal customer-valid upstream chain membership.
5. Frontend gates are necessary but insufficient. They check same-source and obvious status inference, not whether the official report API is aligned with Apple I/II/III and Controlplane contracts.

## Required follow-up gates

1. `ACCEPTANCE_CONTRACT_ALIGNMENT_V1.cjs`: static governance scan across backend report, validator, flight-table, and frontend status paths.
2. Runtime sample gate for `ft_op_*`: flight-table/helper operations must not return `chain_integrity=COMPLETE` unless they have formal upstream approvals, formal prescription facts, trusted evidence, and formal acceptance.
3. Report API gate: `/api/v1/reports/operation/:id` must emit backend-owned `chain_validation` and frontend must not reconstruct it.
4. Stage-1 trigger gate: recommendation chains must show formal trigger provenance from Stage-1 sensing summary; raw metrics and skill trace may support explanation only.

## Known open questions

- Exact implemented fact type for Apple II ProblemState is not yet clearly wired into the current operation report API. Until it is, report guard must avoid pretending to perform Apple II evidence sufficiency/time coverage itself.
- Observation-window continuity requirements exist at the Apple II contract level; current Stage-1/report implementation must be audited for whether coverage ratio / gap / sample-count fields are implemented or only implied through freshness/confidence.
- Existing frontend release gates do not validate backend contract alignment. A cross-layer gate is required.
