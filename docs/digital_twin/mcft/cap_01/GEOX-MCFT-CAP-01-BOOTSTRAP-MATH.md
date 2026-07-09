# GEOX MCFT-CAP-01 S3B Bootstrap State Mathematics v1

```text
delivery_slice_id:
MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1

implementation_baseline:
4ddd2bbf4d5d421f875e3ab5b1bfd76749f2ca3a

scope:
PURE_DOMAIN_MATHEMATICS_ONLY

status:
IMPLEMENTED_PENDING_PR_ACCEPTANCE
```

## Established calculation

The slice computes one configured weak prior and one scalar Gaussian assimilation update for:

```text
ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION
```

The implementation consumes the frozen MCFT-00 hydraulic values through explicit function input. It does not read authority artifacts itself and does not access Postgres, files, environment variables, wall clock, network, Fastify, scheduler state, or mutable global state.

The standard case is:

```text
prior mean:                 0.210000
prior variance:             0.008100
observation:                0.184000
effective observation var:  0.004000
assimilation gain:          0.669421
posterior mean:             0.192595
posterior variance:         0.002678
posterior stddev:            0.051746
95% interval:               [0.091172, 0.294018]
root-zone storage:           57.778512 mm
available-water fraction:   0.403306
depletion from FC:           32.221488 mm
```

All calculations use full JavaScript numeric precision internally. Only emitted semantic fields are rounded to six decimal places through `DECIMAL_HALF_AWAY_FROM_ZERO_V1`.

## Physical and epistemic boundaries

The implementation enforces:

```text
0 <= observation <= 1
wilting point < field capacity < saturation <= 1
posterior variance >= 0
posterior stddev² ~= posterior variance
0 <= posterior mean <= saturation
available-water fraction clamped to [0,1]
depletion clamped to non-negative
Gaussian interval clipped to [0,saturation]
unclipped interval and clipping metadata retained
```

The point observation remains:

```text
direct_state_equivalence: false
```

The State output preserves:

```text
confidence.status: NOT_ESTABLISHED
confidence.reason_code: NO_CALIBRATED_CONFIDENCE_MODEL
recommendation_input_eligible: false
action_input_eligible: false
surface State: unavailable
water-stress State: not established
drainage State: not established
```

## Runtime Config amendment within S3B authority

The existing bootstrap model config is extended only with the four v2.1-authorized fields:

```text
physical_bound_version
Gaussian interval rule
uncertainty interval clipping rule
interval clipping bounds
```

No Reality identity, source/configuration hash, A0 identity rule, canonical object set, persistence contract, or transaction behavior is changed.

## Acceptance

`ACCEPTANCE_MCFT_CAP_01_STATE_MATH.ts` covers:

```text
standard exact-value case
LIMITED quality case
FAIL rejection
missing observation
below-zero and above-one observations
NaN and Infinity
invalid hydraulic ordering
invalid prior mean
negative prior variance
direct-State-equivalence rejection
posterior saturation violation
lower and upper interval clipping
available-water clamping
depletion non-negativity
deterministic rerun
input immutability
Runtime Config boundary identifiers
Domain purity scan
```

## Nonclaims

```text
NO_POSTGRES
NO_CANONICAL_WRITE
NO_A0_RUNTIME_INTEGRATION
NO_EVIDENCE_SELECTION
NO_FORECAST_EXECUTION
NO_PROPAGATION
NO_SECOND_STATE
NO_CONTINUOUS_RUNTIME
NO_SCENARIO
NO_RECOMMENDATION
NO_ACTION_LOOP
```
