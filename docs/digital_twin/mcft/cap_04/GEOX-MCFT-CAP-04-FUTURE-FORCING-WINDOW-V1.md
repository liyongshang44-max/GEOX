<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-WINDOW-V1.md -->

# GEOX MCFT-CAP-04 S2 — Future Forcing Window V1

## Identity

```text
baseline merged main: 13f8bf3231cb41c809d235096ca7cfda9e201944
branch: agent/mcft-cap-04-s2-future-forcing-window-v1
delivery slice: MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

## Established boundary

S2 deterministically forms weather/ET0 pairs only when both canonical Evidence snapshots share the same forcing-cycle basis: exact scope, issued time, Runtime availability time, valid-from and valid-to. Pair selection occurs after identical-duplicate collapse and orders complete pairs by availability descending, issue time descending, then weather and ET0 source-record identifiers ascending.

Each selected pair produces exactly 72 hourly forcing points covering `(T,T+72H]`. The complete point array determines `forcing_window_hash`. Snapshot references and hashes are the canonical Evidence `source_record_id` and `source_record_hash` values.

## No-future-leakage

At logical time T, snapshots issued or available after T are ineligible. Observed rainfall, actual ET0, soil observations, forecast revisions, execution receipts and outcome data after T are outside the selector authority. S2 never stitches weather and ET0 across cycles or across incomplete snapshots.

## Failure semantics

An absent complete pair produces the explicit blocked reason `NO_COMPLETE_MATCHING_FORCING_CYCLE`. Conflicting duplicate payloads raise `CONFLICTING_FORCING_SNAPSHOT`; multiple non-collapsible same-kind snapshots in one cycle raise `CONFLICTING_FORCING_CYCLE`. Conflicts are malformed input and do not create A1/A2 canonical records.

## Standard fixture

The 24 logical ticks from `2026-06-03T02:00:00.000Z` through `2026-06-04T01:00:00.000Z` each select an independent complete pair. Their Forecast target union contains exactly 95 hours, from `2026-06-03T03:00:00.000Z` through `2026-06-07T01:00:00.000Z`.

## Preserved nonclaims

S2 does not implement Forecast equations, Scenario equations, A1/A2/B persistence, migration, projection, route, scheduler, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
