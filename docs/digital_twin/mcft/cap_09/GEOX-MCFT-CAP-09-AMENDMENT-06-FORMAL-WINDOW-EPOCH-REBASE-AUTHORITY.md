# GEOX-MCFT-CAP-09 Amendment-06 — Formal Window Epoch Rebase Authority

Status: **architecture adjudication candidate; not effective until merged to protected `main` with its exact-boundary Gate PASS.**

Baseline protected main: `ec4b0c04b736ee55b8eb9367d24ec81acb22bf08`

This amendment is subordinate to the effective MCFT-CAP-09 Taskbook, Amendment-01 through Amendment-05, the completed EA5D bootstrap/config persistence authority, and the effective EA5E0 clock-viability rejection. It does not reopen S0–S5, does not weaken the actual-UTC Formal clock, does not authorize replay/acceleration, and does not start O00–O23.

## 1. Why this amendment is required

EA5E0 proved a chronology conflict after EA5D completed honestly:

- the persisted External A0 bootstrap Runtime Config is `2026-08-09T21:00:00.000Z`;
- the first persisted O00 candidate config is `2026-08-09T22:00:00.000Z`;
- the original O23 candidate config is `2026-08-10T21:00:00.000Z`;
- EA5D3 became effective only at `2026-08-10T03:04:23.000Z`;
- EA5E candidate work was therefore not authorized at O00 through O05;
- the Formal database still had zero scheduler slots and zero scheduler cursor rows.

EA5E0 correctly rejected the original persisted O00–O23 config epoch as a Formal-window start authority. The rejection does **not** invalidate the earlier External A0 bootstrap proof, raw-retention proof, canonical External Evidence, or EA5D historical exact-head evidence.

The correction must therefore be append-only and narrower than a new bootstrap.

A second timing constraint is also material. The effective EA2 Formal Crop Context Authority requires fresh startup re-derivation from the frozen planting-day uncertainty and all frozen FAO-56 maize variants, carrying the 6-hour backward stability and 30-hour forward transition guard. A rebased epoch must therefore be selected early enough that every one of its O00–O23 slot contexts remains conservatively derivable. A stale A0 crop-context hash may not be silently reused merely because A0 remains the Runtime-state parent.

## 2. Core ruling

The existing External A0 canonical bootstrap remains the authoritative pre-window Runtime state.

The original 24 hourly Runtime Config objects from the expired epoch remain immutable historical facts but are permanently **superseded for Formal-window start**. They may not be selected by a later Formal Window Input Manifest.

A new Formal window epoch MAY be created by appending exactly 24 new External hourly Runtime Config objects for a future actual-UTC O00–O23 window, with these rules:

1. no new A0 canonical state, lineage, checkpoint, forecast, health, or bootstrap record is created by the epoch rebase;
2. the existing External A0 bootstrap Runtime Config remains the exact parent authority of the rebased O00 config;
3. rebased O01 is the exact child of rebased O00, and so on through rebased O23;
4. every rebased config `effective_logical_time` equals its exact target slot logical time;
5. every rebased ref/hash is frozen and persisted before O00;
6. runner selection remains explicit ref/hash pin only; implicit `latest` selection remains forbidden;
7. old expired configs remain queryable historical evidence but are ineligible for Formal execution;
8. every rebased slot carries a crop-water-use stage context freshly rederived for that slot from the frozen EA2 authority, with no future observation use and with the EA2 6-hour backward / 30-hour forward transition guard intact.

This is a narrow exception to Amendment-05 Section 8 only in one respect: the persisted A0 bootstrap Runtime Config does **not** need an effective logical time exactly one hour before the rebased O00. It remains the semantic parent because no Formal scheduler tick has occurred since A0 and no later canonical Runtime state has superseded it.

It is **not** an exception to EA2 crop-context freshness. The parent A0 config may retain its historical crop-context hash, while the rebased hourly child configs may carry newly derived slot-specific context hashes under the same frozen Formal Crop Context Authority.

## 3. Existing A0 authority that must remain unchanged

The rebase SHALL retain the already-proved External A0 authority exactly:

```text
scope:
tenant_mcft_external
project_mcft_cap09
group_public_research
field_kbs_mcse_t1r1
season_2026_corn
zone_kbs_mcse_t1r1_formal_v1

A0 bootstrap logical time:
2026-08-09T21:00:00.000Z

runtime_mode:
SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY

config_selection_mode:
EXPLICIT_REF_HASH_PIN_ONLY
```

The existing A0 State/lineage/checkpoint authority must remain the current persisted pre-O00 Runtime state until the rebased O00 executes successfully.

No deletion, update-in-place, projection reset, or bootstrap replay is authorized.

