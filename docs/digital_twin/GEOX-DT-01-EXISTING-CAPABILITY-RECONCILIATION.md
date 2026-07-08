<!-- docs/digital_twin/GEOX-DT-01-EXISTING-CAPABILITY-RECONCILIATION.md -->
# DT-01 Existing Capability Reconciliation

## 0. Baseline

```text
repository: liyongshang44-max/GEOX
branch baseline: main
commit: bce918d1eea423397bdd329148b7a2e7eb181b6c
meaning: DT-00 Mainline Governance Reset merged
```

## 1. Result

The repository contains substantial governed evidence, decision, action, read-model, ROI, and Field Memory infrastructure. It does not contain a persistent continuously advancing Minimum Complete Field Twin.

The detailed inventory contains:

```text
55 mandatory capabilities
69 reviewed components
6 reuse decisions
10 explicit MISSING runtime capabilities
```

## 2. Highest-level findings

### Established foundations

```text
append-only facts and live telemetry ingress
tenant/project/group/field/zone scope controls
provenance and evidence refs
deterministic hash patterns
server-side approval, operation-plan, AO-ACT task and receipt paths
acceptance and outcome-evidence routes
ROI and Field Memory server/database modules
canonical Operator Field Runtime route shell
```

### Established with limitations

```text
root-zone pure builders
root-zone latest indexes
controlled P31/P42/P43/P44 gates
P50 deterministic replay demo
P57 replay-backed freeze package
Operator State/Forecast/Scenario/Residual/Calibration tabs
model candidate/shadow/activation governance
```

### Missing

```text
hourly tick orchestrator
prior-to-prediction physical propagation
observation assimilation
canonical posterior history
process uncertainty propagation
observation uncertainty model
canonical checkpoint
restart/backfill recovery
late-evidence immutable revision
continuous +1h through +72h forecast regeneration
```

## 3. water_state_estimate_v1

The component:

```text
reads sensingWindow.summary.last_value
assigns it to root_zone_soil_moisture_percent
uses fixed threshold classification
appends a derived fact
upserts water_state_estimate_index_v1
```

Repository search found no runtime caller outside its defining file for:

```text
buildWaterStateEstimateV1
ingestWaterStateEstimateV1
getLatestWaterStateEstimateIndexV1
```

Decision:

```text
threshold/state semantics: REPLACE
append-before-index pattern: REUSE_WITH_ADAPTER
latest index pattern: REUSE_WITH_ADAPTER
unwired legacy integration path: DEPRECATE registration only
```

The append-only fact is historical evidence, but it is not a canonical MCFT posterior State.

## 4. Root-zone builders

### State builder

Retain as-is:

```text
scope validation
duplicate ID/depth rejection
stable deterministic hashing
```

Extract:

```text
weighted matric potential
weighted available-water fraction
layer weighting and blocking rules
```

Replace as canonical State:

```text
current aggregate payload lacks prior, propagation, observation update,
posterior uncertainty, revision, and previous-posterior semantics
```

### Forecast builder

Extract:

```text
crop ET = ET0 * Kc
effective precipitation
bounded root-zone storage
water-status thresholds
```

Replace:

```text
7 daily points
daily contract
no hourly uncertainty trajectory
```

MCFT requires exactly `+1h` through `+72h`.

### Scenario builder

Extract/adapt:

```text
fixed irrigation options
application-efficiency semantics
baseline difference
trajectory comparison
```

It remains a scenario builder, not a recommendation or approval engine.

## 5. P31 through P57

```text
P31: controlled script with optional DB fact write; not a daemon or physical estimator
P42: one-shot controlled forecast record gate; acceptance-output persistence
P43: one-shot controlled residual gate; ledger-only persistence
P49: evidence/freeze package; REFERENCE_ONLY
P50: historical deterministic replay demo
P57: replay-backed freeze/claim package; REFERENCE_ONLY
```

P50 component decisions:

```text
explicit replay clock: REUSE_WITH_ADAPTER
evidence partition: REUSE_WITH_ADAPTER
no-future-leakage invariant: REUSE_AS_IS
trace packet structure: REUSE_WITH_ADAPTER
average-value state estimator: REPLACE
linear demo forecast: REPLACE
mechanical shadow evaluation: REPLACE
acceptance-output persistence: REPLACE
demo namespace: REFERENCE_ONLY
```

## 6. Operator Field Runtime

The canonical route family is:

```text
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/state
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
```

The shell, route ownership, nonclaims, loading/error behavior, and adapter boundary are reusable.

The current tab content does not prove:

```text
numeric prior/posterior State
72 hourly forecast points
target-time residual runtime
continuous calibration runtime
live monitoring
```

Legacy `/operator/twin/*` and `/app/operator/*/evidence-twin` paths require compatibility inventory and later deprecation, not immediate deletion.

## 7. Decision and action chain

Actual repository paths exist for:

```text
recommendation candidate
policy evaluation
approval request/decision
operation plan
AO-ACT preflight
AO-ACT task server persistence
AO-ACT receipt
formal acceptance
outcome evidence
```

These paths are request-driven server capabilities. They are not yet bound to a canonical MCFT State/Forecast/Scenario chain.

Mandatory distinctions remain:

```text
task created != dispatched
dispatch != execution
receipt != validation
validation != causal effect
outcome evidence != ROI
```

## 8. ROI and Field Memory

ROI and Field Memory are not merely documents. They have server routes, services/modules, and database-backed read/write behavior.

DT-01 decision:

```text
existing governance/server/database core: REUSE_WITH_ADAPTER for CAT
controlled gates and negative policies: REFERENCE_ONLY
MCFT runtime use: deferred
automatic learning: NOT ESTABLISHED
```

## 9. DT-02 consequence

DT-02 must not start from zero. It should preserve:

```text
facts/provenance/scope
deterministic pure-domain patterns
latest-index pattern as read index only
Operator canonical route shell
approval/action/receipt boundaries
ROI/Field Memory governance boundaries
P50 explicit clock and no-future-leakage pattern
```

It must replace or newly define:

```text
canonical state-transition atomicity
posterior history
tick transaction
checkpoint and recovery
late-evidence revisions
72-hour point persistence
scenario persistence
model registry/activation consumption
API naming and legacy compatibility
```

## 10. Nonclaim

No new Twin runtime capability is implemented or claimed by DT-01.
