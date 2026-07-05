# R4 Runtime Health Service Gate

## Phase

R4 Runtime Health Service Gate / R4 运行健康服务门禁.

## Purpose

R4 defines the contract-first runtime health readiness layer after R3.

R4 defines what must be true before GEOX can call runtime health a real service instead of local or replay-backed review metadata.

R4 separates review health, service health, live monitoring, production gateway, device evidence, and runtime freshness. These six concepts must not be mixed.

R4 does not implement a service daemon, endpoint, DB schema, live device connector, production gateway connector, pilot execution path, dispatch path, AO-ACT path, ROI path, Field Memory path, model update path, or UI surface.

## Preconditions

R1 Runtime Evidence Stream Readiness is available.
R2 Online State Estimation Loop is available.
R3 Forecast Calibration & Residual Loop is available.

R4 consumes R1/R2/R3 readiness signals.

R4 inputs:

```text
R1 evidence stream readiness
R2 state freshness / confidence
R3 forecast / residual / calibration review readiness
H62 Runtime Health Review frontend boundary
```

R4 provides health gate prerequisites for R5.

R5 Field Pilot Runtime Readiness must not skip R4.

## Non-goals

R4 does not claim production gateway online. R4 does not claim live device connected. R4 does not claim continuous live monitoring active. R4 does not start field pilot. R4 does not dispatch. R4 does not create AO-ACT task. R4 does not compute ROI. R4 does not write Field Memory. R4 does not update model. R4 does not create recommendations. R4 does not prove autonomous operation.

R4 can define what evidence would be required to make these claims later, but R4 does not make those claims in this contract-first PR.

## R1/R2/R3 Dependency

R4 consumes R1/R2/R3 readiness signals.

R1 provides evidence stream readiness, evidence freshness, source identity, subject identity, replay boundary, and state eligibility boundary.

R2 provides state estimate availability, state freshness, confidence / uncertainty, state read model, and state replay equivalence.

R3 provides forecast / residual / calibration review readiness, forecast freshness, residual status, and review packet boundary.

R4 aggregates these into a runtime health service gate. R4 does not rewrite R1 evidence, R2 state estimates, or R3 forecast/residual records.

## Review Health

Review Health is a read-only health review surface or metadata summary based on known/replay-backed runtime evidence.

Review Health may come from:

```text
frontend review surface
static metadata
replay-backed snapshot
read model availability
traceability readback
```

Review Health status values:

```text
available
partial
not_available
replay_only
unknown
```

Review Health cannot prove production gateway online.
Review Health cannot prove live device connected.
Review Health cannot prove continuous live monitoring active.
Review Health cannot prove field pilot active.

Review Health is not Service Health. A review surface can exist while the runtime service remains `contract_defined` or `not_enabled`.

## Service Health

Service Health is a runtime service-level readiness state derived from evidence freshness, source availability, processing cadence, read-model availability, replay equivalence, and health service checks.

Service Health requires:

```text
service identity
input evidence sources
freshness rules
health evaluation cadence
read model availability
failure modes
nonclaim boundary
```

Service Health status values:

```text
not_enabled
contract_defined
replay_validated
service_candidate
service_verified
degraded
unavailable
unknown
```

Definitions:

```text
not_enabled: no runtime health service exists
contract_defined: R4 contract exists, service not implemented
replay_validated: replay-backed health evaluation is reproducible
service_candidate: service exists in non-production/staging mode
service_verified: service has verified runtime health checks under declared evidence requirements
degraded: service exists but one or more required inputs are stale, missing, or invalid
unavailable: service cannot evaluate health
unknown: insufficient metadata
```

R4 contract PR default:

```text
service_health.status = contract_defined
```

Unless a later implementation provides evidence, R4 must not use `service_verified`.

## Live Monitoring

Live Monitoring is continuous runtime observation over live_verified evidence sources with current freshness and service health.

Live Monitoring requirements:

```text
source_mode = live_verified
device evidence package current
gateway evidence package current
runtime freshness current
health evaluation cadence active
health service status service_verified
monitoring window current
no replay-only substitution
```

R4 defines live monitoring eligibility but does not claim live monitoring is active.

Allowed R4 statement:

```text
live monitoring requirements are defined
live monitoring is not active under R4 contract-only gate
```

R4 default:

```text
live_monitoring.eligible = false
live_monitoring.active = false
```

