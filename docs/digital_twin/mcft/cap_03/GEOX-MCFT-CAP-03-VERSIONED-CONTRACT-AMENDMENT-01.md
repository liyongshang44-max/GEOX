<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md -->
# MCFT-CAP-03 Versioned Contract Amendment 01

## Status

`EFFECTIVE`

This amendment becomes effective only after its pull request merges to `main`, exact-head CI passes, and merged-main tree equivalence is recorded.

## Authority and purpose

This amendment resolves the post-closure conformance findings recorded in issue #2368 without rewriting historical V1 contracts or canonical facts.

The frozen v1.2 task remains the historical semantic authority. The active forward Runtime path is the additive, versioned V2 path established after the confirmed S2 semantic-conformance defects.

## Version authority

| Concern | Historical authority | Active forward authority |
|---|---|---|
| Assimilation mathematical kernel | `SCALAR_GAUSSIAN_ASSIMILATION_V1` | unchanged |
| Record-set contract | `MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1` | `MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2` |
| Evidence Window contract | V1 | V2 |
| Observation selector | V1 | `LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2` |
| Historical canonical facts/readback | immutable | preserved through explicit version dispatch |

V2 is not an in-place upgrade of V1. It is an additive contract selected explicitly by the Runtime Config and validated through fail-closed version dispatch.

## Clarified hard semantics

1. `evaluated_observation_refs` is exactly `[selected_observation_ref]` when an observation is selected, otherwise `[]`.
2. Older usable, duplicate-suppressed, and rejected candidates remain in `candidate_observations`; they are not placed in `evaluated_observation_refs`.
3. Candidate exclusion is not a tick failure. A window containing only excluded candidates commits a legal `NOT_APPLIED / NO_USABLE_OBSERVATION` A2 tick.
4. Wrong scope, binding, quantity, canonical unit, physical bounds, FAIL quality, future, late, and stale records remain traceable rejected candidates when structurally well formed.
5. Malformed canonical observations and conflicting semantic duplicates fail closed.
6. Every single-tick request carries both Runtime Config ref and determinism hash.
7. Every range logical time carries an explicit Runtime Config ref/hash pair. Restart and bounded forward backfill inherit this requirement.
8. Idempotent replay validates the supplied Runtime Config ref/hash before returning existing success.

## Completion-claim interpretation

The frozen claim `OBSERVATION_ASSIMILATION_V1_ESTABLISHED` remains valid only as a claim about the established V1 Gaussian assimilation kernel and historical V1 compatibility. It does not claim that the active record-set or selector contract is V1.

The active contract identity is recorded separately as:

`MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2`.

## Preserved boundaries

This amendment does not authorize:

- Forecast residual or successful Forecast;
- Scenario, Recommendation, Policy Evaluation, Decision, or AO-ACT;
- Calibration Candidate, Shadow Evaluation, or Model Activation;
- late-Evidence revision or automatic recomputation;
- continuous scheduler, continuous Runtime, or live-field claim;
- MCFT-CAP-04.
