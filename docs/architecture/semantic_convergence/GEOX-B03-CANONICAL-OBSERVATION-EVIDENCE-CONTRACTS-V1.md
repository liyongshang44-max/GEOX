# GEOX B-03 Canonical Observation + Evidence Qualification Contracts V1

## 0. Status and basis

Status: **B-line B-03 implementation candidate**

Stacked base:

```text
docs/bline-b02-semantic-ownership-register-v1
exact base head = ee5b611bf182e704cdba33757cbcaa1185db7cd2
B-02 status = COMPLETE on that exact head
```

Repository-level SSOT remains `docs/SSOT.md`.
Sprint / Tag / Freeze authority remains `README_MIGRATION.md`.

B-03 follows:

- `GEOX-BLINE-CHARTER-V1.md`;
- `GEOX-BLINE-CHARTER-V1-AMENDMENT-01-EVIDENCE-FIRST-SEQUENCE.md`;
- the B-02 machine-readable ownership/connectivity map.

B-03 is contract vocabulary only. It does not converge runtime ingress yet.

---

## 1. Purpose

B-03 creates one shared typed vocabulary for the question:

> What was observed, when was it available, what scope and source authority does it have, and for which semantic roles is it eligible?

It deliberately does **not** answer the later action-level question:

> Given all evidence and consequences, may this action proceed?

Therefore:

```text
Evidence Qualification != Decision Eligibility
```

An invalid or missing item may lose evidence authority without automatically producing an action-level `BLOCK`.

---

## 2. Contract implementation

Canonical contract module:

```text
apps/server/src/contracts/canonical_evidence_v1.ts
```

It defines:

```text
CanonicalObservationV1
EvidenceQualificationV1
EvidenceScopeV1
EvidenceRoleEligibilityV1
```

and typed vocabularies for:

```text
epistemic class
device transport health
measurement health
physical validity
temporal eligibility
source authority
spatial authority
conflict state
evidence presence
evidence authority
role eligibility
```

### 2.1 CanonicalObservationV1

The canonical Observation vocabulary includes:

```text
observation_id
source_fact_id
source_ref
scope
metric
unit
raw_value
canonical_value
observed_at
ingested_at
available_to_runtime_at
device_transport_health
measurement_health
physical_validity
temporal_eligibility
source_authority
spatial_authority
conflict_state
role_eligibility
limitations
reason_codes
epistemic_class
```

The raw fact/provenance remains visible even when an observation loses authority.

### 2.2 EvidenceQualificationV1

Evidence qualification records whether evidence is present and how its authority is bounded:

```text
qualification_id
observation_id | null
source_ref
metric
scope
evaluated_at
decision_time | null
presence
epistemic_class
physical_validity
temporal_eligibility
source_authority
spatial_authority
conflict_state
evidence_authority
role_eligibility
limitations
reason_codes
```

`presence = MISSING` is represented explicitly. It must not be repaired by fabricating an Observation ID or by declaring the missing item fully qualified.

---

## 3. Frozen contract distinctions

### Device health is not measurement health

A healthy transport path may carry an invalid measurement.

Example fixture:

```text
RSSI / battery / packet path = healthy
RH = 102.7 %
```

The valid contract state is:

```text
device_transport_health = GOOD
measurement_health = INVALID
physical_validity = FAIL
role_eligibility(PHYSICAL_STATE_INPUT) = INELIGIBLE
```

The raw `102.7` value remains retained as evidence of what the source reported.

### Observation is not fabricated fallback

The future canonical path must not perform:

```text
missing observation
-> default numeric value
-> OBSERVED
```

Explicit non-observed epistemic classes are available for estimates and derived values:

```text
ESTIMATED
MODEL_DERIVED
IMPUTED
ASSUMED
SIMULATED
LIMITED
UNKNOWN
```

`OBSERVED` requires source-fact provenance in this contract.

### Eligibility is role-specific

An evidence item is not simply globally "good" or "bad". It carries role-level eligibility.

This permits later runtime convergence to distinguish, for example, evidence that is retained for audit but ineligible for physical State, or evidence that is spatially limited and therefore usable only under an explicitly limited role.

---

## 4. Contract-level negative invariants

The schemas mechanically reject internally contradictory contract objects including:

```text
measurement INVALID + role ELIGIBLE
physical validity FAIL + role ELIGIBLE
stale/future/not-available evidence + role ELIGIBLE
unqualified source + role ELIGIBLE
out-of-scope evidence + role ELIGIBLE
unresolved/conflicting evidence + role ELIGIBLE
missing evidence + fabricated observation_id
missing evidence + evidence_authority QUALIFIED
missing evidence + role ELIGIBLE
failed qualification dimension + evidence_authority QUALIFIED
OBSERVED + missing source_fact_id
```

These are contract consistency checks only. B-03 does not contain a metric-range engine or infer that a particular raw number is invalid. Physical QC rules belong to B-04 evidence-runtime convergence.

---

## 5. Negative contract fixtures

Executable contract fixtures:

```text
apps/server/src/contracts/canonical_evidence_v1.contract.test.ts
```

Current fixture classes include:

```text
healthy device transport + RH 102.7% invalid measurement
invalid measurement attempting to retain physical-state authority
OBSERVED without source-fact provenance
missing observation represented explicitly without fabricated numeric evidence
missing evidence attempting to masquerade as qualified evidence
stale evidence attempting to remain fully qualified
spatially limited evidence retained as LIMITED rather than exact-scope truth
```

The test deliberately supplies already-classified qualification dimensions. It does not perform B-04 physical-range detection.

Run:

```text
pnpm --filter @geox/server exec node --import tsx --test src/contracts/canonical_evidence_v1.contract.test.ts
```

Equivalent repository-root command may use the workspace `tsx` installation.

---

## 6. B-03 non-effects

B-03 does not:

- change MQTT/API/raw-sample ingestion;
- change current Evidence Judge behavior;
- change Agronomy Judge behavior;
- rewire Judge routes;
- disable or modify Agronomy Agent;
- alter `DEFAULT_SOIL_MOISTURE` compatibility behavior;
- change Stage-1 evidence semantics;
- modify MCFT Evidence/State/Forecast/Scenario semantics;
- modify MCFT-CAP-09 production hosting or Formal stores;
- activate ADR;
- connect an LLM;
- create Decision Eligibility runtime;
- create approval or execution authority;
- modify database schemas or migrations;
- delete legacy code.

---

## 7. B-03 completion gate

B-03 may be marked COMPLETE only when one exact B-03 head satisfies:

```text
CanonicalObservationV1 typed contract          PASS
EvidenceQualificationV1 typed contract         PASS
Explicit epistemic classes                     PASS
Device Health != Measurement Health            PASS
Missing evidence non-fabrication invariant     PASS
Temporal/source/spatial/conflict vocabulary    PASS
Role-specific eligibility                      PASS
Negative contract fixtures                     PASS
Server typecheck                               PASS
Contract test                                  PASS
Exact-head general CI                          PASS
Existing MCFT governance/release lanes         PASS
Runtime rewiring                               NONE
MCFT semantic mutation                         NONE
```

B-03 completion does not mean ingress uses the contract. Runtime convergence begins in B-04.

---

## 8. Next frontier after B-03

Only after the B-03 exact-head gate is green:

```text
B-04 — Evidence Runtime convergence
```

Recommended order remains:

```text
B-04a metric catalog / physical QC
B-04b ingress qualification
B-04c sensing consumption guard
B-04d Stage-1 projection/consumer migration
B-04e Evidence Judge sufficiency facade
```

B-04 must preserve the distinction that evidence authority loss is not itself an action-level Decision Eligibility verdict.
