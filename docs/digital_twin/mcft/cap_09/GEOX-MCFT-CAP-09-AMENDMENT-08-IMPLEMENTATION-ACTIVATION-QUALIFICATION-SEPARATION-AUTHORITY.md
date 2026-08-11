# GEOX MCFT-CAP-09 Amendment-08 — Implementation / Operational Activation Qualification Separation Authority

Status: Candidate amendment; not effective until exact-head governance proof passes and this candidate merges to protected `main`.

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Frontier correction: `S6-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY`

Base protected main at candidate start: `4fc792398bcc25243af7c63734fe59beec9b0dcc`

## 1. Purpose

This amendment corrects a lifecycle coupling exposed by the EA5E2 real-provider readiness attempt.

The current EA5E2 implementation candidate can prove deterministic software, governance, collector, scheduler, persistence-boundary, private-retention and DB-only Runtime behavior while a third-party provider is temporarily outside its frozen freshness authority. Under the pre-Amendment-08 interpretation, the same real-provider observation window also blocks the software candidate from entering protected `main`.

That coupling is not required to preserve Formal safety. The correct safety boundary is:

```text
software implementation qualification
    !=
operational activation qualification
```

A provider outage may prevent the External Formal path from becoming operationally eligible. It must not, by itself, require already-qualified software to remain indefinitely on an unmerged feature branch.

This amendment therefore separates the two qualifications while retaining every frozen live-source, causality, source-binding, fixed-lag, crop-context, epoch-readiness and fail-closed requirement for activation.

## 2. Authority precedence and narrow scope

When effective, Amendment-08 supersedes only the MCFT-CAP-09 S6 lifecycle interpretation that requires a successful real-provider live qualification before an implementation candidate may merge.

It does **not** supersede or weaken:

- the effective MCFT-CAP-09 Taskbook;
- Amendment-01 source identity and epistemic boundaries;
- Amendment-05 External Formal Runtime Authority Profile;
- Amendment-06 epoch rebase, 36-hour minimum-lead intent, O00-12h readiness deadline, immutable-history and fail-closed expiry rules;
- Amendment-07 fixed-lag External Formal causality;
- EA4 KBS Raw Hourly maximum age of 6 hours;
- EA5E1 explicit Runtime Config ref/hash pinning and immutable Formal Window Input Manifest rules;
- exact five-family source binding;
- actual UTC clock semantics;
- no accelerated clock, timestamp relabeling, interpolation, persistence fill, cross-cycle substitution or source substitution;
- append-only Formal persistence;
- Recommendation / Approval / AO-ACT / Dispatch boundaries.

This amendment creates no Runtime, scheduler, database, raw-object or provider side effect by itself.

## 3. Two independent qualification classes

### 3.1 Implementation Qualification

`IMPLEMENTATION_QUALIFIED` is a software-delivery qualification.

It MAY become true for an implementation candidate only when the exact candidate head proves all deterministic and repository-controlled obligations applicable to that candidate, including as applicable:

- exact changed-file boundary;
- Delivery Policy and Main Ruleset;
- build / typecheck / repository selfcheck;
- acceptance suite and Commercial MVP0 release gate;
- fixed-lag scheduler semantics;
- exact-hour late-cutoff semantics;
- historical Replay regressions remain unchanged;
- exact five-family collector composition;
- private raw-retention boundary and public-artifact restrictions;
- restricted append-only ingress seam;
- DB-only Runtime Evidence source;
- DB-source to External CAP04 candidate path;
- fail-closed behavior for missing or invalid Evidence;
- zero Formal DB / Formal raw-prefix / scheduler / canonical Runtime writes during readiness qualification.

A temporary external-provider freshness failure is not, by itself, an implementation defect when all repository-controlled obligations pass and the candidate fails closed exactly as frozen authority requires.

Implementation Qualification MUST NOT claim:

- provider availability;
- current operational readiness;
- Formal eligibility;
- EA5E2 operational effectiveness;
- EA5E3 effectiveness;
- O00 start authority;
- Formal execution completion.

### 3.2 Operational Activation Qualification