## 4. Epoch selection rule

The exact rebased O00 time is **not** frozen by this architecture amendment.

After Amendment-06 becomes effective, a separate exact-head epoch-selection authority SHALL choose:

```text
candidate O00 = first exact UTC hourly boundary at or after
                Amendment-06 effectiveness time + 36 hours

O23 = O00 + 23 hours
```

The candidate becomes the selected epoch only if it also satisfies every rule below:

- O00 is still in the future when the selection authority becomes effective;
- all 24 target logical times are exact UTC hours;
- no selected slot overlaps the expired original epoch;
- the epoch ID is unique and deterministic from the selected O00;
- the exact selected O00/O23 times are frozen in protected-main authority before any rebased config is persisted;
- for **every** slot O00–O23, the frozen EA2 crop-context algorithm is re-evaluated at that slot logical time;
- for every slot, every frozen FAO-56 maize variant and every possible planting time must agree on one identical allowed stage throughout `slot_time - 6h` through `slot_time + 30h`;
- future observations, future phenocam observations, ex-post season normalization, single-region best-fit substitution, and CAP08 synthetic stage dates remain forbidden;
- if any slot fails the EA2 conservative consensus or transition guard, that candidate epoch is ineligible and must not be frozen.

The 36-hour minimum is a governance safety lead, not a simulated clock. It leaves at least 24 hours between Amendment-06 effectiveness and the `O00 - 12h` Authority-V3 deadline when the first candidate is selected on the next exact UTC boundary, while still requiring an independent whole-window crop-context viability proof before the epoch can be frozen.

The lead must not be increased blindly if doing so would cross an EA2 crop-stage consensus/transition boundary. Crop-context viability is a hard eligibility condition, not a reason to relax the actual-UTC clock.

## 5. Readiness deadline and automatic fail-closed expiry

To prevent recurrence of the EA5E0 chronology failure, the rebased epoch has a hard readiness deadline:

```text
EA5E Formal Authority V3 effective deadline = O00 - 12 hours
```

If EA5E Formal Authority V3 is not effective by that deadline:

- the selected epoch becomes automatically ineligible for Formal start;
- O00 remains disabled;
- no retroactive execution or initial multi-slot catch-up is permitted;
- no existing canonical fact is deleted or rewritten;
- a later epoch-selection authority may select another future O00 only if it independently satisfies the same minimum-lead and whole-window EA2 crop-context rules.

A missed readiness deadline is an epoch-selection failure, not a Runtime backfill case.

If no later candidate can satisfy the frozen EA2 crop-context consensus, the lifecycle must fail closed for further adjudication rather than fabricate a crop stage.

## 6. Rebased Runtime Config chain

The rebase implementation SHALL construct exactly 24 new `HOURLY_CAP04` External Runtime Config objects.

For rebased O00:

```text
parent_runtime_config_ref  = existing External A0 bootstrap Runtime Config ref
parent_runtime_config_hash = existing External A0 bootstrap Runtime Config hash
effective_logical_time     = selected O00
```

For rebased O01–O23:

```text
parent = immediately preceding rebased hourly config
effective_logical_time = exact target slot logical time
```

For every rebased slot, the config must carry the stage context freshly derived for that slot under the protected-main EA2 Formal Crop Context Authority. The builder must not copy the A0 `crop_stage_context_hash` merely as an inheritance shortcut. If the 24 slots do not all pass the frozen EA2 derivation policy, A06A must not have frozen that epoch and A06B must fail closed.

All other External Formal authority fields remain governed by Amendment-05 and the already-frozen EA2/EA4/EA5 authority profile:

- exact six-key External scope;
- External Formal Reality Binding;
- External Formal Source Binding Matrix;
- External Formal Crop Context Authority;
- `MODEL_PRIOR_FROM_CAP08 / NOT_FIELD_CALIBRATED`;
- `POINT_100MM...` soil authority;
- no C8 scope;
- no Replay Runtime mode;
- no `CONTROLLED_SYNTHETIC_REPLAY_PROXY` canonical truth marker;
- no historical 200-mm observation operator.

## 7. Append-only persistence rule

The current Formal database contains one A0 Runtime Config plus the 24 expired hourly configs.

A successful single rebase persistence SHALL append exactly 24 new Runtime Config facts and no other canonical objects.

Expected post-rebase configuration inventory, absent unrelated authorized writes:

```text
1 existing A0 Runtime Config
24 expired historical hourly Runtime Configs
24 rebased future hourly Runtime Configs
= 49 Runtime Config facts total
```

The rebase write boundary is therefore:

```text
new Runtime Config writes = exactly 24
new Evidence writes       = 0
new A0 member writes      = 0
new scheduler slot writes = 0
new scheduler cursor writes = 0
new lineage/checkpoint/state/forecast writes = 0
provider requests         = 0
raw object writes         = 0
```

