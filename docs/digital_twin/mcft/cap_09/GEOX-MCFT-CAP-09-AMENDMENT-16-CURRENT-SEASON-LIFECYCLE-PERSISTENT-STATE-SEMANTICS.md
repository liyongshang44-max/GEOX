# GEOX MCFT-CAP-09 Amendment-16 — Current Season Lifecycle Persistent-State Semantics

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Authority layer: `S6-CURRENT-SEASON-LIFECYCLE-PERSISTENT-STATE-SEMANTICS-ADJUDICATION`

Exact base protected main: `23f224c701dbe0b8bd56eceff3741cb1c3dc1f78`

## 1. Purpose

This amendment corrects the state semantics of `season_lifecycle_authority` without weakening provider-evidence discipline.

The existing line correctly rejects provider silence as lifecycle evidence. That rule remains authoritative. The defect is a separate implication that has emerged in successor logic: an already-authoritatively established management-season lifecycle is effectively forced back to `UNRESOLVED` merely because a fresh positive crop observation is not continuously available.

That is appropriate for snapshot variables such as weather or soil moisture. It is not the correct semantics for a persistent management-season state.

The corrected model is:

```text
observation freshness
!=
lifecycle state continuity
```

A provider that emits no new row does not prove the crop remains biologically alive, does not create a new observation, does not refresh any observation timestamp, and does not establish provider coverage completeness. At the same time, provider silence does not itself erase or terminate an already-authoritative lifecycle state.

## 2. Narrow relationship to Amendment-13 and Amendment-15

This amendment does not supersede Amendment-13 or Amendment-15 as a whole.

Amendment-13 remains authoritative that:

- management-season lifecycle is independent from biological vitality;
- lifecycle, phenology stage, and crop-model parameter authority are separate axes;
- phenology or Kc may not establish lifecycle;
- all paths remain fail-closed.

Amendment-15 remains authoritative that:

- HTTP retrieval time is not provider coverage time;
- provider silence is not an observation;
- provider silence is not a coverage watermark;
- absence of a Harvest/Termination row does not prove no such real-world event occurred;
- event time, availability time, and ingestion time may not be relabelled.

Amendment-16 adds one clarification only:

```text
Provider silence MUST NOT establish, refresh, or extend any observation-derived authority.

This prohibition does not prevent an already-authoritative management lifecycle state
from persisting under an explicitly governed state-transition contract.
```

Such persistence creates no provider observation, changes no original event time, refreshes no observation freshness, consumes only legally available authoritative transitions, fails closed on authoritative contradiction, terminates on a governed terminating transition, and becomes unusable when its governed horizon expires.

## 3. Three-layer state model

`ACTIVE`, `TERMINATED`, `UNRESOLVED`, `CONFLICTED`, and `EXPIRED` must not be collapsed into one enum because they describe different dimensions.

The governed lifecycle result is three-layered:

```text
season_lifecycle = {
  domain_state: NOT_ESTABLISHED | ACTIVE | TERMINATED,
  authority_status: RESOLVED | UNRESOLVED | CONFLICTED,
  authority_validity: VALID | EXPIRED
}
```

Interpretation rules:

- `domain_state` records the last legally established management-lifecycle state under the authoritative transition log;
- `authority_status` records whether the lifecycle state is currently resolvable for the requested evaluation;
- `authority_validity` records whether the authority remains within its governed bounded horizon.

A domain state may be retained for provenance even when it is no longer consumable. Therefore, after horizon expiry, a result may preserve:

```text
domain_state = ACTIVE
authority_status = UNRESOLVED
authority_validity = EXPIRED
```

This does **not** mean the crop is asserted ACTIVE now. It means the last legally established domain state was ACTIVE, but current ACTIVE consumption is forbidden because the authority horizon expired.

`EXPIRED` is never a fabricated real-world crop transition.

## 4. Authority-consumption rule

A current ACTIVE lifecycle is consumable only when all three dimensions are eligible:

```text
domain_state == ACTIVE
AND authority_status == RESOLVED
AND authority_validity == VALID
```

EA5E2 and successor readiness must use this three-part condition. A stale direct biological observation may coexist with a consumable persistent lifecycle state; any downstream action that separately requires fresh biological observation remains free to fail closed on that independent requirement.

## 5. Time semantics

For every establishment, support, termination, or contradiction fact, preserve:

```text
event_time
available_to_runtime_at
ingested_at  # when persistence exists
```

For lifecycle evaluation preserve separately:

```text
state_evaluation_time
authority_evaluated_at
```

`state_evaluation_time` answers which world-time instant the lifecycle state is being evaluated for.

`authority_evaluated_at` answers when GEOX is legally evaluating the available evidence set.

Neither may be emitted as a provider observation timestamp.

A late-arriving historical transition may change a later authority evaluation while prior append-only runtime decisions remain immutable.

## 6. Authoritative establishment

A persistent lifecycle may enter ACTIVE only from an authoritative lifecycle establishment event.

For the current MCFT-CAP-09 maize path, `Planting` is the primary authorized establishment class.