`OPERATIONAL_ACTIVATION_QUALIFIED` is a protected-main, real-world qualification.

It may become true only after the implementation under test is already effective on protected `main` and one exact protected-main SHA completes the real-provider qualification under actual UTC.

The qualification must prove, without weakened thresholds or substitute sources:

```text
real KBS/GFS provider GET
-> private raw retention before decode
-> exact five-family canonicalization
-> restricted isolated qualification ingress
-> isolated PostgreSQL
-> DB-only External Evidence source
-> External CAP04 candidate
```

and the Amendment-07 wall-clock profile for one real target `T`:

```text
pre-boundary collector target     = T - 00:30
late exact-hour collector         = T + 06:30
scheduler eligibility             = T + 07:00
late exact-hour evidence cutoff   = T + 07:12
Runtime observer nominal          = T + 07:17
minimum ingestion margin          = 5 minutes
```

The frozen KBS Raw Hourly freshness authority remains:

```text
latest KBS Raw Hourly age <= 6 hours
```

Operational Activation Qualification fails closed on provider staleness, missing exact target hour, wrong source, wrong cycle, insufficient ingress margin, wrong scope, wrong hash, wrong epoch/config binding, or any forbidden time/source manipulation.

## 4. Merge authority after this amendment

After Amendment-08 becomes effective, a successor EA5E2 implementation candidate MAY merge to protected `main` without a passing live-provider activation qualification only if all of the following are true:

1. its exact-head Implementation Qualification passes;
2. any live-provider failure is classified only as external operational unavailability or source freshness and the software fails closed correctly;
3. the candidate does not claim `OPERATIONAL_ACTIVATION_QUALIFIED`;
4. the candidate does not authorize Formal O00;
5. Formal DB, Formal raw-prefix, scheduler and canonical Runtime writes remain zero;
6. no freshness threshold, scheduler lag, late cutoff, observer offset, source identity, source cycle, event time or Runtime Config pin is weakened or relabeled to obtain mergeability.

The merge is therefore authority to deploy the implementation, not authority to activate the Formal window.

## 5. Protected-main operational qualification rule

The real-provider qualification SHALL run against one exact protected-main commit SHA.

It must not depend on an unmerged feature-branch SHA as the lasting operational authority.

A PASS record must freeze at minimum:

- protected-main subject SHA;
- provider observation timestamps;
- KBS latest timestamp and computed age;
- exact target `T`;
- pre-boundary and delayed-phase timestamps;
- exact same-cycle GFS identity;
- private-retention receipt/hash metadata;
- isolated qualification database evidence hashes;
- DB-only Runtime proof;
- source-substitution count = 0;
- timestamp-relabel count = 0;
- Formal database write count = 0;
- Formal raw-prefix write count = 0;
- Formal scheduler write count = 0;
- Formal canonical Runtime write count = 0.

A later protected-main code change that mutates the qualified implementation boundary invalidates the earlier activation qualification for the mutated path and requires requalification.

## 6. Epoch ordering correction for successor epochs

For any successor epoch after a selected epoch has become ineligible, the legal ordering is now:

```text
Implementation Qualification effective on protected main
-> Operational Activation Qualification PASS on protected main
-> whole-window crop-context viability scan
-> successor epoch-selection authority
-> rebased Runtime Config builder/persistence as required
-> Formal DB preflight + immutable manifest
-> EA5E3 Formal Authority V3 effectiveness
-> actual UTC O00
```

A successor epoch-selection authority MUST NOT freeze a new O00 unless:

- Operational Activation Qualification is already effective for the protected-main implementation to be used;
- the candidate O00 satisfies Amendment-06 minimum-lead requirements;
- the candidate's `O00 - 12h` EA5E3 readiness deadline is still in the future when the epoch-selection authority becomes effective;
- every O00-O23 slot independently satisfies the frozen EA2 crop-context algorithm and its `T-6h ... T+30h` guard;
- all 24 exact UTC slot identities and context hashes are frozen before persistence;
- Formal execution remains `0/24` before authorized O00.

If no candidate satisfies those conditions, the lifecycle fails closed for further crop-context / season adjudication. No stage may be fabricated or prolonged solely to preserve a desired window.

