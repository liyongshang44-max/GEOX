<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FINALIZATION.md -->
# GEOX MCFT-CAP-04 S10A Finalization Candidate

## Identity

```text
lifecycle_stage: S10A_CANDIDATE
baseline_main_commit: a6a07840efe080198233b39ec9a31d26c2e3f4f9
branch: agent/mcft-cap-04-s10a-finalization-candidate-v1
runtime_mode: REPLAY
materialization_gate_run: 29258899679
materialization_gate_result: SUCCESS
```

## Semantics

S10A records the S9 merged-main closure evidence and prepares the finalization candidate. Exactly 24 completion claims remain pending and zero are effective.

S10A does not set status or implementation_status to COMPLETE. closure_effective and capability_complete remain false.

## Downstream lock

S10B is not authorized until S10A is merged and its merged-main Gate passes. S10C and MCFT-CAP-05 remain unauthorized.
