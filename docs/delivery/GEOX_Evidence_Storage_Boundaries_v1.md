# GEOX Evidence Storage Boundaries v1

## Goal

This document defines the minimum delivery boundary between the current local-file evidence export runtime and a future object-storage runtime.

Current state:
- export jobs write `bundle.json` / `bundle.csv` / `bundle.pdf` to local filesystem
- download API streams the local file directly
- integrity remains anchored by `manifest.json` and `sha256.txt`

Forward-compatible boundary introduced in this sprint:
- every DONE export job exposes a stable `evidence_pack.delivery.object_store_key`
- completed packs are indexed in `evidence_pack_index_v1`
- storage can remain `LOCAL_FILE` or switch to `LOCAL_MIRROR`
- `LOCAL_MIRROR` keeps an object-storage-like directory under runtime without adding MinIO/S3 hard dependency yet

## Stable object-store key contract

Format:

`evidence-exports-v1/<tenant_id>/<job_id>/bundle.<ext>`

Where:
- `<tenant_id>` is the tenant-scoped id from auth / facts
- `<job_id>` is the evidence export job id
- `<ext>` is `json`, `csv`, or `pdf`

## Delivery contract returned by list/detail APIs

Each completed job may expose:

- `evidence_pack.delivery.storage_mode`
- `evidence_pack.delivery.object_store_key`
- `evidence_pack.delivery.object_store_presign_supported`
- `evidence_pack.delivery.object_store_download_url`

Current values:
- `LOCAL_FILE`
  - bundle/manifest/checksums only exist in runtime pack dir
  - `object_store_download_url = null`
- `LOCAL_MIRROR`
  - bundle/manifest/checksums are mirrored into `runtime/evidence_object_store_v1`
  - `object_store_download_url` points to the authorized GEOX download route with `source=object_store`

## Runtime switches

Environment variables:

- `GEOX_EVIDENCE_STORAGE_MODE`
  - `LOCAL_FILE` (default)
  - `LOCAL_MIRROR`
- `GEOX_EVIDENCE_OBJECT_ROOT`
  - optional override for local mirror root directory
  - default: `runtime/evidence_object_store_v1`

## Migration rule

A future object-storage implementation must preserve:
- existing tenant isolation
- existing `manifest.json` and `sha256.txt` semantics
- existing download authorization checks
- stable `object_store_key` naming contract

A future implementation may switch:
- `storage_mode` to `OBJECT_STORAGE`
- `object_store_presign_supported` to `true`
- `object_store_download_url` to a one-time signed URL

without breaking current clients that still consume the local bundle download endpoint.
