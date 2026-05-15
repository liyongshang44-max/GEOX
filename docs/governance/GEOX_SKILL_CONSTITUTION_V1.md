# GEOX Skill Constitution V1 Draft

## 0. Document Status

Status: `v1.0-draft / governance proposal`.

Effect level: this document does not immediately override the current code contract. Once merged, it becomes the governance basis for Skill system alignment.

Blocking level: new Skill capabilities must follow this constitution. Existing Skill categories and legacy behavior enter the migration list.

Suggested path: `docs/governance/GEOX_SKILL_CONSTITUTION_V1.md`.

This document defines Skill identity, boundaries, categories, lifecycle, input/output limits, security guardrails, and the relation between Skill and Apple I / Apple II / Apple III / AO-SENSE / AO-ACT / Acceptance / ROI / Field Memory.

This is the upper-level Skill governance document. `docs/security/GEOX_SKILL_SAFETY_BOUNDARY_V1.md` is a subordinate safety-boundary note. If there is conflict, this constitution takes precedence.

---

## 1. Current Repo Alignment

The repository currently has three category vocabularies.

### 1.1 Contracts layer

`packages/contracts/src/skills/skill_contract_v1.ts` currently serializes SkillCategoryV1 as lowercase:

```text
sensing
agronomy
device
acceptance
roi
other
```

### 1.2 Server security layer

`apps/server/src/auth/skill_security_v1.ts` currently uses uppercase security categories:

```text
SENSING
AGRONOMY
DEVICE
ACCEPTANCE
OPS
CONTROL
OBSERVABILITY
```

It also excludes `before_approval` from the allowed trigger stages.

### 1.3 Existing safety boundary

`docs/security/GEOX_SKILL_SAFETY_BOUNDARY_V1.md` already defines important Skill safety rules, but it is not a complete Skill constitution. It should remain as a subordinate safety note.

### 1.4 Target canonical vocabulary

The target canonical internal category set is:

```text
SENSING
AGRONOMY
DEVICE
ACCEPTANCE
CONTROL
OPS
OBSERVABILITY
```

Compatibility policy:

```text
sensing    -> SENSING
agronomy   -> AGRONOMY
device     -> DEVICE
acceptance -> ACCEPTANCE
roi        -> legacy ROI technical signal; migrate to OPS or OBSERVABILITY
other      -> legacy only; must be reclassified or marked DEPRECATED
```

Migration rule:

1. API serialization may temporarily accept lowercase input.
2. Internal canonical representation must normalize to uppercase.
3. New SkillDefinition / SkillBinding / SkillRun / SkillTrace handling must use canonical categories.
4. OpenAPI, contracts, skill registry, skill security, and governance gates must converge on this vocabulary.
5. Legacy `roi` and `other` must not be used for newly created Skill capabilities.

---

## 2. Definition of Skill

A Skill is a contract-bound capability unit in GEOX.

A Skill may compute, classify, transform, adapt, inspect, or validate something. It is not itself a primary business-chain fact and is not a final business conclusion.

Skill output may become:

- evidence candidate
- diagnostic signal
- recommendation candidate input
- device adapter signal
- acceptance signal
- technical trace
- operator hint
- technical field-memory signal

Skill output must not directly become:

- approval decision
- AO-ACT task
- dispatch command
- device command
- formal acceptance result
- customer-visible ROI
- formal field memory
- tenant/project/group override
- customer final status

Core rule:

```text
SkillRun SUCCESS != Recommendation成立
SkillRun SUCCESS != Prescription成立
SkillRun SUCCESS != Operation成功
SkillRun SUCCESS != Acceptance PASS
SkillRun SUCCESS != ROI成立
SkillRun SUCCESS != Field Memory正式学习
```

---

## 3. Position in the GEOX Base Chain

The canonical GEOX chain is:

```text
Apple I Fact Envelope
-> Apple II Evidence / ProblemState / UncertaintyEnvelope
-> Stage-1 Sensing Summary
-> Formal Trigger Gate
-> Recommendation
-> Prescription
-> Approval
-> Operation Plan
-> AO-ACT Task
-> Dispatch / ACK
-> Receipt
-> Evidence Bundle
-> Acceptance
-> Guarded Report
-> ROI Ledger
-> Field Memory
-> Learning Validation
```

Apple III / AO-SENSE / Executor belongs to the sensing execution and edge execution layer:

```text
Apple II Judge output
-> Apple III / AO-SENSE task
-> AO-SENSE receipt
-> sensing evidence refs
-> Apple I / Apple II evidence pipeline
```

Apple III / AO-SENSE is not a substitute for Recommendation or Acceptance:

```text
AO-SENSE receipt != AO-ACT receipt
AO-SENSE task complete != operation executed
AO-SENSE evidence != acceptance pass
```

A Skill can attach to a chain node, but cannot replace a chain node.

---

## 4. Skill Categories

### 4.1 SENSING Skill

