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
AUTHORITY_PASS_BUT_ACTIVATION_BLOCKED
  frozen production freshness <=6h passes, but the current EA5E2
  orchestration/protocol or another pre-dispatch gate forbids dispatch

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

The zero-provider/zero-database full-chain gate reports two independent results:

- `status`: static implementation and governance conformance;
- `activation_readiness`: whether a lawful crop context currently supplies a future legal target.

`CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET` therefore remains an explicit readiness blocker and forbids live dispatch, while a correctly fail-closed engineering PR can still pass static conformance. This does not create or extend crop authority.

It also enumerates every known temporal and runtime pre-dispatch requirement. A small blocker count is never a claim that unexecuted Formal, GFS, soil-decoder, exact-head qualification, or long-window drift checks passed.

## Phase-aware single-T orchestration

The confirmed daily-batch mechanism is incompatible with the current first-future-T orchestration used with the frozen Amendment-07 late exact-hour schedule.

The current authority requires the same KBS Raw Hourly source to contain the exact target row by `T+427m`, with a `T+432m` cutoff. A daily batch published at approximately 05:xxZ with observations only through approximately 04:00Z cannot contain a newly selected future target such as 06:00Z. That target is expected in the next daily batch, roughly `T+23h`, not inside the frozen seven-hour envelope.

Therefore the first-future-T mode remains incompatible:

- retry cannot resolve the mismatch;
- freshness headroom cannot resolve the mismatch;
- relabeling or copying an older hour remains forbidden;
- the current orchestration can be resolved by phase-aware long-horizon target scheduling, a new authority protocol aligned with delayed daily-batch observation, or a separately qualified authoritative source that can publish exact `T` inside the frozen envelope.

The live viability path now implements the single-T phase-aware option. Its non-authoritative planning profile uses a conservative `05:30Z` daily first-seen upper bound and projected batch coverage from previous-day `05:00Z` through batch-day `04:00Z`. It scans only crop-legal exact hours inside a bounded 180-minute dispatch horizon and requires a target-specific proof that projected first-seen precedes the operational `T+407m` discovery deadline. Under that profile, `22:00Z` is rejected and `23:00Z` is the first feasible evening hour; the latter retains 17 minutes of planning slack before discovery closes.

The planning profile does not admit Evidence. At the late phase, the same-source exact-T poll still must find exactly one row, the retrieval-completed freshness must still be at most six hours, the real collector still must finish before the frozen `T+432m` cutoff, and every failure remains fail-closed. The 24-slot Formal objective remains a separate, stronger constraint and is not claimed compatible by this single-T scheduler.

This implementation does not invent a replacement cutoff. The publication observer must accumulate enough real batches to support a later authority adjudication.

## Pre-dispatch operational headroom

The unchanged six-hour freshness threshold remains the production authority. Legacy first-future scheduling requires at least 60 minutes of remaining current-snapshot freshness headroom. Phase-aware scheduling does not use a stale pre-boundary Raw Hourly snapshot as late-phase admission; it observes metadata for source identity and defers the unchanged freshness authority to the actual late retrieval. Target selection reserves 120 minutes for dependency installation, Formal verification, private-store smoke, source probes, and target binding, and is bounded to a 180-minute target horizon.

```text
50 minutes = 30-minute pre-boundary offset + 20-minute minimum lead
10 minutes = orchestration/jitter allowance
60 minutes = scheduler-only minimum operational headroom
120 minutes = target setup budget, evaluated independently of source freshness
```

A source can therefore pass or fail the frozen six-hour authority at pre-boundary time without that snapshot being relabeled as late Evidence. Only the actual late exact-T retrieval can pass the production freshness gate. Scheduler headroom and the planning profile are not source authority.

## Bounded release-window capture

The hourly observer remains the long-term state chain. A separate daily watcher begins nominally at `04:40Z`, polls the same exact source every five minutes for at most 24 attempts, and stops only on a fresh, 24-hour-complete, contiguous, duplicate-free batch window. Timestamp advance with incomplete or duplicate coverage continues polling through the bounded grace window. It then runs the cadence/readiness evaluators read-only and uploads metadata only. It cannot dispatch EA5E2 and has no actions-write permission.

The first retrieval-completed watcher attempt that observes the advance is carried into the cadence state as the publication first-seen upper bound; the immediately preceding non-advanced attempt supplies the lower bound when available. This improves first-seen evidence and production-window capture despite GitHub cron delay. It does not make the frozen exact-T protocol compatible and does not create crop authority.

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
