# F2 Visual Smoke Checklist

## Phase

F2-E Visual Smoke Checklist.

## Purpose

Key formal routes can be visually inspected with a stable checklist before frontend freeze.

This checklist does not introduce automated visual regression tooling or screenshot dependencies.

## Checklist protocol

Each route should be inspected at 1440px, 1280px, 768px, and 390px where practical.

For each route, check: page renders, no blank screen, shell visible, nav visible, LocaleToggle visible, title visible, main content visible, boundary or nonclaim copy visible when applicable, no mojibake, no obvious overflow, and no live-production capability claim.

## Route checklist

- Customer Dashboard: Customer shell, Customer Dashboard title, authorized scope boundary.
- Customer Fields: Customer shell, Customer Fields title, field access boundary.
- Customer Field Report: Customer shell, Customer Field Report title, raw evidence and identifier boundary.
- Customer Operations: Customer shell, Customer Operations title, Customer-visible operation boundary.
- Customer Operation Report: Customer shell, Customer Operation Report title, raw evidence and identifier boundary.
- Customer Reports: Customer shell, Customer Reports title, report access boundary.
- Customer Export: Customer print/export scaffold, Customer Export title, export boundary.
- Admin Dashboard: Admin shell, Admin Dashboard title, governance boundary.
- Admin Fields: Admin shell, Admin Fields title, readback boundary.
- Admin Operations: Admin shell, Admin Operations title, readback boundary.
- Admin Devices: Admin shell, Admin Devices title, readback boundary.
- Admin Evidence: Admin shell, Admin Evidence title, evidence readback boundary.
- Admin Health: Admin shell, Admin Health title, runtime health readback boundary.
- Admin Skills / Config: Admin shell, Admin Skills title, config/readback boundary.
- Operator Runtime Overview: Operator shell, Operator Runtime Overview title, runtime nonclaim banner.
- Field Runtime Overview: Operator shell, Field Runtime title, read-only runtime review boundary.
- Field Runtime Evidence: Operator shell, Field Runtime Evidence title, evidence read-only boundary.
- Field Runtime Forecast: Operator shell, Field Runtime Forecast title, forecast review boundary.
- Field Runtime Health: Operator shell, Field Runtime Health title, health review boundary.
- Replay-backed Gateway Demo: Operator shell, Replay-backed Gateway Demo title, replay-backed boundary.
- Pilot Readiness: Operator shell, Pilot Readiness title, planning/readiness gate boundary.

## Output rule

F2 acceptance does not require screenshot files. If a later artifact workflow is introduced, it must be handled in a separate package-approved PR.

## Non-goals

No automated visual regression. No screenshot package. No claim that all device/browser combinations are certified.