Purpose: transform raw samples, markers, AO-SENSE receipts, remote sensing, weather, or device observations into sensing signals or derived sensing states.

Allowed outputs:

- derived_sensing_state
- sensor_quality_signal
- raw_sample_ref
- marker_ref
- time_coverage_candidate
- evidence_ref
- diagnostic_note

Forbidden outputs:

- recommendation
- prescription
- approval decision
- AO-ACT task
- dispatch command
- device command
- acceptance result
- ROI
- formal field memory

SENSING Skill must not fabricate missing data, fill gaps, or bypass Apple II evidence sufficiency.

### 4.2 AGRONOMY Skill

Purpose: use ProblemState, UncertaintyEnvelope, Stage-1 summary, crop stage, soil/crop/weather context, and eligible Field Memory to produce agronomic diagnostic or recommendation-candidate signals.

Allowed outputs:

- diagnosis_signal
- recommendation_candidate
- reason_codes
- confidence
- missing_inputs
- uncertainty_notes
- evidence_refs

Forbidden outputs:

- approval decision
- AO-ACT task
- dispatch command
- device command
- receipt
- acceptance result
- customer-visible ROI
- formal field memory

AGRONOMY Skill output must pass through Recommendation / Prescription / Approval.

### 4.3 DEVICE Skill

Purpose: device capability adaptation, device protocol conversion, receipt parsing, device health signals, and execution adapters.

Allowed outputs:

- device_capability_signal
- device_protocol_payload_candidate
- execution_ack_signal
- receipt_parse_result
- device_health_signal
- execution_trace

Forbidden outputs:

- approval decision
- prescription mutation
- formal acceptance result
- customer-visible ROI
- formal field memory

DEVICE Skill must not treat ACK or receipt as acceptance.

### 4.4 ACCEPTANCE Skill

Purpose: produce acceptance signals from formal evidence policy, target prescription, execution receipt, pre/post observations, and coverage evidence.

Allowed outputs:

- acceptance_signal
- evidence_gap
- coverage_signal
- effect_signal
- reason_codes
- missing_evidence

Forbidden outputs:

- task mutation
- receipt mutation
- prescription mutation
- approval decision
- field_memory mutation
- ROI mutation

ACCEPTANCE Skill PASS signal is not a formal acceptance result. Formal acceptance must be written by the acceptance engine.

### 4.5 CONTROL Skill

Purpose: assist Control Kernel / admission / audit. It must not produce actions.

Allowed outputs:

- control_signal
- admission_context
- rule_eval_signal
- audit_signal

Forbidden outputs:

- recommendation
- prescription
- AO-ACT task
- dispatch command
- device command
- approval decision

CONTROL Skill must not turn ControlVerdict.ALLOW into a task or UI readiness.

### 4.6 OPS Skill

Purpose: operational assistance, triage, queue hints, troubleshooting, and human workflow suggestions.

Allowed outputs:

- operator_hint
- triage_signal
- workflow_recommendation
- diagnostic_note

Forbidden outputs:

- customer final status
- formal acceptance
- formal ROI
- formal field memory
- direct task mutation without backend validation

OPS Skill output is operator assistance, not customer-facing truth.

### 4.7 OBSERVABILITY Skill

Purpose: system health, logs, debug, monitoring, and trace signals.

Allowed outputs:

- health_signal
- debug_signal
- diagnostic_note
- trace
- alert_candidate

Forbidden outputs:

- agronomy recommendation
- formal field diagnosis
- acceptance result
- ROI
- formal field memory

OBSERVABILITY Skill output is technical-only by default.

---

## 5. ROI Compatibility Rule

The existing contracts layer contains a legacy `roi` category. It must not become a new first-class Skill category.

Legacy ROI Skill may only output:

- roi_signal
- calculation_hint
- evidence_ref
- uncertainty_note
- technical_trace

Legacy ROI Skill must not output:

- roi_ledger_id
- customer_visible_value=true
- trust_level=FORMAL_ACCEPTED
- formal_acceptance_id
- customer report ROI conclusion

Formal ROI Ledger must be written only by the ROI domain.

---

## 6. Lifecycle and Trigger Stages

SkillDefinition status:

```text
DRAFT
ACTIVE
DISABLED
DEPRECATED
```

SkillBinding status:

```text
ACTIVE
DISABLED
```

SkillRun status:

```text
SUCCESS
FAILED
PENDING
SKIPPED
TIMEOUT
```

Allowed trigger_stage:

```text
before_recommendation
after_recommendation
before_dispatch
before_acceptance
after_acceptance
```

Forbidden trigger_stage:

```text
before_approval
```

Reason: Approval is an authorization boundary. Skill must not insert itself into or replace approval.

---

## 7. SkillBinding Contract

Constitution target: SkillBinding must be append-only fact based.

Current compatibility: if direct binding APIs still exist, they may only act as append-only event write entries and must not directly overwrite final state.

