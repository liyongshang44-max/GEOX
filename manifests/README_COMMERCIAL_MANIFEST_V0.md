# GEOX Commercial Manifest v0

This folder holds the **commercial freeze manifest** for Sprint 24.

How to generate (Windows PowerShell):

1) Ensure you have run the system acceptance:
   - `pnpm deploy:commercial:v0`
   - `pnpm acceptance:system:commercial:v0`

2) Generate / update the manifest:
   - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\GENERATE_GEOX_SYSTEM_COMMERCIAL_V0_MANIFEST.ps1`

Outputs:
- Repo-committed manifest: `manifests/geox_system_commercial_v0.manifest.json`
- Artifact copy (timestamped): `artifacts/commercial_manifest/commercial_v0/geox_system_commercial_v0.manifest.<timestamp>.json`

The manifest includes:
- single version id + intended tag
- git commit
- sha256 hashes for compose files, key scripts, freeze doc
- directory hashes for `packages/contracts/src` and `packages/contracts/src/schema`
- sha256 of the system acceptance report (if present)
