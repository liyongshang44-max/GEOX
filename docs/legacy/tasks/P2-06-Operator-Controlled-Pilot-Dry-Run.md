# docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md

## Purpose

P2-06 completes the Real Adapter Integration preparation line with an operator-controlled pilot dry run.

This task proves that a pilot-shaped run can be executed only with an explicit human gate, after the negative runtime matrix passes, against a local loopback sandbox, with a deterministic dry-run report.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P2 Real Adapter Integration
P2-06 Operator-Controlled Pilot Dry Run
```

## Entry condition

```text
P2-00 complete.
P2-01 complete.
P2-02 complete.
P2-03 complete.
P2-04 complete.
P2-05 complete.
tag: p2_05_real_adapter_negative_runtime_matrix
next_step from P2-05: P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN
```

## Scope

```text
docs/controlplane/GEOX-CP-OperatorControlledPilotDryRun-v1.json
scripts/p2_sandbox/operator_controlled_pilot_dry_run.cjs
docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md
scripts/governance_acceptance/P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN.cjs
```

## Operator gate

```text
operator_id
operator_attestation
approval_ref_id
operation_plan_ref_id
act_task_ref_id
dry_run_only = true
human_gate = true
```

## Dry run target

```text
adapter_type: irrigation_http_v1
action_type: irrigate
target_device_id: sandbox-device-001
runtime: local_loopback_sandbox
effect: simulated_ack_only
```

## Dry run cases

```text
operator_gate_missing -> OPERATOR_GATE_REQUIRED
operator_gate_passed -> OPERATOR_GATE_ACCEPTED
negative_matrix_preflight -> MATRIX_PREFLIGHT_OK
sandbox_ack -> SANDBOX_ACK
no_live_side_effects -> NO_LIVE_SIDE_EFFECTS
```

## Boundary ledger

```text
dry_run_only = true
loopback_only = true
live_device_connected = false
broker_connected = false
geox_server_called = false
db_mutated = false
receipt_created = false
roi_created = false
field_memory_created = false
model_updated = false
```

## Direct command

```powershell
node scripts/p2_sandbox/operator_controlled_pilot_dry_run.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN.cjs
```

## Expected result

```text
ok = true
acceptance = P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN
pilot_manifest_verified = true
operator_gate_verified = true
pilot_dry_run_verified = true
dry_run_case_count = 5
failed_case_count = 0
no_live_adapter_started = true
next_step = P2_COMPLETION_REVIEW_BEFORE_P3
```