A qualifying establishment requires at minimum:

- exact crop-season identity;
- governed field/plot/formal-scope binding;
- provider-origin fact;
- real event time;
- real availability chronology;
- event within the governed season scope;
- no cross-season or cross-field stitching.

A later Herbicide Application or other management event cannot substitute for missing establishment.

## 7. Persistent ACTIVE semantics

After establishment is legally available, ACTIVE may persist across evaluations without a new provider observation.

The correct logical form is:

```text
PERSISTENT_ACTIVE(T, R) =
    ESTABLISHMENT_AVAILABLE_BY(R)
    AND establishment.event_time <= T
    AND no KNOWN authoritative terminating transition
        with event_time <= T and available_to_runtime_at <= R
    AND no KNOWN authoritative contradiction
        with event_time <= T and available_to_runtime_at <= R
    AND scope identity remains valid
    AND governed lifecycle horizon remains valid at T
```

This is a state-machine evaluation over the authoritative transition set known and legally available at runtime. It is not a claim that GEOX proved no unrecorded real-world termination occurred.

Required wording distinction:

```text
KNOWN_TERMINATION = NONE_FOUND
```

is permitted.

```text
PROVED_NO_TERMINATION_OCCURRED
```

is forbidden unless a separate completeness authority actually proves that stronger proposition.

## 8. Support events

A later compatible management event may be retained as `IN_SEASON_CONTINUITY_SUPPORT`.

It may:

- strengthen provenance continuity;
- update `last_support_event_id` and `last_support_event_time`;
- demonstrate a later compatible managed-season action.

It may not, by itself:

- establish lifecycle when establishment is absent;
- create a biological observation;
- refresh `latest_direct_biological_observation_at`;
- renew the lifecycle horizon;
- prove current ACTIVE through provider silence.

Normative rule:

```text
SUPPORT_EVENT_MAY_RENEW_LIFECYCLE_HORIZON = false
```

unless a future separately governed horizon authority explicitly defines a renewal class.

## 9. Termination classes

The following evidence-driven classes may terminate an established lifecycle when source, scope, event-time, availability, crop/season binding, and transition semantics are separately qualified:

- `HARVEST`;
- `CROP_DESTRUCTION`;
- `CROP_FAILURE` when explicitly lifecycle-terminating;
- `ABANDONMENT` when explicitly lifecycle-terminating;
- `EXPLICIT_SEASON_TERMINATION`.

`FORMAL_SEASON_CLOSE` and maximum lifecycle horizon do not fabricate a termination event. They expire current ACTIVE authority consumption unless separately defined as an explicit provider/domain termination fact.

## 10. Contradiction semantics

A later authoritative fact that conflicts with the currently represented crop/season/scope without a legal transition path makes:

```text
authority_status = CONFLICTED
```

and current lifecycle consumption fails closed.

Conflict does not authorize silent relabelling, cross-season stitching, or automatic successor selection.

## 11. Maximum lifecycle horizon

Persistent ACTIVE may never be unbounded.

A lifecycle evaluation requires a governed horizon authority. Allowed horizon-source precedence is:

1. explicit Formal season-close authority;
2. explicit governed crop-season `hard_stop_at`;
3. separately governed conservative agronomic maximum envelope;
4. otherwise horizon authority is unresolved.

A horizon source may only **truncate** ACTIVE persistence. It may never create ACTIVE.

For maize-grain scopes already governed by the frozen EA1J six-variant stage-length envelope, Amendment-16 permits the maximum total duration of the complete frozen envelope to be used as a conservative maximum lifecycle-horizon candidate, provided the successor qualification pins the exact EA1J authority, retains the complete planting-time uncertainty, and uses the latest possible planting instant plus the maximum total duration.

Frozen EA1J variants:

```text
[30,50,60,40] = 180 days
[25,40,45,30] = 140 days
[20,35,40,30] = 125 days
[20,35,40,30] = 125 days
[30,40,50,30] = 150 days
[30,40,50,50] = 170 days
```

Therefore:

```text
EA1J_MAXIMUM_MAIZE_GRAIN_ENVELOPE_DAYS = 180
```

This value is **not** a prediction of harvest, maturity, or biological survival. Its only allowed lifecycle effect is an upper-bound safety stop. Phenology still may not establish lifecycle.

## 12. Observation freshness remains independent

Runtime may legally emit, for example:

```text
season_lifecycle.domain_state = ACTIVE
season_lifecycle.authority_status = RESOLVED
season_lifecycle.authority_validity = VALID
season_lifecycle.authority_mode = GOVERNED_PERSISTENT_STATE

latest_direct_biological_observation_at = <older timestamp or null>
biological_observation_freshness = STALE
```

This is not contradictory. It states that the management-season lifecycle is authoritative under governed persistent-state semantics while no fresh direct biological observation is claimed.

## 13. Lifecycle / phenology / Kc ordering

The mandatory direction remains:

