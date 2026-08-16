# GEOX MCFT-CAP-09 Amendment-18 — Pre-window State Continuity and Formal Store Rebase Authority

Status: **ARCHITECTURE ADJUDICATION CANDIDATE — NOT EFFECTIVE UNTIL MERGED TO PROTECTED `main` WITH EXACT-HEAD GATE PASS**

Exact predecessor protected main: `e36a5bee68a15cd55cff8885f7e191a11109a612`

## 1. Purpose

This amendment corrects one narrow contradiction exposed only after the T3R1 successor epoch, 24 Runtime Configs, immutable window manifest, and Amendment-11 persistent-tick service were all qualified.

The selected successor epoch remains:

```text
epoch = mcft_cap09_external_formal_window_epoch_20260817t200000z_v2
O00   = 2026-08-17T20:00:00.000Z
O23   = 2026-08-18T19:00:00.000Z
```

The currently persisted T3R1 A0 state is at:

```text
A0 logical time                  = 2026-08-15T10:00:00.000Z
persisted checkpoint next tick   = 2026-08-15T11:00:00.000Z
selected O00                     = 2026-08-17T20:00:00.000Z
```

Therefore the current A0 cannot be the canonical State/checkpoint predecessor of selected O00 without skipping 57 hourly continuation boundaries.

## 2. Governing predecessor contracts

This amendment consumes and preserves the following authorities:

- `GEOX-MCFT-CAP-09-TASK.md` — one governed scope through 24 actual hourly UTC scheduler boundaries using the same canonical Runtime semantics;
- `GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md` — persisted continuation starts at `checkpoint.next_tick_logical_time`, backfill is forward/contiguous/hourly and may not skip an hour;
- `GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json` — a canonical store cannot create a second `INITIAL` lineage for the same existing active scope; a second initial bootstrap is not permitted by projection absence or pointer replacement;
- Amendment-06 — append-only future epoch rebase, actual UTC Formal clock, old facts/configs preserved, slot-specific crop-context freshness, no retroactive O00;
- Amendment-11 — delayed exact-T admission uses `PROVIDER_AVAILABILITY_WATERMARK_V1`, not a fixed age/fixed T+432 authority;
- Amendment-17 — T3R1 activation requires a zero-state Formal database and forbids cross-scope canonical stitching;
- the effective T3R1 successor epoch/config/manifest chain through PR #3194;
- the effective Amendment-11 persistent-tick service through PR #3195.

## 3. Contradiction adjudication

Amendment-06 remains correct in allowing the historical A0 **Runtime Config** to be a semantic parent of a later rebased Runtime Config chain when no Formal tick has occurred. That exception is a configuration-parent exception only.

It does **not** authorize any of the following:

- rewriting `checkpoint.next_tick_logical_time` from `2026-08-15T11:00:00Z` to selected O00;
- treating the 2026-08-15T10:00:00Z State as if it were an O00-minus-one-hour State;
- applying one `exact_PT1H` process transition across a multi-day gap;
- skipping missing continuation hours while claiming canonical continuity;
- initial multi-slot catch-up to manufacture a pre-O00 State;
- a second INITIAL lineage inside the already populated T3R1 canonical store.

Any implementation that merely relaxes `REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK`, changes the checkpoint pointer in place, or constructs a handoff DTO with a fabricated next logical time is a semantic regression.

## 4. Core ruling

The currently populated T3R1 Formal database is retained as immutable qualification/history evidence and is **superseded as the canonical store for the selected O00–O23 Formal run**.

The actual O00–O23 Formal run SHALL use a new zero-state Formal canonical store with the same six-key T3R1 External scope and the same protected source/reality/crop authority, but a distinct frozen database identity.

The new Formal store SHALL establish exactly one initial A0 at:

```text
PREWINDOW_A0 = O00 - PT1H = 2026-08-17T19:00:00.000Z
```

The initial A0 checkpoint SHALL satisfy:

```text
A0 checkpoint logical time      = 2026-08-17T19:00:00.000Z
A0 checkpoint next tick         = 2026-08-17T20:00:00.000Z
selected O00                    = 2026-08-17T20:00:00.000Z
```

O00 then remains an ordinary exact-PT1H continuation tick. No canonical time jump is introduced.

## 5. Selected epoch preservation

The selected epoch times and the 24 protected-main slot crop-context hashes MAY remain unchanged only if all existing whole-window crop-context guards still pass and the EA5E3 readiness deadline has not expired.

The old successor Runtime Config refs/hashes and old manifest become historical predecessor evidence because their O00 parent points to the superseded historical A0.

A new exact builder SHALL construct:

```text
1 pre-window A0 Runtime Config at O00 - PT1H
24 HOURLY_CAP04 Runtime Configs at O00 ... O23
```

with these rules:

1. the A0 Runtime Config has no Runtime Config parent;
2. O00 parent ref/hash equals the new pre-window A0 Runtime Config ref/hash;
3. O01–O23 form the exact immediate parent chain;
4. A0 crop context is independently rederived for `O00 - PT1H`;
5. O00–O23 crop-context hashes equal the already effective successor epoch-selection hashes slot-for-slot;
6. no stale A0 crop-context hash is copied across the hourly chain;
7. every config remains `EXPLICIT_REF_HASH_PIN_ONLY`;
8. no implicit latest selection is permitted.

The expected A0 crop-context authority identity at `2026-08-17T19:00:00.000Z` is independently derivable under the same Amendment-17 / Formal Crop Context V2 policy; it must not be hard-coded without exact-head recomputation.

