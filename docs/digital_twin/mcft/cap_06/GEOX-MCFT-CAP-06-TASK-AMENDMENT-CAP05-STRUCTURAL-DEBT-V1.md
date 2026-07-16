<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-AMENDMENT-CAP05-STRUCTURAL-DEBT-V1.md -->

# MCFT-CAP-06 Task Amendment — CAP-05 Structural Debt Stabilization

```text
amendment_id:
MCFT-CAP-06.TASK-AMENDMENT.CAP05-STRUCTURAL-DEBT-V1

status:
EFFECTIVE_WITH_S3_EFFECTIVENESS_WRITEBACK

base_task_ref:
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md

superseded_order:
S3 -> S5

amended_order:
S3 -> S4 PREDECESSOR CONSUMPTION STABILIZATION -> S5
```

## 1. Amendment decision

The original task line omitted the conditional S4 Config slice and expected S5 to follow S3 directly. Repository evidence now shows that three CAP-05 structural debts would enter the production path at S5:

```text
1. CAP-05 to CAP-04 execution Config recovery uses subtractive field removal.
2. CAP-05 exposes canonical objects but no reusable read-only cross-object graph assembler.
3. CAP-05 historical closure and post-closure Runtime conformance remain separate machine authorities.
```

A fourth process debt is also material:

```text
component acceptance has historically preceded formal production composition acceptance.
```

These are not missing out-of-scope CAP-05 features. They are successor-consumption and proof-topology costs attached to capabilities CAP-05 already claims.

## 2. New mandatory Slice

The following Slice is inserted after S3 effectiveness and before S5:

```text
MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1
```

Contract:

```text
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-PREDECESSOR-CONSUMPTION-STABILIZATION.md
```

Debt register:

```text
docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json
```

## 3. Authority effect

After S3 effectiveness:

```text
S4:
AUTHORIZED_NOT_STARTED

S5:
BLOCKED_PENDING_S4_EFFECTIVENESS

S6 and downstream:
BLOCKED
```

This amendment does not reopen CAP-05 closure. It does not revoke the CAP-05 post-closure Runtime conformance remediation. It adds a bounded successor-consumption stabilization Slice inside MCFT-CAP-06.

## 4. Scope split

S4 must pay down only the debt that would directly affect MCFT-CAP-06 production composition:

```text
positive CAP-04 execution field projection
reusable non-canonical exact-ref graph assembler
CAP-05 effective runtime baseline aggregate pointer
four-layer composition acceptance topology
```

The following long-term redesign is registered but deferred:

```text
nest CAP-04 execution payload and CAP-05 feedback policy as explicit subobjects
```

It is not authorized during MCFT-CAP-06 because it would alter a completed predecessor contract and create unnecessary migration risk.

## 5. Preserved boundaries

```text
NO_NEW_CANONICAL_TYPE
NO_MIGRATION_IN_S4
NO_CALIBRATION_MATH_CHANGE
NO_SHADOW_MATH_CHANGE
NO_CANDIDATE_APPEND_IN_S4
NO_EVALUATION_APPEND_IN_S4
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_STATE_OR_CHECKPOINT_MUTATION
NO_PUBLIC_ROUTE
NO_WEB
NO_SCHEDULER
NO_MCFT_CAP_07_AUTHORIZATION
```
