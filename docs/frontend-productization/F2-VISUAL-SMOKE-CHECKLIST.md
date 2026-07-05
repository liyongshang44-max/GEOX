# F2 Visual Smoke Checklist

## Phase

F2-E Visual Screenshot Checklist.

## Purpose

Key formal routes can be visually inspected with a stable checklist before frontend freeze.

This checklist does not introduce automated visual regression tooling or screenshot dependencies.

## Checklist protocol

Each route should be inspected at 1440px, 1280px, 768px, and 390px where practical.

For each screenshot, check no mojibake, no internal phase labels, no formal nav pollution, language toggle visible, layout readable, and nonclaims visible where required.

Additional checks: page renders, no blank screen, shell visible, primary nav visible or alternative visible, title visible, main content visible, no obvious overflow, and no overlapping cards.

## Required route checklist

- Customer Dashboard: Customer shell, Customer Dashboard title, authorized scope boundary.
- Customer Fields: Customer shell, Customer Fields title, field access boundary.
- Customer Reports: Customer shell, Customer Reports title, report access boundary.
- Admin Dashboard: Admin shell, Admin Dashboard title, governance boundary.
- Admin Health: Admin shell, Admin Health title, runtime health readback boundary.
- Operator Runtime Overview: Operator shell, Operator Runtime Overview title, runtime nonclaim banner.
- Operator Fields: Operator shell, Operator Fields route, field list or empty state visible.
- Operator Field Runtime Detail: Operator shell, Field Runtime detail title, read-only runtime boundary.
- Field Runtime Health: Operator shell, Field Runtime Health title, health review boundary.
- Gateway Demo: Operator shell, Replay-backed Gateway Demo title, replay-backed boundary.
- Pilot Readiness: Operator shell, Pilot Readiness title, planning/readiness gate boundary.

## Extended route checklist

- Customer Field Report: raw evidence and identifier boundary.
- Customer Operations: Customer-visible operation boundary.
- Customer Operation Report: raw evidence and identifier boundary.
- Customer Export: export boundary.
- Admin Fields: readback boundary.
- Admin Operations: readback boundary.
- Admin Devices: readback boundary.
- Admin Evidence: evidence readback boundary.
- Admin Skills / Config: config/readback boundary.
- Field Runtime Evidence: evidence read-only boundary.
- Field Runtime Forecast: forecast review boundary.

## Screenshot status

Screenshot files are not required for this PR. The checklist registers required manual screenshot coverage before F0-B. Each listed route is pending manual screenshot capture unless a later artifact workflow records evidence.

## Output rule

F2 acceptance does not require screenshot files. If a later artifact workflow is introduced, it must be handled in a separate package-approved PR.

## Non-goals

No automated visual regression. No screenshot package. No claim that all device/browser combinations are certified.
