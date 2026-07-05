# R5 Field Pilot Runtime Readiness

## Phase

R5 Field Pilot Runtime Readiness / R5 田间试点运行准备度.

## Purpose

R5 defines the contract-first field pilot readiness gate after R1-R4.

R5 determines whether runtime evidence, state estimation, forecast calibration, and health service gates are sufficient to support controlled field pilot consideration.

R5 asks whether R1-R4 runtime gates, safety / stop rules, human role matrix, and execution boundaries are sufficient to allow a human-approved controlled field pilot to be considered.

R5 is not pilot start. R5 is not dispatch. R5 is not AO-ACT execution. R5 is not ROI. R5 is not Field Memory. R5 is not autonomous operation.

## Preconditions

R1 Runtime Evidence Stream Readiness is available.
R2 Online State Estimation Loop is available.
R3 Forecast Calibration & Residual Loop is available.
R4 Runtime Health Service Gate is available.

R5 references R1-R4 docs and acceptance artifacts. R5 readiness cannot be decided by verbal assertion alone.

## Non-goals

R5 does not start pilot automatically. R5 does not dispatch. R5 does not create AO-ACT task. R5 does not write ROI. R5 does not write Field Memory. R5 does not create recommendations. R5 does not update model. R5 does not authorize autonomous operation. R5 does not bypass human approval. R5 does not claim production deployment.

R5 does not add a pilot start endpoint, dispatch endpoint, AO-ACT task creator, recommendation writer, ROI writer, Field Memory writer, model updater, or autonomous execution pathway.

R5 only defines readiness criteria. R5 does not execute.

## R1 Evidence Stream Gate

R5 must confirm R1 evidence stream passed.

R1 provides:

```text
evidence stream contract
source identity
subject identity
timestamp semantics
replay path
freshness model
invalid / missing / delayed behavior
state eligibility boundary
```

R5 cannot bypass R1.

If R1 is missing or failed, R5 readiness outcome is:

```text
not_ready: evidence_stream_not_ready
```

R5 must reference R1 evidence stream artifact and R1 acceptance artifact.

## R2 State Estimation Gate

R5 must confirm R2 state estimation passed.

R2 provides:

```text
state estimate object
estimate cadence
input evidence window
confidence / uncertainty
missing data behavior
replay equivalence
state read model
state freshness
```

If R2 is missing or failed, R5 readiness outcome is:

```text
not_ready: state_estimation_not_ready
```

R5 must reference R2 state estimate artifact and R2 acceptance artifact.

## R3 Calibration / Residual Gate

R5 must confirm R3 calibration loop passed.

R3 provides:

```text
forecast object
forecast horizon
verification window
post-event evidence
residual calculation
error bucket
calibration review packet
forecast replay
```

If R3 is missing or failed, R5 readiness outcome is:

```text
not_ready: forecast_calibration_not_ready
```

R5 does not require forecasts to be perfectly accurate. R5 requires forecasts to be verifiable, residuals to be calculable, and calibration review to be possible.

R5 must reference R3 forecast/residual/calibration artifact and R3 acceptance artifact.

## R4 Runtime Health Service Gate

R5 must confirm R4 runtime health service gate passed.

R4 provides:

```text
review health separated from service health
health freshness defined
service health model defined
device evidence requirements defined
gateway evidence requirements defined
live monitoring eligibility defined
failure modes defined
health read model defined
```

If R4 is missing or failed, R5 readiness outcome is:

```text
not_ready: runtime_health_gate_not_ready
```

R5 must reference R4 health service gate artifact and R4 acceptance artifact.

## Controlled Field Pilot Readiness Criteria

R5 defines controlled field pilot readiness criteria.

Criteria categories:

```text
runtime evidence readiness
state estimation readiness
forecast / calibration readiness
runtime health service gate readiness
field scope readiness
device / gateway evidence readiness
safety / stop-rule readiness
human role readiness
execution gating readiness
rollback / incident readiness
audit / traceability readiness
```

Readiness outcomes:

```text
not_ready
blocked
conditional_ready
ready_for_human_review
ready_candidate
```

Definitions:

```text
not_ready: one or more required gates absent
blocked: safety/role/execution boundary violation exists
conditional_ready: gates present but limitations require explicit human review
ready_for_human_review: runtime criteria satisfied enough for formal human approval packet
ready_candidate: candidate state only; not pilot start
```

R5 default maximum claim:

```text
ready_for_human_review
```

`ready_candidate` is not pilot start. `ready_for_human_review` is not pilot authorization.

## Field Scope Readiness

R5 defines field scope readiness.

Field scope fields:

```text
tenant_id
project_id
field_id
zone_id if applicable
pilot_scope_mode
field boundary ref
device/source binding refs
human owner ref
safety owner ref
operator owner ref
```

Pilot scope modes:

```text
not_bound
replay_only
single_field
bounded_zone
multi_field_candidate
```

Initial readiness should prefer:

```text
single_field or bounded_zone
```

Field pilot risk must be bounded before execution authorization.

## Safety / Stop Rules

R5 must confirm safety / stop rules still valid.

Safety rule categories:

```text
manual stop authority
device / gateway uncertainty stop
evidence freshness stop
state confidence stop
forecast residual stop
health service degradation stop
weather / environment stop
human availability stop
communication loss stop
scope boundary violation stop
unexpected execution receipt stop
```

Stop rule object fields:

```text
stop_rule_id
name
trigger
severity
authority
effect
auto_execution
requires_human_ack
```

Stop rule effects:

```text
pause_readiness
block_execution
require_review
```

Stop rules may block readiness or require review, but R5 does not dispatch, pause machinery, or control equipment.

