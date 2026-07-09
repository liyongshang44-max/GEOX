# GEOX MCFT-CAP-02 — Continuation Contracts / Config Slice

## Scope

This slice establishes the frozen continuation Runtime Config contract for MCFT-CAP-02.
It is the first implementation slice after governance authorization.

### Implemented boundaries

- continuation Runtime Config semantic payload contract
- deterministic compilation of `twin_runtime_config_v1`
- frozen replay pin selection mode
- fixed governed 300 mm root-zone control volume
- soil hydraulic snapshot binding
- process uncertainty policy binding
- no-observation update policy binding
- forecast block policy binding
- exact-hour crop-stage context binding
- continuation contract acceptance script

### Explicitly not implemented in this slice

- hourly water-balance propagation
- observation assimilation
- uncertainty propagation beyond frozen config contract
- continuation persistence
- checkpoint progression
- restart/resume
- backfill
- forecast execution
- scheduler
- AO-ACT
- recommendations / decisions

## Frozen inputs used by the slice

- predecessor lock: `docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json`
- reality binding: `mcft_rb_bf1da664164a4fedda249bcb`
- source matrix hash: `sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b`
- configuration matrix hash: `sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5`
- geometry semantic hash: `sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51`
- crop-stage context: `fixtures/mcft/water_state/replay_v1/configuration_context.json`

## Frozen continuation contract constants

- purpose: `HOURLY_DYNAMICS_CONTINUATION`
- selection mode: `EXPLICIT_REPLAY_PIN`
- root-zone policy: `GOVERNED_FIXED_ROOT_ZONE_300MM_V1`
- model id: `ROOT_ZONE_HOURLY_WATER_BALANCE_V1`
- process uncertainty policy: `CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1`
- no-observation policy: `DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1`
- forecast block policy: `MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1`
- rounding rule: `DECIMAL_HALF_AWAY_FROM_ZERO_V1`

## Acceptance

The slice is accepted when the continuation Runtime Config compiler and acceptance script both pass, and the resulting config is byte-stable across `created_at` changes.

Expected command:

```bash
pnpm exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts
```

## Next slice

`MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1`

This slice remains blocked until contracts/config is complete and reviewed.
