# AO-ACT Version Boundary Contract V1

## Status

Current production boundary. This document freezes the present contract so future work does not silently confuse API version, route implementation version, and append-only fact type version.

## Current contract

The AO-ACT product ingress is `/api/v1/actions/*`.

The current append-only AO-ACT execution facts are still:

- `ao_act_task_v0`
- `ao_act_receipt_v0`

This is intentional for the current release line. It means API v1 does not imply fact type v1.

## Required interpretation

When code needs to read the current action task chain, it must treat `ao_act_task_v0` in `facts` as the canonical source unless a dedicated migration plan introduces `ao_act_task_v1` as a real writer and read model.

When code needs to read the current action receipt chain, it must treat `ao_act_receipt_v0` in `facts` as the canonical source unless a dedicated migration plan introduces `ao_act_receipt_v1` as a real writer and read model.

The existence of TypeScript or JSON schema files named `ao_act_receipt_v1` does not by itself make `ao_act_receipt_v1` the runtime fact type.

## Forbidden changes without migration plan

Do not add production reads from `ao_act_task_v1` or `ao_act_receipt_v1` unless the same change also includes:

1. a writer for the new fact type;
2. a projection or compatibility adapter;
3. migration acceptance proving old and new chains resolve to the same operation state;
4. documentation updating this boundary.

Do not create acceptance scripts that assume `/api/v1/actions/*` writes `ao_act_task_v1` or `ao_act_receipt_v1`.

Do not make legacy `/api/control/ao_act/*` the primary path for new commercial or governance acceptance scripts.

## Allowed compatibility

Legacy v0 documents and helper scripts may keep their `v0` naming where they explicitly target historical AO-ACT contracts.

UI labels, timeline labels, and static schema packages may mention v1 names for display or type-export purposes, but they must not be used as evidence that runtime facts are already v1.

## Migration target, not current state

A future AO-ACT fact contract migration may define:

- `/api/v1/actions/*` as the API path;
- `ao_act_task_v1` as the task fact type;
- `ao_act_receipt_v1` as the receipt fact type;
- explicit v0-to-v1 read compatibility.

That migration must be done as a dedicated release task. It must not be smuggled into unrelated commercial, field-memory, report, or acceptance fixes.
