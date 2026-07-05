# F2 Empty / Loading / Error State Register

## Phase

F2-D Empty / Loading / Error State Hardening.

## Purpose

No formal surface should fail with a blank page, fake data, spinner-only indefinite state, or misleading production-outage copy.

## Required state vocabulary

Each formal surface must define:

- empty state
- loading state
- error / unavailable state
- replay-backed state
- no-data state
- blocking / non-blocking classification

A state can be present, not applicable, or intentionally inherited from shell/read model behavior. Every registered page must mark whether missing or weak handling is blocking or non-blocking for F2.

## Surface register

| Surface | empty state | loading state | error / unavailable state | replay-backed state | no-data state | blocking / non-blocking |
| --- | --- | --- | --- | --- | --- | --- |
| Customer Dashboard | present | present or inherited | present | not applicable | present | non-blocking if copy is present |
| Customer Fields | present | present or inherited | present | not applicable | present | non-blocking if authorized scope is clear |
| Customer Reports | present | present or inherited | present | not applicable | present | non-blocking if report entry absence is explicit |
| Customer Operations | present | present or inherited | present | not applicable | present | non-blocking if operation absence is explicit |
| Admin Dashboard | present | present or inherited | present | not applicable | present | non-blocking if governance scope is clear |
| Admin Health | present | present or inherited | present | not applicable | present | blocking if health readback hides unavailable state |
| Operator Field Runtime | present | present or inherited | present | present | present | blocking if runtime boundary or no-data state is missing |
| Replay Demo | present | present | present | present | present | blocking if replay-backed state is not visible |
| Pilot Readiness | present | present or inherited | present | present or not applicable | present | blocking if readiness gate absence is ambiguous |

## Extended inherited register

The following formal surfaces inherit the same state vocabulary and must not regress: Customer Field Report, Customer Operation Report, Customer Export, Admin Fields, Admin Operations, Admin Devices, Admin Evidence, Admin Skills, Operator Runtime Overview, Field Runtime Health, and Gateway Demo.

## Empty state rule

Empty state must state what is absent, not invent data, not imply backend failure unless known, and provide a safe next step or explanation where appropriate.

## Loading state rule

Loading state must be visible, not be spinner-only if loading may persist, not claim live monitoring, and not block the route shell. Preferred copy includes Loading review data and Reading available surface data. Chinese equivalents include 正在读取审查数据 and 正在读取可用界面数据.

## Error state rule

Error state must be visible, must not crash the page, must not claim production outage, must not expose stack trace, must not expose raw secret or token, and may offer read-only retry or safe explanation when applicable.

Forbidden error implications include production outage, live monitoring failure, gateway down, and device disconnected unless an actual runtime source proves it.

## Replay-backed state rule

Replay-backed state must be explicit where a surface uses checked-in snapshots or replay-derived data. Replay-backed state must not be described as live runtime state.

## No-data state rule

No-data state must distinguish empty authorized data, unavailable data, not configured data, and replay-backed data absence. No-data state must not be described as a successful operational result.

## Blocking rule

Blocking items prevent F2 completion when they hide safety boundary, replay-backed status, read-only status, or no-data state. Non-blocking items may remain registered when the page clearly communicates absence and does not invent data.

## Unavailable state rule

Unavailable state must distinguish not implemented, not available in this replay-backed baseline, not authorized, not configured, and data absent. It must not describe not implemented as failed.

## Acceptance hooks

The F2 acceptance gate checks this register for empty state, loading state, error / unavailable state, replay-backed state, no-data state, blocking / non-blocking, no fake data, no production outage claim, and no stack trace exposure.

## Non-goals

No backend health assertion. No live runtime outage claim. No production service status claim.