Idempotent exact-head re-verification must produce zero additional writes.

## 8. Formal Window Input Manifest rule

EA5E may resume only after the rebased 24-config chain has been exact-head proved and merged.

The Formal Window Input Manifest SHALL:

- identify the exact rebase epoch ID and selected O00/O23;
- contain exactly 24 rebased slot-to-config ref/hash pins;
- bind each slot to its exact EA2-derived crop-context hash;
- exclude every expired original O00–O23 config ref/hash;
- bind the existing A0 Runtime Config ref/hash as the predecessor authority of rebased O00;
- fail closed if any rebased config is missing, duplicated, has the wrong logical time, wrong parent ref/hash, or wrong crop-context hash;
- remain immutable for the Formal window.

Manual hourly Secret mutation remains forbidden.

## 9. O00 pre-start checks

Before O00 may be enabled, EA5E Authority V3 SHALL prove all of the following against the selected epoch:

- protected-main Amendment-06 and epoch-selection authority are effective;
- the 24 rebased config refs/hashes are persisted and exact-head proved;
- the 24 slot-specific crop contexts still match the frozen A06A whole-window EA2 derivation proof;
- current persisted Runtime state still references the existing External A0 config authority;
- scheduler slot count is still zero;
- scheduler cursor is still absent/unstarted;
- Formal Window Input Manifest contains only the rebased epoch pins;
- collector/runtime schedule ordering leaves the required ingestion margin;
- Formal window enablement remains false until the authorized cutover;
- current wall clock has not crossed O00;
- EA5E Authority V3 became effective no later than O00 minus 12 hours.

Failure of any item keeps O00 disabled.

## 10. Backfill semantics remain unchanged

This amendment does not broaden backfill authority.

The Taskbook still requires one governed intentionally missed slot recovered oldest-first during the actual O00–O23 run. The planned missed-slot exercise remains O11 unless separately changed by later authority.

The following are explicitly **not** backfill:

- original expired O00–O05;
- any slot from a rebase epoch whose readiness deadline was missed;
- any slot before Formal Authority V3 effectiveness;
- any initial multi-slot catch-up used to substitute for an actual 24-hour window.

## 11. Internal correction sequence

The legal successor sequence after Amendment-06 effectiveness is:

1. **A06A — Future Epoch Selection Freeze**  
   Select exact future O00/O23 using the 36-hour minimum lead, prove whole-window EA2 crop-context viability, and freeze the unique epoch ID plus all 24 slot context hashes.
2. **A06B — Rebased Config Builder Qualification**  
   Prove a deterministic 24-config builder whose O00 parent is the existing A0 config, whose remaining parent chain is exact, and whose slot crop-context hashes equal A06A.
3. **A06C — Append-only Rebased Config Persistence**  
   Append exactly 24 new Runtime Config facts; exact-head retry writes zero.
4. **EA5E1 — Post-rebase Formal DB Preflight + Formal Window Input Manifest**
5. **EA5E2 — Collector / Runtime Schedule Readiness**
6. **EA5E3 — Formal Authority V3 effectiveness**
7. only after all readiness rules and the O00 wall-clock boundary are satisfied may actual UTC O00 begin.

No later stage may infer authority from an unmerged predecessor.

## 12. Hard nonclaims

This amendment does not authorize:

- deletion, truncation, rewriting, or hiding of the expired config epoch;
- a new A0 bootstrap;
- a new A0 State/lineage/checkpoint/forecast package;
- stale A0 crop-context reuse as a substitute for fresh slot derivation;
- fabricated crop-stage consensus when EA2 transition guards fail;
- retroactive O00 execution;
- accelerated/replay Formal clock;
- initial multi-slot catch-up as a replacement for the 24-hour run;
- scheduler slot or cursor creation by itself;
- Formal-window enablement by itself;
- Runtime Internet access;
- Recommendation, Approval, AO-ACT, Dispatch, or Model Activation;
- field calibration or direct field/root-zone equivalence;
- MCFT-CAP-09 completion.

## 13. Success effect if this amendment becomes effective

Only after exact-head Gate PASS and merge to protected `main`:

```text
AMENDMENT_06_EFFECTIVE = true
EA5D_COMPLETE remains true
EA5E remains authorized but incomplete
original persisted O00-O23 config epoch remains superseded for Formal start
future epoch selection under A06A becomes authorized
O00 remains unauthorized
Formal window remains unstarted
O00-O23 formal execution count remains 0/24
MCFT-CAP-09 remains incomplete
```

Next legal frontier:

`S6-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-FREEZE`
