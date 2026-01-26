# scripts/ACCEPTANCE_PROBLEMSTATE_LIFECYCLE_V1.ps1

# GEOX · Sprint 9 Acceptance · ProblemState Lifecycle v1
# This script runs a deterministic, fixture-based acceptance suite.
# NOTE: This script is an acceptance command entrypoint; it does not write Facts or configs.

$ErrorActionPreference = 'Stop' # Fail fast on any error

$repoRoot = Split-Path -Parent $PSScriptRoot # Resolve repo root from this scripts directory
$runner = Join-Path $PSScriptRoot 'ACCEPTANCE_PROBLEMSTATE_LIFECYCLE_V1_RUNNER.cjs' # Locate Node runner script (CJS)

Write-Host "[INFO] repoRoot=$repoRoot" # Print repo root for reproducibility
Write-Host "[INFO] runner=$runner" # Print runner path for reproducibility

if (-not (Test-Path $runner)) { throw "Runner not found: $runner" } # Validate runner presence

Push-Location $repoRoot # Ensure relative paths resolve from repo root
try {
  # Register ts-node in CommonJS mode to load TypeScript without ESM loader cycles.
  node -r ts-node/register $runner # Execute deterministic acceptance runner
} finally {
  Pop-Location # Restore previous working directory
}
