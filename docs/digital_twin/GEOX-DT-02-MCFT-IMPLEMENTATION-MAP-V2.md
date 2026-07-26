# GEOX DT-02 Minimum Complete Field Twin Implementation Map V2.4

Status: current SSOT after replay-dataset v2 prequalification exact-SHA effectiveness settlement  
Current effective slice: `MCFT-CAP-08.S4`  
Effective prequalification: `MCFT-CAP-08.S5-PQ / REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVE`  
Next authorized slice: `MCFT-CAP-08.S5`  
First legal next action: `MCFT_CAP_08_S5_FORMAL_CANDIDATE_FROM_EXACT_REQUALIFIED_MAIN`

## Current settlement

```text
prequalification subject SHA       b94d299851744f589d3c3a6e35111a22c17c79d0
workflow run                       30193754069
GitHub artifact                    8629453895
semantic artifact digest           sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55
R1 readback                        PASS
locked version delete denied       PASS
selected parameter                 0.034000
Candidate / Shadow writes          0 / 0
```

The repository status seed remains `PREQUALIFICATION_IMPLEMENTED_NOT_EFFECTIVE`; no post-merge status rewrite is allowed. External exact-SHA status plus immutable R1 artifact control effectiveness.

## Capability frontier

| Capability | Status | Next authority |
|---|---|---|
| `MCFT-CAP-08.S1`–`S4` | Effective | Historical exact-SHA artifacts retained |
| `MCFT-CAP-08.S5-PQ` | Effective external predecessor qualification | Authorizes formal S5 Candidate construction |
| `MCFT-CAP-08.S5` | Authorized, not implemented | Build one frozen exact-main Candidate; Candidate/Shadow writes only in formal S5 proof |
| `MCFT-CAP-08.S6` | Not authorized | Requires S5 exact-SHA effectiveness |
| `MCFT-CAP-09` | Not authorized | Requires CAP-08 closure |

## S5 Candidate boundary

```text
dataset                         mcft_cap08_stage1a_replay_v2
Residual count                  24
Calibration / Holdout           16 / 8
objective eligible cases        15
diagnostic-only case            R-10 / FVO-10
expected parameter              0.034000
sensitive regimes               HIGH_EXCESS, MID_EXCESS
predecessor subject             b94d299851744f589d3c3a6e35111a22c17c79d0
predecessor artifact digest     sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55
```

The Candidate may create exactly one Calibration Candidate and one paired Shadow Evaluation. It may not create Model Activation, change active Runtime Config, mutate State/checkpoint pointers, expose production Runtime routes, authorize S6, or authorize MCFT-CAP-09.

## Completion semantics

```text
S5 formal Candidate
-> S5 exact-SHA effectiveness
-> S6 two independent fresh-database formal runs
-> exact-head independent approval
-> R2 closure artifact
-> MCFT_CAP_08_COMPLETE
```
