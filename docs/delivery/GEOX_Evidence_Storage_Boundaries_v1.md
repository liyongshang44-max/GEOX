# GEOX Evidence Storage Boundaries v1

## Goal

This document defines the evidence-export storage boundary for GEOX delivery profiles.
It clarifies **local/dev baseline** vs **commercial baseline** so runtime behavior is consistent with compose contracts.

Current runtime invariants (all profiles):
- export jobs always build `bundle.json` / `bundle.csv` / `bundle.pdf` locally first
- every pack includes `manifest.json` and `sha256.txt`
- evidence pack content structure is frozen:
  - `manifest.json`
  - `sha256.txt`
  - bundle payload format (`json/csv/pdf`) remains unchanged

Delivery boundary implemented:
- every DONE export job exposes a stable `evidence_pack.delivery.object_store_key`
- completed packs are indexed in `evidence_pack_index_v1`
- `storage_mode` may be `LOCAL_FILE` / `LOCAL_MIRROR` / `S3_COMPAT`
- for `S3_COMPAT`, bundle/manifest/checksums are uploaded to object storage and can be downloaded via presigned URLs

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
- `evidence_pack.delivery.object_store_part_download_urls.bundle`
- `evidence_pack.delivery.object_store_part_download_urls.manifest`
- `evidence_pack.delivery.object_store_part_download_urls.checksums`

Current values:
- `LOCAL_FILE`
  - bundle/manifest/checksums only exist in runtime pack dir
  - `object_store_download_url = null`
- `LOCAL_MIRROR`
  - bundle/manifest/checksums are mirrored into `runtime/evidence_object_store_v1`
  - `object_store_download_url` points to the authorized GEOX download route with `source=object_store`
- `S3_COMPAT`
  - object keys:
    - `bundle`: `evidence-exports-v1/<tenant_id>/<job_id>/bundle.<ext>`
    - `manifest`: `evidence-exports-v1/<tenant_id>/<job_id>/manifest.json`
    - `checksums`: `evidence-exports-v1/<tenant_id>/<job_id>/sha256.txt`
  - `object_store_presign_supported = true`
  - download endpoint `/api/v1/evidence-export/jobs/:job_id/download?part=<bundle|manifest|checksums>` returns redirect to presigned URL
  - commercial profile must not rely on local filesystem paths for final delivery

## Runtime switches

Environment variables:

- `GEOX_EVIDENCE_STORAGE_MODE`
  - `LOCAL_FILE` (default)
  - `LOCAL_MIRROR`
  - `S3_COMPAT`
- `GEOX_EVIDENCE_OBJECT_ROOT`
  - optional override for local mirror root directory
  - default: `runtime/evidence_object_store_v1`
- `GEOX_EVIDENCE_S3_ENDPOINT`
- `GEOX_EVIDENCE_S3_BUCKET`
- `GEOX_EVIDENCE_S3_REGION`
- `GEOX_EVIDENCE_S3_ACCESS_KEY_ID`
- `GEOX_EVIDENCE_S3_SECRET_ACCESS_KEY`
- `GEOX_EVIDENCE_S3_FORCE_PATH_STYLE`
- `GEOX_EVIDENCE_S3_PRESIGN_TTL_SEC`

## Profile baseline

- `docker-compose.yml` (local/dev baseline):
  - may use `GEOX_EVIDENCE_STORAGE_MODE=LOCAL_MIRROR`
  - purpose: local verification without requiring object storage credentials
- `docker-compose.commercial_v1.yml` (commercial baseline):
  - must use `GEOX_EVIDENCE_STORAGE_MODE=S3_COMPAT`
  - must provide complete `GEOX_EVIDENCE_S3_*` contract vars
  - must not use legacy non-consumed `MINIO_*` app vars for evidence delivery

## Migration rule

Any storage backend evolution must preserve:
- existing tenant isolation
- existing `manifest.json` and `sha256.txt` semantics
- existing download authorization checks
- stable `object_store_key` naming contract

without breaking clients that consume `/api/v1/evidence-export/jobs/:job_id/download`.
