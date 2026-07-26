# GEOX DT-02 Minimum Complete Field Twin Implementation Map V2.5

Status: current SSOT after MCFT-CAP-08.S5 exact-SHA effectiveness settlement
Current effective slice: `MCFT-CAP-08.S5`
Current effective status: `S5_RESIDUAL_CALIBRATION_SHADOW_IMPLEMENTED_EFFECTIVE`
Next authorized slice: `MCFT-CAP-08.S6`
First legal next action: `MCFT_CAP_08_S6_FORMAL_CANDIDATE_FROM_EXACT_S5_EFFECTIVE_MAIN`

## Exact S5 authority

```text
merge subject SHA                  1a5d2bb501ada9b6048a7af07b48f89a9dbeaf30
candidate head                     2cd307ab6b427eb889e7007f0aaa6e95581252bc
candidate / merge tree             d695db893ad013da404d2818e3730e43fa1c2ac0
candidate-to-merge tree delta      0
exact workflow run                 30201583365
GitHub artifact                    8631818173
GitHub artifact digest             sha256:65af28c27b2d14b062bd9431e0d9e7962289cc88ddc730a1a5a0f94a21f0bf0f
semantic artifact digest           sha256:d62a1ee79d66241ac52e40fd1416350b8d2369c0f0ba3b680104fd1de601b886
R1 readback                        PASS
locked version delete denied       PASS
retain until                       2027-01-22T12:13:24.734Z
```

Repository candidate status remains the historical formal-candidate record; no post-merge status rewrite is allowed. External exact-SHA status plus immutable R1 artifact control effectiveness.

## Effective S5 behavior

```text
Residuals                          24
Calibration / objective / holdout  16 / 15 / 8
diagnostic-only evidence           FVO-10
selected parameter                 0.034000
sensitive regimes                  HIGH_EXCESS, MID_EXCESS
Candidate / Shadow                 1 / 1
completed rerun writes             0
Model Activation                   0
active Config switch               0
State / checkpoint pointer delta   0 / 0
```

## Capability frontier

| Capability | Status | Next authority |
|---|---|---|
| `MCFT-CAP-08.S1`–`S4` | Effective predecessors | Historical exact-SHA artifacts retained |
| `MCFT-CAP-08.S5-PQ` | Effective qualification | Consumed by S5 formal implementation |
| `MCFT-CAP-08.S5` | Effective | Authorizes S6 implementation entry |
| `MCFT-CAP-08.S6` | Authorized, not implemented | Build one exact-main final-closure Candidate with two independent fresh-database runs and exact-head independent approval |
| `MCFT-CAP-09` | Not authorized | Requires MCFT-CAP-08 final closure |

## S6 entry boundary

S6 must bind the external S5 R1 authority without rewriting S5 status. It retains the frozen two-run, 24-item Hard Acceptance, ten CAP-07 GET-surface, exact-head independent-review and R2/730-day closure requirements.

S5 effectiveness does not establish MCFT-CAP-08 completion, production Runtime source, Model Activation, active Config switching, or MCFT-CAP-09 authority.