## 6. New zero-state Formal store

The replacement Formal canonical store MUST:

- be a distinct database identity frozen before any canonical write;
- have the same required PostgreSQL schema/migrations as the current Formal store;
- contain zero canonical facts, zero active lineage, zero State/latest checkpoint/latest Forecast, zero scheduler slots/cursor and zero Runtime lease before bootstrap;
- contain no T1R1 or previous T3R1 canonical rows;
- preserve the old populated T3R1 database without delete/truncate/update/relabel operations;
- use the same six-key T3R1 scope from Amendment-17;
- remain the sole canonical store for the selected Formal O00–O23 run after cutover.

Creating the new empty store is a store-identity rebase, not a migration of canonical facts.

## 7. Pre-window A0 execution

The pre-window A0 MAY execute only after a separately qualified builder/store-preflight/cutover authority is effective.

At the actual `2026-08-17T19:00:00.000Z` boundary it SHALL:

- use real UTC wall clock;
- obtain a fresh authorized T3R1 soil observation whose event/availability chain is eligible for that A0 boundary;
- retain raw evidence before canonicalization;
- use the frozen T3R1 Reality Binding and source authority;
- derive the A0 crop context from the same frozen six-variant/planting-uncertainty policy;
- persist exactly one INITIAL lineage/A0 package into the zero-state store;
- persist the exact pre-authorized A0 + O00–O23 Runtime Config chain;
- leave scheduler slot/cursor count at zero;
- leave Formal execution count `0/24`;
- create no Recommendation, Approval, AO-ACT, Dispatch, or Model Activation.

The bootstrap must fail closed if the fresh soil observation is unavailable or late. It may not fall back to the historical 2026-08-15 A0 State.

## 8. EA5E3 readiness deadline and late cutover gate

The existing readiness deadline remains:

```text
EA5E3 authority effective no later than 2026-08-17T08:00:00.000Z
```

EA5E3 may pre-authorize the future O00-minus-one-hour bootstrap only when the new store identity, exact expected A0/config pins, exact 24 slot pins, collector/runtime wiring, and this Amendment-18 are already frozen.

Because the fresh A0 necessarily occurs after the O00-minus-12-hour readiness deadline, O00 enablement SHALL additionally require a post-bootstrap cutover gate between A0 completion and O00. That gate must prove:

- exact protected-main subject;
- exact new Formal database identity;
- exactly one valid A0 State/checkpoint at O00-minus-one-hour;
- checkpoint next logical tick equals O00;
- active Runtime Config equals the new A0 config;
- exact 24 O00–O23 Runtime Config pins are present;
- scheduler remains zero/unstarted;
- no Formal O00 tick exists yet;
- no forbidden downstream action object exists;
- current wall clock has not crossed O00.

Failure keeps O00 disabled. It does not authorize retroactive O00 or an initial catch-up.

## 9. Amendment-06 clauses superseded narrowly

For the selected T3R1 epoch only, this amendment supersedes these Amendment-06 implications:

- the historical persisted A0 State/checkpoint does **not** remain the current pre-O00 canonical State through selected O00;
- the historical populated T3R1 database does **not** remain the Formal execution store;
- selected O00 config does **not** retain the historical A0 Runtime Config as its parent after the store rebase.

All other Amendment-06 rules remain in force, especially append-only audit preservation, actual-UTC Formal clock, no retroactive execution, no initial multi-slot catch-up, slot-specific crop-context derivation, explicit config pins, and readiness expiry.

## 10. Hard nonclaims

This amendment does not authorize:

- mutation or deletion of the existing 59-fact / 49-config T3R1 database;
- a second INITIAL lineage inside that populated database;
- checkpoint pointer rewriting;
- time-gap continuation;
- 57-hour pre-window scheduler/backfill execution;
- reusing old successor config refs/hashes after the new A0 parent changes;
- changing selected O00/O23 by itself;
- changing Amendment-11 provider availability semantics;
- fixed `6h`, `24h`, `36h`, `T+432`, or `T+437` admission authority;
- Formal O00 start by this document alone;
- EA5E3 effectiveness by this document alone;
- Recommendation, Approval, AO-ACT, Dispatch, or Model Activation;
- MCFT-CAP-09 completion.

## 11. Legal successor sequence

After this amendment becomes effective, the only legal sequence is:

```text
A18A  zero-state Formal store identity + schema preflight
A18B  O00-1h A0 + O00-O23 deterministic config builder qualification
A18C  replacement immutable Formal Window Input Manifest + runner exact binding qualification
EA5E3 readiness / pre-authorization before O00-12h
A18D  actual O00-1h fresh bootstrap + post-bootstrap cutover proof
O00   actual UTC Formal start
O01..O23
```

No later step may infer effectiveness from an unmerged predecessor.

## 12. Success effect

If and only if this amendment merges to protected `main` after exact-head gate PASS:

```text
AMENDMENT_18_EFFECTIVE = true
selected epoch times remain eligible, subject to existing expiry rules
historical populated T3R1 store remains immutable history
historical A0 remains valid historical qualification evidence
historical A0 is ineligible as selected O00 State/checkpoint predecessor
new zero-state Formal store preparation becomes authorized
pre-window A0 target freezes to O00 - PT1H
EA5E3 remains NOT AUTHORIZED
Formal O00 remains NOT STARTED
Formal execution remains 0/24
MCFT-CAP-09 remains incomplete
```
