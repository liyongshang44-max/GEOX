# F2 Empty / Loading / Error State Register

## Phase

F2-D Empty / Loading / Error State Hardening.

## Purpose

No formal surface should fail with a blank page, fake data, spinner-only indefinite state, or misleading production-outage copy.

## Required state vocabulary

Each formal surface must register whether it covers or inherits these states:

- loading
- empty
- error
- unavailable
- not authorized
- not configured
- read-only boundary

A state can be present, not applicable, or intentionally inherited from shell/read model behavior.

## Surface register

| Surface | loading | empty | error | unavailable | not authorized | not configured | read-only boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customer Dashboard | present or inherited | present | present | present | inherited | not applicable | inherited |
| Customer Fields | present or inherited | present | present | present | present | not applicable | inherited |
| Customer Field Report | present or inherited | present | present | present | present | not applicable | inherited |
| Customer Operations | present or inherited | present | present | present | present | not applicable | inherited |
| Customer Operation Report | present or inherited | present | present | present | present | not applicable | inherited |
| Customer Reports | present or inherited | present | present | present | present | not applicable | inherited |
| Customer Export | present or inherited | present | present | present | present | not applicable | inherited |
| Admin Dashboard | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Fields | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Operations | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Devices | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Evidence | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Health | present or inherited | present | present | present | not applicable | present | inherited |
| Admin Skills | present or inherited | present | present | present | not applicable | present | inherited |
| Operator Runtime Overview | present or inherited | present | present | present | not applicable | present | inherited |
| Field Runtime | present or inherited | present | present | present | not applicable | present | inherited |
| Replay-backed Gateway Demo | present or inherited | present | present | present | not applicable | present | inherited |
| Pilot Readiness | present or inherited | present | present | present | not applicable | present | inherited |

## Empty state rule

Empty state must state what is absent, not invent data, not imply backend failure unless known, and provide a safe next step or explanation where appropriate.

## Loading state rule

Loading state must be visible, not be spinner-only if loading may persist, not claim live monitoring, and not block the route shell. Preferred copy includes Loading review data and Reading available surface data. Chinese equivalents include 正在读取审查数据 and 正在读取可用界面数据.

## Error state rule

Error state must be visible, must not crash the page, must not claim production outage, must not expose stack trace, must not expose raw secret or token, and may offer read-only retry or safe explanation when applicable.

Forbidden error implications include production outage, live monitoring failure, gateway down, and device disconnected unless an actual runtime source proves it.

## Unavailable state rule

Unavailable state must distinguish not implemented, not available in this replay-backed baseline, not authorized, not configured, and data absent. It must not describe not implemented as failed.

## Acceptance hooks

The F2 acceptance gate checks this register for loading, empty, error, unavailable, not authorized, not configured, read-only boundary, no fake data, no production outage claim, and no stack trace exposure.

## Non-goals

No backend health assertion. No live runtime outage claim. No production service status claim.
