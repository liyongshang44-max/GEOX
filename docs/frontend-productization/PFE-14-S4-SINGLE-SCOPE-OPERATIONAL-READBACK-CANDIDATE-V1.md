# PFE-14 S4 Single-Scope Operational Readback Candidate v1

Status: IMPLEMENTED CANDIDATE / PFE-14 S4 NOT EFFECTIVE

## Scope

This candidate consumes the qualified MCFT-9 operational provider on the existing exact-Scope Field Runtime Overview.

It adds no new frontend route and does not change the current Runtime Context claim.

## Data flow

The existing canonical Runtime root remains the source of the exact six-key `request_scope`.

Only after that root is available, the overview mounts an independent operational readback panel which calls:

`GET /api/v1/operator/twin/fields/:field_id/runtime/operational-summary`

The operational panel has its own loading/error/ready state. A provider failure cannot cause Replay/fixture values to be used as Scheduler or Evidence data and does not erase an otherwise successful canonical Runtime root read.

## Visible server-owned fields

Scheduler:

- scheduler status;
- latest terminally resolved boundary and terminal status;
- next target boundary;
- server-computed lag in milliseconds;
- latest tick completion time;
- latest tick start only when returned. Current provider intentionally returns null rather than substituting scheduler claim time.

Evidence:

- exact eligibility boundary;
- server freshness verdict;
- freshest observed / latest ingested time;
- boundary-relative Evidence age;
- server threshold;
- raw coverage ratio;
- maximum gap;
- future / late / out-of-order counts.

The browser does not convert the raw ratio to a percentage or calculate a competing age/freshness verdict.

## O00-O23 strip

The 24 labels are structural product labels, not Runtime values.

Only `eligibility_boundary.slot_id`, when returned by the server, is marked. No other per-slot state, completion, health, freshness or backfill status is inferred.

## Nonclaims

- Runtime mode remains `READ_ONLY_DETERMINISTIC_REPLAY` in the existing page boundary;
- no Shadow-online label is introduced;
- no restart/recovery history is introduced;
- no browser clock participates in operational semantics;
- no recommendation, approval, AO-ACT, dispatch, Model Activation or write capability is introduced;
- PFE-14 S4 is not declared effective.
