# GEOX B-Line Agronomy Agent Fail-Closed Authority V1

## Status

Status: **AUTHORIZED IMPLEMENTATION / P0-RES-003 CLOSURE**

Exact stacked base:

```text
#3451 Fertilization execution-provenance closure head
4871b872b2e38a52b9a5ee63e6dfe85b63ca7ac8
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package closes the active commercial Agronomy Agent authority defect recorded as `P0-RES-003`.

## Runtime activation

The Agronomy Agent is not an inert helper.

Commercial runtime activation is:

```text
docker-compose.commercial_v1.yml
  -> jobs service
  -> node apps/server/dist/jobs/runtime.js
  -> AGRONOMY_AGENT_ENABLED=1
  -> runAgronomyAgentOnce(...)
  -> apps/server/src/jobs/agronomy_agent.ts
```

The active-runtime authority graph must represent this background-worker chain explicitly. HTTP/module registration is not sufficient runtime-activation coverage.

## Missing telemetry is UNKNOWN

Missing soil-moisture telemetry must remain missing.

Forbidden:

```text
missing telemetry
  -> implementation default
  -> numeric soil_moisture
  -> agronomy recommendation
  -> decision recommendation
  -> OperationPlan
```

In particular, no `DEFAULT_SOIL_MOISTURE` or equivalent numeric fallback may enter rule evaluation.

If the selected field has no finite soil-moisture value or no immutable telemetry source fact identity:

```text
skipped:no_telemetry
recommendation writes = 0
decision writes = 0
OperationPlan writes = 0
```

## Exact telemetry provenance

The legacy Agent may use the existing latest telemetry projection to choose the field's observation under its existing temporal behavior.

That temporal choice must freeze the immutable selected source identity:

```text
telemetry_index_v1.fact_id
```

The telemetry ingest path already binds `telemetry_index_v1.fact_id` to the raw telemetry fact identity. No schema change is required.

The Agent's retained legacy recommendation signal must include the exact telemetry fact id in provenance. A string such as `telemetry:soil_moisture` is not an exact evidence identity.

This package does not invent a telemetry freshness threshold. No product freshness authority is currently frozen for this Agent.

## Recommendation authority

The Agronomy Agent may retain `recommendation_v1` only as a legacy agronomy signal.

It must be explicitly non-executable:

```text
authority_mode = LEGACY_AGRONOMY_SIGNAL_ONLY
human_approval_required = true
no_direct_execution = true
approval_created = false
operation_plan_created = false
task_created = false
dispatch_created = false
```

The Agent must not write `decision_recommendation_v1`.

Reason:

- the current B09Y Candidate boundary does not accept `source=jobs/agronomy_agent`;
- the canonical operator approval candidate contract does not accept the Agent's legacy recommendation shape;
- broadening either contract here would create new decision authority rather than remove legacy authority.

No new Candidate adapter is authorized in this package.

## OperationPlan authority

The Agent must not write:

```text
operation_plan_v1
operation_plan_transition_v1
agronomy_agent_auto_create
```

OperationPlan creation remains downstream of governed approval/plan boundaries.

The Agent may read existing pending OperationPlans for compatibility/deduplication. Read-side compatibility does not grant Plan write authority.

## Background runtime audit closure

The active-runtime registry must include:

```text
apps/server/src/jobs/runtime.ts
apps/server/src/jobs/agronomy_agent.ts
```

with exact activation edges from commercial compose through the jobs worker.

The machine closure gate must prove the background chain rather than relying only on `registerDomainModules.ts`.

## Non-effects

This package does not:

- change MCFT implementation or ownership;
- change telemetry ingest schema;
- invent freshness policy;
- create EvidenceQualification from raw telemetry;
- create a new CandidateDecision adapter;
- widen B09Y source acceptance;
- widen Approval candidate acceptance;
- change AO-ACT Task/Receipt/Acceptance execution runtime.

## Completion

P0-RES-003 may be closed only when one exact head proves:

```text
commercial background activation graph registered PASS
DEFAULT_SOIL_MOISTURE absent PASS
missing telemetry creates zero semantic output PASS
exact telemetry fact provenance retained PASS
Agronomy Agent decision_recommendation_v1 writes = 0 PASS
Agronomy Agent OperationPlan/transition writes = 0 PASS
legacy recommendation_v1 is non-executable signal only PASS
Typecheck / Build / Server selfcheck PASS
dedicated runtime proof PASS
full acceptance PASS
Controlled Pilot / Commercial MVP0 PASS
MCFT implementation delta 0
```
