# GEOX MCFT-CAP-09 KBS Daily-Batch Cadence Intelligence Design V1

Status: Draft implementation design  
Authority effect: false

## Frozen fact and boundary

The expected provider operating behavior is:

```text
provider = KBS Raw Hourly
provider_expected_update_behavior = DAILY_BATCH
expected release shape = approximately 24 independent hourly observations per batch
```

This is an engineering scheduling fact. It is not a freshness amendment. Production EA5E2 continues to require:

```text
latest Raw Hourly age <= 6h
```

A daily batch always remains a set of independent hourly Evidence candidates. It is never converted into one daily aggregate.

## Separate state dimensions

The implementation keeps three questions separate:

1. Provider cadence/health: normal daily batch, waiting, late, or missing.
2. Production freshness: PASS only when age is at most 6 hours.
3. Engineering availability: non-authoritative validation may run when age is at most 24 hours.

No provider-health classification can convert production freshness failure into PASS.

## Scheduler decisions

```text
RUN
  only when frozen production freshness <=6h passes

WAIT_NEXT_BATCH
  provider behavior is daily batch;
  production freshness fails;
  engineering validation remains within 24h

DEFER
  production freshness and engineering window both fail,
  but machine-auditable batch history is not yet sufficient to classify late/missing

FAIL
  at least three auditable batches establish an inter-batch profile
  and the next batch misses the learned p95 interval plus the frozen
  2h scheduler tolerance
```

The 2h tolerance is scheduler intelligence only. It is not source, agronomic, crop-stage, or Formal authority.

## Batch evidence

The metadata-only observer records and carries forward:

- first-seen bracket;
- observation-time start and end;
- forward hourly-event count;
- expected span hour count;
- missing event times;
- hourly continuity;
- whether the forward batch is approximately 24 hours;
- revision and backfill counts;
- observed batch count;
- median/p95 publish minute UTC;
- publish-time jitter;
- median/p95 inter-batch interval.

The current freshness probe independently checks whether the latest 24 expected observation hours exist and are continuous. It emits timestamps, counts and booleans only—not weather values or the raw provider body.

## Engineering validation

```text
qualification_mode = ENGINEERING_VALIDATION
maximum age = 24h
authority_effect = false
formal_effect = false
ea5e2_effectiveness = false
```

It may validate transport, exact source identity, CSV schema, rainfall decoding, historical ASCE hourly ET0, recent coverage, batch completeness and continuity. It may not create crop authority, select an epoch, start EA5E2/EA5E3/Formal, write canonical state, retain public raw bodies, or emit decoded values.

## Static conformance versus activation readiness

The zero-provider/zero-database full-chain gate now reports two independent results:

- `status`: static implementation and governance conformance;
- `activation_readiness`: whether a lawful crop context currently supplies a future legal target.

`CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET` therefore remains an explicit readiness blocker and forbids live dispatch, while a correctly fail-closed engineering PR can still pass static conformance. This does not create or extend crop authority.

## P0: Amendment-07 exact-T incompatibility

The confirmed daily-batch mechanism invalidates the premise used by the frozen Amendment-07 late exact-hour schedule.

The current authority requires the same KBS Raw Hourly source to contain the exact target row by `T+427m`, with a `T+432m` cutoff. A daily batch published at approximately 05:xxZ with observations only through approximately 04:00Z cannot contain a newly selected future target such as 06:00Z. That target is expected in the next daily batch, roughly `T+23h`, not inside the frozen seven-hour envelope.

Therefore:

- retry cannot resolve the mismatch;
- freshness headroom cannot resolve the mismatch;
- relabeling or copying an older hour remains forbidden;
- the full EA5E2 live workflow must fail closed before any live activation side effect;
- resolution requires either a new authority protocol aligned with delayed daily-batch observation or a separately qualified authoritative source that can publish exact `T` inside the frozen envelope.

This implementation does not invent a replacement cutoff. The publication observer must accumulate enough real batches to support a later authority adjudication.

## Pre-dispatch operational headroom

The unchanged six-hour freshness threshold remains the production authority. Separately, the live scheduler requires at least 60 minutes of remaining freshness headroom before starting expensive work:

```text
50 minutes = 30-minute pre-boundary offset + 20-minute minimum lead
10 minutes = orchestration/jitter allowance
60 minutes = scheduler-only minimum operational headroom
```

A source can therefore still pass the frozen six-hour authority while the full-live scheduler correctly refuses dispatch. This headroom is not source authority and cannot cure the exact-T protocol incompatibility.

## Bounded release-window capture

The hourly observer remains the long-term state chain. A separate daily watcher begins nominally at `04:40Z`, polls the same exact source every five minutes for at most 24 attempts, and stops on the first fresh complete batch window. It then runs the cadence/readiness evaluators read-only and uploads metadata only. It cannot dispatch EA5E2 and has no actions-write permission.

This watcher improves first-seen evidence and production-window capture despite GitHub cron delay. It does not make the frozen exact-T protocol compatible and does not create crop authority.

## Components

- `OBSERVE_MCFT_CAP_09_KBS_PUBLICATION_CADENCE.py`
- `OBSERVE_MCFT_CAP_09_KBS_CURRENT_FRESHNESS_METADATA.py`
- `MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs`
- `PREFLIGHT_MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE.cjs`
- `VALIDATE_MCFT_CAP_09_KBS_ENGINEERING_WINDOW.py`
- `EXECUTE_MCFT_CAP_09_KBS_ENGINEERING_VALUE_PATH.py`
- `.github/workflows/mcft-cap-09-kbs-provider-cadence-intelligence.yml`
- `WATCH_MCFT_CAP_09_KBS_BATCH_QUALIFICATION_WINDOW.py`
- `.github/workflows/mcft-cap-09-kbs-batch-qualification-window.yml`

## Nonclaims

This implementation does not change the 6h production threshold, create a successor crop context, qualify EA5E2 operational activation, make EA5E3 effective, start Formal O00, or change Formal execution from `0/24`.