## 7. Current selected epoch handling

The currently frozen A06A epoch remains immutable historical authority:

```text
epoch_id = mcft_cap09_external_formal_window_epoch_20260811t170000z_v1
O00      = 2026-08-11T17:00:00.000Z
O23      = 2026-08-12T16:00:00.000Z
EA5E3 readiness deadline = 2026-08-11T05:00:00.000Z
```

Amendment-08 does not extend, move, relabel or rescue this epoch.

If EA5E Formal Authority V3 is not effective by its existing readiness deadline, Amendment-06 automatic fail-closed expiry applies unchanged:

- the epoch is ineligible for Formal start;
- O00 remains disabled;
- no retroactive execution is permitted;
- no initial multi-slot catch-up is permitted;
- no existing canonical fact is deleted or rewritten.

Amendment-08 MUST NOT be interpreted as authority to merge the old epoch itself into eligibility.

## 8. Current crop-context consequence

The effective A06A proof records all 24 selected slots as conservative `MID` and records only 6 hours of minimum forward-guard clearance at O23.

Therefore successor epoch selection must be based on a fresh read-only whole-window scan. It is forbidden to assume that simply moving O00 later by one day remains crop-context eligible.

If the frozen current-season crop authority cannot provide another complete 24-slot candidate after the required operational qualification and readiness lead, the correct result is:

```text
NO_CURRENT_SEASON_SUCCESSOR_EPOCH
-> fail closed
-> separate crop-context / season architecture adjudication
```

not stage extension, future observation leakage, synthetic stage dates or shortened Formal duration.

## 9. EA5E2 semantics after Amendment-08

After Amendment-08 becomes effective, EA5E2 has two separately named states:

```text
EA5E2_IMPLEMENTATION_QUALIFIED
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED
```

`EA5E2_IMPLEMENTATION_QUALIFIED=true` may authorize implementation merge.

It does not authorize EA5E3.

EA5E3 may proceed only after:

```text
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED=true
```

and a currently eligible successor epoch, config chain, database preflight and immutable manifest all satisfy their own authority.

## 10. Nonclaims and forbidden rescue paths

Amendment-08 does not authorize:

- KBS freshness threshold > 6h;
- scheduler eligibility lag inflation beyond the frozen profile;
- earlier fake `available_to_runtime_at` or `ingested_at`;
- provider timestamp relabeling;
- source substitution;
- cross-cycle GFS substitution;
- accelerated or replay Formal clock;
- synthetic provider success;
- treating an isolated qualification database as Formal persistence;
- treating transient readiness R2 as Formal raw persistence;
- reusing an expired epoch as a backfill case;
- shortening the required 24-slot Formal window;
- fabricating crop-stage consensus;
- Formal O00 start;
- Recommendation, Approval, AO-ACT or Dispatch;
- MCFT-CAP-09 completion.

## 11. Effect if exact-head proof passes and this amendment merges

Only after exact-head governance proof passes and this candidate merges to protected `main`:

```text
amendment_08_effective = true
implementation_and_operational_activation_qualification_separated = true
implementation_qualification_may_authorize_merge = true
operational_activation_qualification_requires_protected_main = true
kbs_raw_hourly_max_age_hours = 6
scheduler_eligibility_lag_hours = 7
late_exact_interval_cutoff_offset_minutes = 432
runtime_observer_offset_minutes = 437
source_substitution_authorized = false
time_relabeling_authorized = false
accelerated_formal_clock_authorized = false
current_selected_epoch_extended = false
formal_o00_start_authorized = false
formal_window_started = false
formal_execution_count = 0/24
ea5e3_effective = false
MCFT-CAP-09 completed = false
```

Next legal successor:

```text
S6-EA5E2-IMPLEMENTATION-QUALIFICATION-REBASE-UNDER-AMENDMENT-08
```

The existing EA5E2 implementation candidate must be rebased or otherwise re-bound to effective Amendment-08 authority before merge. Its previous live-provider failure may be retained as evidence of correct fail-closed operational behavior, but it is not an activation PASS.