If future automatic stop control is required, it must enter a separate safety-control gate.

## Human Role Matrix

R5 must confirm human role matrix still valid.

Required roles:

```text
pilot_owner
field_operator
runtime_operator
safety_owner
agronomy_reviewer
device/gateway_operator
incident_responder
approval_authority
```

Role matrix fields:

```text
role_id
role_name
responsibility
decision_rights
required_before_pilot
required_during_pilot
required_for_stop
required_for_restart
contact_or_reference
coverage_status
```

Human roles approve readiness and stop conditions. Human roles do not authorize automatic dispatch inside R5. AO-ACT dispatch remains separately gated.

If role matrix is incomplete, readiness outcome cannot exceed:

```text
conditional_ready
```

## Execution Gating

R5 defines execution gating.

Execution remains gated:

```text
field pilot execution still gated
AO-ACT dispatch still separately gated
```

Future pilot execution requires:

```text
explicit pilot authorization packet
human approval
field scope binding
device/gateway verification
AO-ACT dispatch contract if execution uses AO-ACT
execution receipt contract
incident / stop protocol
post-run review protocol
```

R5 does not create these execution capabilities. R5 requires them to remain gated in the readiness decision.

## AO-ACT Boundary

AO-ACT dispatch remains separately gated.

R5 does not create AO-ACT task. R5 does not create AO-ACT receipt. R5 does not create dispatch command. R5 does not create execution schedule. R5 does not create work order. R5 does not create machine instruction.

If a future pilot uses AO-ACT, dispatch must pass a separate AO-ACT execution gate.

## ROI / Field Memory Boundary

R5 does not write ROI. R5 does not write Field Memory.

ROI and Field Memory may be reviewed after a separately authorized pilot run, but R5 does not create value records or long-term field records.

R5 does not claim pilot ROI computed. R5 does not claim pilot value recorded. R5 does not claim Field Memory learned. R5 does not claim long-term memory written. R5 does not calculate yield impact. R5 does not calculate profit impact.

## Readiness Packet

The readiness packet allows humans to review whether R1-R4 gates, safety rules, roles, and execution boundaries support controlled field pilot consideration.

Readiness packet fields:

```text
field_pilot_readiness_id
field_scope
as_of
R1 gate ref
R2 gate ref
R3 gate ref
R4 gate ref
safety / stop-rule summary
human role matrix summary
execution gating summary
open blockers
limitations
required human approvals
readiness outcome
nonclaims
```

Readiness decision object fields:

```text
field_pilot_readiness_id
tenant_id
project_id
field_scope
pilot_scope_mode
as_of
gate_refs
r1_evidence_stream
r2_state_estimation
r3_calibration_loop
r4_runtime_health_service_gate
status = passed | missing | failed | unknown
safety
stop_rules_valid
open_safety_blockers
roles
human_role_matrix_valid
required_roles
missing_roles
execution
pilot_execution_gated
ao_act_dispatch_separately_gated
automatic_start = false
dispatch_enabled = false
readiness
outcome
reasons
limitations
required_human_approvals
nonclaims
pilot_started = false
dispatch_enabled = false
ao_act_task_created = false
roi_written = false
field_memory_written = false
autonomous_operation = false
```

A readiness packet is not a pilot start command, not a dispatch command, and not an AO-ACT task.

## Incident / Rollback Readiness

R5 defines incident / rollback readiness, but does not execute rollback.

Incident / rollback fields:

```text
incident detection source
human contact path
manual stop path
device/gateway disconnect response
evidence stream failure response
health degradation response
rollback owner
post-incident review requirement
```

R5 does not implement automatic equipment stop. R5 does not implement automatic dispatch cancellation. R5 does not implement automatic field operation rollback.

If automatic rollback or equipment control is needed, it must be separately gated.

## Audit / Traceability

R5 defines audit / traceability requirements.

Readiness packet must reference:

```text
R1 evidence stream artifact
R2 state estimate artifact
R3 forecast/residual/calibration artifact
R4 health service gate artifact
safety rule artifact
human role matrix artifact
execution gating artifact
```

R5 readiness cannot be decided by verbal assertion alone.

## Versioning

Versioning fields:

```text
field_pilot_readiness_contract_version
safety_stop_rule_version
human_role_matrix_version
execution_gating_policy_version
input_r1_contract_version
input_r2_contract_version
input_r3_contract_version
input_r4_contract_version
```

Field pilot readiness cannot be replayed or audited unless gate, safety, role, and execution policies are versioned.

## R5 Nonclaims

R5 does not start pilot automatically. R5 does not dispatch. R5 does not create AO-ACT task. R5 does not write ROI. R5 does not write Field Memory. R5 does not update model. R5 does not create recommendations. R5 does not authorize autonomous operation. R5 does not claim production field operation. R5 does not bypass human approval.

## Acceptance

```powershell
node scripts/runtime_acceptance/ACCEPTANCE_R5_FIELD_PILOT_RUNTIME_READINESS_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

R5 acceptance is static repo read-only unless R5 implementation PR is separately scoped. It does not require frontend startup, backend startup, DB write, facts write, AO-ACT write, dispatch write, ROI write, Field Memory write, model update, Docker, server startup, web startup, or backend API.

## Post-R5 Boundary

R5 completion does not directly enter automatic execution.

After R5, any actual field pilot requires a separate gated task line:

```text
Pilot Execution Authorization
```

That line must require:

```text
explicit human approval
field scope binding
device/gateway verification
runtime health check at execution time
AO-ACT dispatch contract if execution uses AO-ACT
execution receipt contract
manual stop / incident protocol
post-run review
```

R5 only states whether controlled field pilot readiness criteria are defined and reviewable. R5 does not start pilot.