```text
REALITY / TRANSITIONS
        ->
LIFECYCLE AUTHORITY
        ->
PHENOLOGY-STAGE AUTHORITY
        ->
KC AUTHORITY
        ->
CAP04
```

Forbidden reverse inference:

```text
FAO stage says MID
=> therefore lifecycle ACTIVE
```

After lifecycle ACTIVE is independently consumable, the existing frozen six-variant resolver may evaluate stage. If the complete uncertainty set is `{MID}`, stage may resolve to MID. If it is `{MID,LATE}`, lifecycle may remain ACTIVE while stage remains unresolved.

Only a separately governed resolved singleton stage may map to the existing governed Kc value.

## 14. Runtime provenance

A successor lifecycle resolver must preserve at least:

```text
season_lifecycle_domain_state
season_lifecycle_authority_status
season_lifecycle_authority_validity
season_lifecycle_authority_mode
season_lifecycle_authority_ref
season_lifecycle_establishment_event_id
season_lifecycle_establishment_event_time
season_lifecycle_establishment_available_to_runtime_at
season_lifecycle_last_support_event_id
season_lifecycle_last_support_event_time
season_lifecycle_evaluated_at
season_lifecycle_authority_evaluated_at
season_lifecycle_termination_event_id
season_lifecycle_termination_event_time
season_lifecycle_termination_available_to_runtime_at
season_lifecycle_horizon_end
season_lifecycle_horizon_authority_ref
latest_direct_biological_observation_at
```

`season_lifecycle_evaluated_at` must never be output as `observed_at`.

## 15. Authority mode

The lifecycle authority mode vocabulary must distinguish at least:

- `DIRECT_EVENT`;
- `GOVERNED_PERSISTENT_STATE`;
- `MODEL_DERIVED`;
- `OBSERVED`.

For an ACTIVE evaluation after an establishment event with no later governing transition:

```text
authority_mode = GOVERNED_PERSISTENT_STATE
```

This is neither model inference nor provider-silence inference.

## 16. Hard prohibitions

The successor MUST NOT:

1. treat HTTP 200 or no new provider row as lifecycle refresh;
2. create an observation from provider silence;
3. rewrite establishment event time;
4. turn a management event into a biological observation without separate semantics;
5. use GDD/FAO stage to establish crop existence;
6. use planned satellite acquisition to establish lifecycle;
7. state that no Harvest row proves no harvest occurred;
8. persist ACTIVE without a bounded governed horizon;
9. persist across season identity changes;
10. stitch lifecycle across field/plot scope;
11. reuse T1R1 lifecycle authority for T3R1;
12. emit `evaluated_at=T` as `observed_at=T`;
13. renew horizon from a support event unless separately authorized;
14. rewrite prior append-only decisions after a late-arriving historical transition.

## 17. Required acceptance matrix

The exact-head acceptance must prove at least:

- A01 authoritative establishment -> ACTIVE;
- A02 provider silence preserves ACTIVE but does not refresh observation time;
- A03 support event without establishment cannot establish ACTIVE;
- A04 harvest terminates;
- A05 explicit destruction/failure terminates;
- A06 Formal season close prevents current ACTIVE consumption without fabricating termination;
- A07 maximum horizon expiry prevents current ACTIVE consumption;
- A08 contradiction fails closed as CONFLICTED;
- A09 stage may not establish lifecycle;
- A10 lifecycle remains ACTIVE while stage set `{MID,LATE}` remains unresolved;
- A11 lifecycle ACTIVE + singleton `{MID}` resolves MID;
- A12 lifecycle ACTIVE + MID mapping resolves Kc `1.15`;
- A13 late establishment availability does not authorize retroactive runtime use;
- A14 late termination arrival terminates later evaluations without rewriting earlier decisions;
- A15 support does not renew horizon;
- A16 horizon expiry is not a termination event;
- A17 HTTP 200 with no new rows changes no lifecycle/observation/horizon provenance.

## 18. T3R1 is a successor qualification target, not an exception

This amendment creates no T3R1-specific ACTIVE authority.

After effectiveness, T3R1 may be the first real qualification target under the general semantics. That successor must independently prove:

- authoritative 2026 P0306Q planting establishment and exact scope binding;
- transition sweep over legally available termination classes;
- contradiction sweep;
- governed horizon validity;
- exact event-time / availability chronology;
- no cross-scope stitching.

Only after that successor passes may T3R1 emit:

```text
season_lifecycle.domain_state = ACTIVE
season_lifecycle.authority_status = RESOLVED
season_lifecycle.authority_validity = VALID
authority_mode = GOVERNED_PERSISTENT_STATE
```

The successor may then reuse the existing frozen stage and Kc authorities within their exact legal scope.

## 19. No operational effect in this amendment

Amendment-16 itself performs no live provider qualification and authorizes no Formal rebind, no EA5E2 activation, no database/runtime/scheduler/Formal writes, and no Formal O00 start.

The next frontier after Amendment-16 effectiveness is:

`T3R1_CURRENT_SEASON_PERSISTENT_LIFECYCLE_QUALIFICATION`
