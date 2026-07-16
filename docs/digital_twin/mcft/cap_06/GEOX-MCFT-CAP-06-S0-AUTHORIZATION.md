<!-- docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-AUTHORIZATION.md -->
# GEOX MCFT-CAP-06 S0 v2 Authorization and Qualification Candidate

## Authority

```text
authorization_id:
MCFT-CAP-06-S0-AUTHORIZATION-V2

delivery_slice_id:
MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1

baseline_main_commit:
ca819ba51bdf3017dbefa96015f76bd3b66a647c

status:
READY_FOR_MERGE_CANDIDATE

authorization_effective:
false

runtime_source_authorized:
false

migration_authorized:
false

canonical_write_authorized:
false

active_delivery_slice_id:
null
```

This record is a candidate. It becomes effective only after PR #2509 is merged to `main` and an exact merged-main S0 Authorization Gate passes against the merge commit.

## Supersession

PR #2500 is closed without merge and is superseded. S0 v2 does not reuse its local shallow hash implementation or its incomplete dataset-eligibility rule.

S0 v2 uses the repository canonical recursive authority:

```text
semanticHashV1
```

It separately preserves:

```text
Forecast-time Runtime Config
Residual-time Runtime Config
```

The two Config refs are not required to be identical. Each Config ref/hash edge must close against its own canonical object and validator.

## Exact formal proof

```text
proof commit:
d3c5341707b35982df84ce63e8aef310ce304b31

workflow run:
29469336992

exact source identity:
PASS

server typecheck:
PASS

pure dual-Config graph acceptance:
11 PASS / 0 FAIL

formal CAP-05 PostgreSQL reconstruction:
7 PASS / 0 FAIL

S0 repository-history qualification:
6 PASS / 0 FAIL

proof orchestrator:
2 PASS / 0 FAIL
```

The proof reconstructs the formal CAP-05 terminal chain from checkpoint `72` to checkpoint `80`, verifies restart recovery with zero duplicate canonical writes, and then qualifies the exact Residual closure.

The source graph is resolved from two authorities without conflation:

```text
canonical objects:
PostgreSQL facts

Forecast forcing Evidence:
formal runner normalized Replay source
```

The two required forcing Evidence records are exposed only through a session-local PostgreSQL temporary view. `public.facts` remains unchanged at `339` rows before and after qualification. The temporary view, Replay root, temporary runner source and isolated database are all removed by the proof orchestrator.

## Predecessor lock

```text
checkpoint:
twin_runtime_checkpoint_94044fb0a8fa953db55fb8e0

checkpoint hash:
sha256:828bbc905cde5cc17a2e0493280e758d9833774c648ff3919be64e85e31a1e58

checkpoint sequence:
80

latest logical time:
2026-06-04T09:00:00.000Z

next logical tick:
2026-06-04T10:00:00.000Z

reproduced canonical State facts:
33
```

The historical S10 value `81` remains preserved as the orchestrator canonical-object fact delta. It is not treated as the canonical State count.

## Dataset qualification

```text
case graph validation:
PASS

eligible canonical Residuals:
1

required matched cases:
24

calibration cases:
0 / 16

holdout cases:
0 / 8

dataset qualification:
INSUFFICIENT_MATCHED_PAIRS
```

The one eligible case closes the complete graph:

```text
Residual
Forecast
H1 Forecast point
source posterior State
Forecast Evidence Window
Observation Evidence
Forecast-time Runtime Config
Residual-time Runtime Config
weather forcing Evidence
ET0 forcing Evidence
crop-stage context
root-zone geometry
numeric policy
observation operator
```

All six homogeneity cardinalities are exactly one:

```text
model component
parameter bundle
observation operator
geometry
runtime numeric policy
Residual matching/projection policy
```

No legal excluded case exists in the current repository history. The result is insufficient because the history contains one eligible case, not because the graph is invalid.

## Candidate boundary

Before merged-main effectiveness:

```text
next_authorized_slice_ids:
[]
```

After S0 v2 merged-main effectiveness, only the following slice may become eligible:

```text
MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1
```

That future authorization is limited to constructing and qualifying the controlled 24-case Residual window. It does not authorize Calibration Candidate, Shadow Evaluation or Model Activation.

## Preserved nonclaims

S0 v2 grants none of the following:

```text
CAP-06 Runtime source authority before effectiveness
migration authority
canonical write authority
Residual creation by S0
Calibration Candidate
Shadow Evaluation
Model Activation
active Config switch
active Config index
automatic parameter update
State mutation
checkpoint mutation
public route
Web path
scheduler
shadow-online claim
field-calibration claim
MCFT-CAP-07 authority
capability completion
```
