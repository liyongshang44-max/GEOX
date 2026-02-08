# GEOX Commercial Freeze v0 — Operator Reproduce

This is the **operator-facing** reproducibility procedure for the tag:

- `geox_system_commercial_v0`

## What is considered "reproducible"

The freeze manifest contains two kinds of information:

1) **Stable** hashes (must match across environments)
- compose files sha256
- deploy/acceptance script sha256
- freeze doc sha256
- contracts dir_hash (src + schema)
- git commit

2) **Volatile** run artifacts (expected to change run-to-run)
- system acceptance report sha256 (the report is generated each run)
- timestamps / artifact filenames
- any value derived from local filesystem line-ending policy

Therefore, the reproduce check compares **stable** hashes only, and requires:
- deploy success
- system acceptance PASS
- stable manifest hash matches the freeze manifest stable hash

## One-command reproduce (Windows PowerShell)

1) Checkout the frozen tag:

```powershell
git fetch --tags
git checkout geox_system_commercial_v0
```

2) Run reproduce:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/REPRODUCE_GEOX_SYSTEM_COMMERCIAL_V0.ps1
```

Expected output:
- Deploy OK
- Acceptance PASS
- `freeze_manifest.stable_hash == regen_manifest.stable_hash`
- Final: `Reproduce PASS`

## Notes

- The script temporarily regenerates `manifests/geox_system_commercial_v0.manifest.json` for comparison, then restores the original file so your worktree stays clean.
- If stable hashes mismatch, the script prints the first few differing keys as a hint (e.g., `script.*.sha256` or `contracts.*.dir_hash_v1`).