Eligible means all required evidence/service conditions are satisfied. Active means a runtime monitoring service is currently running under declared cadence.

## Production Gateway

Production Gateway is a verified runtime gateway path that accepts live evidence from real device/source infrastructure into the runtime evidence stream.

Gateway evidence fields:

```text
gateway_id
gateway_version
gateway_mode
deployment_environment
last_seen_at
last_accepted_packet_at
last_rejected_packet_at
source_identity_binding
device_identity_binding
clock_sync_status
duplicate_policy_status
ingestion_status
freshness_status
evidence_package_ref
```

Gateway modes:

```text
replay_demo
staging_candidate
production_candidate
production_verified
```

Gateway status values:

```text
missing
partial
replay_demo
staging_candidate
production_candidate
production_verified
invalid
unknown
```

replay_demo cannot support production gateway online claim.
production_candidate cannot support production online claim without verification.
production_verified requires current evidence package and health evaluation.
gateway status must be evidence-backed.
gateway status must not be inferred from UI route availability.

## Device Evidence

Device Evidence proves device/source identity, observed data path, time semantics, and ingestion relation.

Device Evidence Package required fields:

```text
device_id
device_kind
source_id
source_mode
subject_ref
firmware_or_source_version
observed_at
last_seen_at
last_payload_ref
clock_status
identity_binding_status
measurement_kind
accepted_evidence_refs
rejected_evidence_refs
freshness_status
```

Device status values:

```text
missing
partial
replay_only
current
verified
invalid
unknown
```

Device evidence rules:

```text
device evidence must bind source identity to subject identity
device evidence must include timestamp semantics
device evidence must not rely only on frontend display
device evidence must be linked to accepted/rejected evidence refs
device evidence must distinguish replay_only from live_verified
```

Device Evidence Package cannot be proven by UI copy alone. It must be linked to evidence stream, gateway evidence, source registry, or replay package.

## Runtime Freshness

Runtime Freshness is a service-level freshness state derived from evidence freshness, state estimate freshness, forecast verification freshness, gateway/device freshness, and health evaluation cadence.

Freshness layers:

```text
evidence freshness from R1
state freshness from R2
forecast/residual freshness from R3
device freshness
gateway freshness
health service evaluation freshness
```

Runtime freshness status values:

```text
current
late
stale
partial
missing
invalid
replay_only
unknown
```

Freshness does not imply live monitoring active unless live_verified conditions are satisfied.

## Runtime Health Service Gate Object

R4 defines Runtime Health Service Gate Object.

Minimum object fields:

```text
runtime_health_gate_id
tenant_id
project_id
subject_ref
gate_mode
as_of
review_health
service_health
runtime_freshness
device_evidence
gateway_evidence
live_monitoring
nonclaims
```

Gate mode values:

```text
contract_defined
replay_validated
service_candidate
service_verified
```

Object semantics:

```text
review_health.status = available | partial | not_available | replay_only | unknown
service_health.status = not_enabled | contract_defined | replay_validated | service_candidate | service_verified | degraded | unavailable | unknown
runtime_freshness.status = current | late | stale | partial | missing | invalid | replay_only | unknown
device_evidence.status = missing | partial | replay_only | current | verified | unknown
gateway_evidence.status = missing | partial | replay_demo | staging_candidate | production_candidate | production_verified | unknown
live_monitoring.eligible = false
live_monitoring.active = false
```

The default R4 contract object is contract_defined and nonclaim-bound.

## Health Freshness Model

Health freshness inputs:

```text
R1 evidence freshness
R2 state freshness
R3 forecast/residual freshness
gateway evidence freshness
device evidence freshness
health evaluation freshness
```

Health freshness fields:

```text
as_of
last_evidence_at
last_state_estimated_at
last_forecast_verified_at
last_gateway_seen_at
last_device_seen_at
last_health_evaluated_at
max_allowed_health_staleness_ms
freshness_status
freshness_reasons
```

Health freshness status values:

```text
current
late
stale
partial
missing
invalid
replay_only
unknown
```

Freshness rules:

```text
current requires current evidence/state/service evaluation under declared cadence
partial means some required inputs are fresh and others missing/stale
replay_only means freshness is derived from replay-backed data only
stale means latest required input exceeds max staleness
missing means required input is absent
invalid means required input exists but fails validation
unknown means source metadata is insufficient
```

## Service Health Model

Service health inputs:

