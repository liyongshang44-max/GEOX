# GEOX MCFT-CAP-09 — KBS Publication Cadence Observer V1

Status: read-only observability candidate. This document does not amend MCFT-CAP-09 authority.

Base protected main: `0da26233e8787f6e014e21f701e3837506ba6c15`.

## Purpose

Measure how the exact KBS LTER Raw Hourly source becomes publicly retrievable over real wall-clock time without changing the source, freshness threshold, Fixed-Lag authority, Formal runtime, or canonical data plane.

Exact source:

```text
https://lter.kbs.msu.edu/datatables/13.csv
final host = lter.kbs.msu.edu
final path = /datatables/13.csv
event field = datetime_utc
```

The observer treats KBS as hourly-resolution event data. The provider operating profile is `CONFIRMED_DAILY_BATCH`, based on the observed operating mechanism used by scheduler engineering. That profile has `authority_effect=false`: it does not amend the `<=6h` freshness rule, Amendment-07, or Formal evidence semantics. The observer's own machine-evidence classification remains separate and still requires at least three real publication transitions.

## First-seen availability semantics

For provider event `E`, a polling observer may only establish source availability as an interval when KBS exposes no trustworthy publication timestamp:

```text
A in (last_not_seen_at, first_seen_at]
```

The first observer run is baseline-only. Existing rows at baseline receive no fabricated historical availability bracket.

A later newly observed row may receive:

```text
last_not_seen_at = previous successful poll time
first_seen_at    = current successful poll time
```

and therefore publication-lag bounds:

```text
A - E in (last_not_seen_at - E, first_seen_at - E]
```

This observer does not map `A` onto `available_to_runtime_at`; #3056 separately prototypes E/A/I/K semantics and remains Draft.

## Metadata-only public state

The workflow may fetch the complete CSV transiently in process memory, but public artifacts may contain only:

- poll time;
- response digest and byte count;
- optional HTTP Last-Modified / ETag;
- parsed row count;
- latest event time;
- recent `event_time -> row identity hash` index;
- transition counts;
- first-seen availability brackets;
- transition history and candidate cadence class.

No KBS raw values or raw body may be uploaded to the public artifact.

## Batch interpretation

If one poll first observes multiple hourly rows, they form one observed publication batch for cadence analysis. This does not collapse them into one daily Evidence record.

A future batch-ingress implementation, if separately authorized, must preserve N hourly provider events as N hourly Evidence records linked by one batch identity.

Daily aggregate substitution for KBS Raw Hourly is forbidden by this observer.

## Transition shapes

The observer reports descriptive shapes only:

```text
BASELINE_SNAPSHOT
NO_CHANGE
SINGLE_NEW_EVENT_HOUR
MULTI_HOUR_FORWARD_BATCH
BACKFILL_OR_REVISION_ONLY
MIXED_FORWARD_AND_BACKFILL_OR_REVISION
```

After at least three successful publication transitions, it may produce a non-authoritative candidate classification:

```text
HOURLY_INCREMENTAL_OBSERVED
BATCHED_OR_BURSTY_OBSERVED
VARIABLE_PUBLICATION_OBSERVED
```

It deliberately does not emit `DAILY_BATCH` as an authority conclusion. `CONFIRMED_DAILY_BATCH` is the non-authoritative provider operating profile; `candidate_cadence_class` remains the observer's transition-derived machine evidence.

## Revision/backfill observation

The recent 240-hour event index stores only event times and hashes. A new event older than the previous latest time is reported as backfill. A previously observed event whose row-identity hash changes is reported as a provider revision observation. The observer does not rewrite any prior GEOX Evidence or lineage.

## State transport

Scheduled runs use the previous successful default-branch observer artifact as their metadata-only state predecessor. No DB, R2, cache, repository commit, or external secret is required.

The state chain is only continued on protected/default `main`. Pull-request runs are isolated baselines and cannot contaminate the operational cadence chain.

## Schedule

The workflow is scheduled hourly at minute 17 UTC. GitHub scheduler delay is acceptable because `polled_at` records actual execution time; the cron time itself is not treated as availability evidence.

## Bounded qualification-window watcher

The long-term hourly observer remains evidence-oriented and may start late because GitHub scheduling is best-effort. A separate bounded watcher starts nominally at `04:40Z`, polls every five minutes for at most 24 attempts, and stops as soon as a fresh complete daily batch window is captured. It uploads metadata-only poll attempts plus a read-only cadence/readiness evaluation.

The bounded watcher has no `actions:write`, does not dispatch the live workflow, and cannot override either the exact-T protocol blocker or crop-context blocker. A missed bounded window is an operational monitoring failure, not an authority amendment.

## Nonclaims

The observer does not:

- change KBS `<=6h` freshness authority;
- change Amendment-07 `T+07:12` cutoff;
- qualify EA5E2 operational activation;
- make #3056 effective;
- create Formal Evidence;
- write Formal DB/R2/scheduler/canonical runtime;
- rescue an old Formal slot;
- replace KBS LTER with Enviroweather/NWS;
- change datatable 561's daily-extrema role;
- authorize daily aggregate substitution;
- start Formal O00;
- complete MCFT-CAP-09.