SkillBinding mutations must include:

- changed_by_actor_id
- changed_by_token_id
- change_reason
- security_boundary_version

SkillBinding must be IAM / role / scope controlled. Customer and ordinary operator roles must not mutate SkillBinding.

---

## 8. SkillRun and SkillTrace Contract

SkillRun records that a Skill ran in a context. It must record at least:

- run_id
- skill_id
- version
- category
- result_status
- trigger_stage
- scope_type
- bind_target
- input_digest
- output_digest
- duration_ms, when available
- error_code, when failed

SkillRun may reference operation_id, task_id, recommendation_id, prescription_id, operation_plan_id, field_id, and device_id, but its existence or SUCCESS status must not imply business-chain completion.

SkillTrace records inputs, outputs, confidence, evidence refs, and audit policy. It must obey output boundaries and must not contain approval, task, dispatch, device command, acceptance override, ROI override, or tenant/project/group override.

SkillTrace can support explainability, but customer UI should prefer guarded human explain over raw SkillTrace.

---

## 9. Skill and Field Memory

SkillRun may produce technical skill memory. It must not produce formal field memory.

Default classification:

```text
SKILL_PERFORMANCE_MEMORY
-> TECHNICAL_SKILL_MEMORY
-> TECHNICAL_SIGNAL
-> customer_visible_memory=false
-> learning_eligible=false
```

Only formal acceptance-linked FIELD_RESPONSE_MEMORY may become:

```text
FORMAL_FIELD_MEMORY
FORMAL_ACCEPTED
customer_visible_memory=true
learning_eligible=true
```

---

## 10. Skill and Acceptance / ROI

Acceptance Skill may output acceptance_signal, but formal acceptance result must be written by the acceptance engine under formal evidence policy.

Skill must not directly write customer-visible ROI. Skill output may be a technical signal or evidence ref for ROI calculation, but ROI Ledger must be written by the ROI domain according to trust_level, source_lane, formal_acceptance_id, and chain_validation.

---

## 11. Hard Safety Rules

All Skills must obey:

```text
1. Must not bypass Apple II evidence sufficiency.
2. Must not bypass Recommendation / Prescription / Approval.
3. Must not directly generate AO-ACT task.
4. Must not directly generate dispatch command.
5. Must not directly generate device command.
6. Must not directly generate approval decision.
7. Must not directly generate formal acceptance result.
8. Must not directly generate customer-visible ROI.
9. Must not directly generate formal field memory.
10. Must not write tenant/project/group override.
11. Must not display technical signal as customer final conclusion.
12. Must not treat SkillRun SUCCESS as business success.
```

---

## 12. Governance Gates

Skill is a base-contract concern, not only an agronomy concern. New gates should live under:

```text
scripts/governance_acceptance/
```

Recommended gates:

```text
ACCEPTANCE_SKILL_CONSTITUTION_V1.cjs
ACCEPTANCE_SKILL_CATEGORY_BOUNDARY_V1.cjs
ACCEPTANCE_SKILL_OUTPUT_BOUNDARY_V1.cjs
ACCEPTANCE_SKILL_MEMORY_TRUST_LANE_V1.cjs
ACCEPTANCE_SKILL_BINDING_SECURITY_V1.cjs
```

These gates should be included in:

```text
ci:governance:full-base-contract
```

At minimum they must check:

- contracts / server security / skill registry / OpenAPI category normalization
- SENSING support or explicit alias to OBSERVABILITY
- `roi` as legacy technical signal only
- `other` as legacy/deprecated only
- AGRONOMY must not run before_dispatch
- DEVICE must not output acceptance / ROI
- ACCEPTANCE must not mutate task / receipt / prescription / field memory / ROI
- SkillTrace must not contain forbidden output keys
- SkillRun SUCCESS must not become customer-visible success
- SkillBinding write must include actor / token / reason / security boundary

---

## 13. Current Required Alignment Tasks

After this draft is merged, open a small Skill alignment task separate from formal scenario E2E.

### Task 1: Skill category contract alignment

Unify contracts / server security / skill registry / OpenAPI / gates.

Required behavior:

```text
lowercase API input -> normalize canonical uppercase
SENSING formally supported
roi legacy technical signal only
other legacy/deprecated only
```

### Task 2: Skill constitution gates

Add `ACCEPTANCE_SKILL_CONSTITUTION_V1.cjs` and include it in `ci:governance:full-base-contract`.

### Task 3: subordinate safety-boundary note

Mark `docs/security/GEOX_SKILL_SAFETY_BOUNDARY_V1.md` as subordinate to this constitution.

---

## 14. Conclusion

Skill is a capability unit, not a business-chain fact.

Skill can provide signals, but cannot replace authorization, execution, acceptance, ROI, or learning boundaries.

GEOX expands through Skill, but GEOX remains trustworthy through contracts.

```text
Skill expands capability.
Contract preserves trust.
```