```text
evidence stream availability
state estimate availability
forecast/residual availability
read model availability
gateway/device evidence status
freshness status
evaluation cadence
failure mode register
```

Service status values:

```text
not_enabled
contract_defined
replay_validated
service_candidate
service_verified
degraded
unavailable
unknown
```

R4 contract PR default remains:

```text
service_health.status = contract_defined
```

Health service decisions are not replayable unless inputs and policies are versioned.

## Device Evidence Requirements

Device evidence required fields:

```text
device_id
device_kind
source_id
source_mode
subject_ref
firmware_or_source_version
last_seen_at
last_payload_ref
clock_status
identity_binding_status
measurement_kind
accepted_evidence_refs
rejected_evidence_refs
freshness_status
```

Device status values:

```text
missing
partial
replay_only
current
verified
invalid
unknown
```

Device evidence must distinguish replay_only from live_verified.

## Gateway Evidence Requirements

Gateway evidence required fields:

```text
gateway_id
gateway_version
gateway_mode
deployment_environment
last_seen_at
last_accepted_packet_at
last_rejected_packet_at
source_identity_binding
device_identity_binding
clock_sync_status
duplicate_policy_status
ingestion_status
freshness_status
evidence_package_ref
```

Gateway status values:

```text
missing
partial
replay_demo
staging_candidate
production_candidate
production_verified
invalid
unknown
```

replay_demo cannot support production gateway online claim.

## Live Monitoring Eligibility

Live monitoring eligible requires:

```text
source_mode = live_verified
R2 state estimates current or partial under declared cadence
R3 forecast/residual loop available if required by pilot scope
device evidence status = verified or current under declared rule
gateway evidence status = production_verified
service health status = service_verified
runtime freshness status = current or declared acceptable partial
health evaluation cadence active
```

R4 default:

```text
live_monitoring.eligible = false
live_monitoring.active = false
```

R4 defines live monitoring eligibility but does not claim live monitoring is active.

## Failure Modes

Health failure modes:

```text
missing_evidence_stream
stale_evidence_stream
missing_state_estimate
stale_state_estimate
missing_forecast_residual
stale_forecast_residual
missing_device_evidence
stale_device_evidence
missing_gateway_evidence
stale_gateway_evidence
gateway_replay_only
device_replay_only
clock_sync_unknown
duplicate_policy_unknown
read_model_unavailable
health_evaluation_overdue
service_not_enabled
```

Failure mode does not automatically trigger dispatch or recommendation.

## Health Read Model

Health read model fields:

```text
runtime_health_gate_id
subject_ref
as_of
review_health.status
service_health.status
runtime_freshness.status
device_evidence.status
gateway_evidence.status
live_monitoring.eligible
live_monitoring.active
failure_modes
evidence_refs
nonclaims
```

Health read model must not expose recommendation, action, dispatch command, AO-ACT task, ROI impact, Field Memory write, model update applied, pilot start command, or production online claim without evidence.

## Versioning

Versioning fields:

```text
runtime_health_gate_contract_version
health_evaluation_policy_version
device_evidence_contract_version
gateway_evidence_contract_version
freshness_policy_version
input_evidence_contract_version
input_state_contract_version
input_forecast_contract_version
```

Health service gate decisions are not replayable unless evidence, state, forecast, device, gateway, and freshness policies are versioned.

## R4 Nonclaims

R4 does not claim production gateway online. R4 does not claim live device connected. R4 does not claim continuous live monitoring active. R4 does not start field pilot. R4 does not dispatch. R4 does not create AO-ACT task. R4 does not compute ROI. R4 does not write Field Memory. R4 does not update model. R4 does not create recommendations. R4 does not prove autonomous operation.

## Acceptance

```powershell
node scripts/runtime_acceptance/ACCEPTANCE_R4_RUNTIME_HEALTH_SERVICE_GATE_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

R4 acceptance is static repo read-only unless R4 implementation PR is separately scoped. It does not require frontend startup, backend startup, DB write, facts write, AO-ACT write, dispatch write, ROI write, Field Memory write, model update, Docker, server startup, web startup, or backend API.

## R5 Handoff

R5 Field Pilot Runtime Readiness follows R4.

R4 provides health gate prerequisites for R5.

R5 evaluates whether R1 evidence stream, R2 state estimation, R3 forecast/residual loop, and R4 runtime health service gate are sufficient to support controlled field pilot readiness.

R4 does not start field pilot. R4 only provides the runtime health gate before field pilot readiness.
