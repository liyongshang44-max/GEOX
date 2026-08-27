# GEOX B-04b3 MQTT Ingress Convergence V1

## 0. Status and exact base

Status: **B-line B-04b3 implementation candidate**

Exact stacked base:

```text
B-04b2 COMPLETE
7cbd3b7489b5474b0469ea69fa220f033ea2ca20
```

B-04b3 exists because the B-04b2 post-gate audit found that GEOX has more than one active telemetry ingress implementation.

The commercial compose includes the dedicated `telemetry-ingest` service, implemented by:

```text
apps/telemetry-ingest/src/main.ts
```

That path must obey the same source-evidence semantics as the server-side ingress service before B-04b can be considered converged.

---

## 1. Audit finding: transport adapter was rewriting source authority

Before B-04b3, the MQTT adapter called `normalizeMetricAndUnit` before the shared observation writer.

For a catalogued metric with an unsupported unit, that helper replaced the supplied unit with the catalog canonical unit.

Example:

```text
MQTT source:
air_temperature = 72 °F

pre-B-04b3 adapter output:
air_temperature = 72 °C
```

No numeric Fahrenheit-to-Celsius conversion occurred.

That is not a harmless representation change. It destroys the distinction between:

```text
what the source actually supplied
```

and

```text
what the compatibility layer prefers to expose
```

B-04b3 therefore removes canonicalization from the MQTT -> observation authority boundary.

---

## 2. Current observation-service contract drift

The same audit found that `apps/telemetry-ingest/src/main.ts` was still calling the shared observation writer with an older input shape:

```text
value_num
value_text
raw_fact_id
source_kind
...
```

while the current shared service expects:

```text
value
unit
source_fact_id
source_lane
formal_eligible
evidence_level
...
```

B-04b3 introduces one pure transport mapper:

```text
apps/telemetry-ingest/src/mqtt_observation_input_v1.ts
```

Its only job is to carry MQTT source semantics into the current observation-service contract without inventing a canonical measurement.

---

## 3. Source-preserving boundary

For telemetry messages the MQTT path now forwards:

```text
source metric
source value
source unit
source fact id
event time
device/field/tenant scope
```

directly to the shared observation writer.

The shared B-04a/B-04b1 evidence path is then responsible for:

```text
metric canonicalization
unit qualification
hard physical QC
source-preserving ingress snapshot
```

Normative ownership:

```text
MQTT transport != measurement authority
```

---

## 4. Raw fact preservation

The MQTT raw telemetry fact now records the source-supplied unit explicitly:

```text
raw_telemetry_v1.payload.unit
```

This is required so replay/audit can inspect the original unit independently from downstream compatibility projection.

---

## 5. Heartbeat separation

Pre-B-04b3 code called the observation pipeline after both telemetry and heartbeat messages.

A heartbeat is device transport/runtime evidence, not a physical measurement.

B-04b3 restricts the measurement observation pipeline call to:

```text
parsed.kind === telemetry
```

This reinforces:

```text
Device Transport Health != Measurement Health
```

Heartbeat handling remains outside measurement qualification.

---

## 6. Tests

New pure fixtures:

```text
apps/telemetry-ingest/src/mqtt_observation_input_v1.test.ts
```

They prove:

```text
72 °F remains 72 °F at the shared observation boundary
RH 102.7 remains exactly 102.7 %RH for shared physical QC
null source value remains null
source fact id is preserved
formal/source-lane metadata is explicit
```

B-04b3 must also typecheck the `@geox/telemetry-ingest` application itself. Server-only typecheck is insufficient because the earlier contract drift was hidden outside the server TypeScript target.

---

## 7. Newly exposed packaging blocker

The audit also found a separate production-hosting defect:

```text
apps/telemetry-ingest/package.json
build = node -e "process.exit(0)"
```

while commercial compose starts:

```text
node apps/telemetry-ingest/dist/main.js
```

and the repository contains no tracked `apps/telemetry-ingest/dist/main.js`.

B-04b3 does not silently claim that this packaging defect is repaired unless a clean runtime-build probe proves the service artifact exists and starts.

If the source-semantics changes pass but the clean package/runtime probe fails, B-04b3 remains incomplete or the packaging repair must be split into B-04b4.

---

## 8. Remaining missing/non-numeric durability boundary

The dedicated MQTT service still owns its own outer transaction.

Therefore B-04b2's server-side durable-raw exception does not automatically prove MQTT raw durability for null/non-numeric telemetry.

B-04b3 does not overclaim this.

Before B-04b overall can be COMPLETE, one exact head must prove across the active MQTT service that:

```text
missing/non-numeric source payload remains auditable
no numeric observation is fabricated
source unit is preserved
heartbeat does not become measurement truth
runtime packaging actually starts the service
```

---

## 9. Explicit non-effects

B-04b3 does not:

- change physical hard bounds;
- make invalid evidence eligible;
- change Stage-1 latest-finite consumption yet;
- alter Evidence Judge/Agronomy Judge;
- alter Agronomy Agent;
- alter MCFT semantics;
- create Decision Eligibility;
- alter Approval/AO-ACT/Receipt/Acceptance authority.

---

## 10. Completion gate

B-04b3 may be COMPLETE only when one exact head proves:

```text
MQTT source metric preserved                         PASS
MQTT source value preserved                          PASS
MQTT source unit preserved                           PASS
raw telemetry fact records source unit              PASS
current observation-service input contract used      PASS
heartbeat excluded from measurement pipeline         PASS
telemetry-ingest TypeScript typecheck                 PASS
MQTT mapper fixtures                                  PASS
B-04a/B-04b1/B-04b2 regressions                       PASS
B-02 semantic linter                                  PASS
general CI                                            PASS
existing MCFT governance/release lanes                PASS
```

Packaging and MQTT missing/non-numeric durability remain explicit blockers unless separately proven on the same head.

---

## 11. Next frontier

Do not authorize B-04c until the active MQTT ingress path is fully converged.

Likely continuation:

```text
B-04b4 — telemetry-ingest runtime packaging + durable degraded payload retention
```

Only after that:

```text
B-04c — Stage-1 consumption guard
```
