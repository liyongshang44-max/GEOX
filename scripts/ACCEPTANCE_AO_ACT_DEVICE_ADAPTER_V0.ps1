# GEOX/scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0.ps1
# Sprint 21: AO-ACT Device Adapter (L2) v0 acceptance entrypoint.

$ErrorActionPreference = "Stop" # Fail fast on any PowerShell error.

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")) # Resolve repo root from scripts directory.
$runner = Join-Path $repoRoot "scripts\ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0_RUNNER.cjs" # Node runner path.
$baseUrl = $env:GEOX_BASE_URL # Optional override for server base url.
if (-not $baseUrl) { $baseUrl = "http://localhost:3000" } # Default base url.
$nodeCmd = $env:NODE_CMD # Optional override for node binary.
if (-not $nodeCmd) { $nodeCmd = "node" } # Default node command.

Write-Host "[INFO] repoRoot=$repoRoot" # Print repo root.
Write-Host "[INFO] runner=$runner" # Print runner path.
Write-Host "[INFO] baseUrl=$baseUrl" # Print base url.
Write-Host "[INFO] nodeCmd=$nodeCmd" # Print node command.

Write-Host "[INFO] running: $nodeCmd \"$runner\" --baseUrl \"$baseUrl\"" # Print actual command.
& $nodeCmd $runner --baseUrl $baseUrl # Execute the Node runner.
$code = $LASTEXITCODE # Capture exit code.
if ($code -ne 0) { throw "AO-ACT Device Adapter v0 acceptance failed (exit_code=$code)" } # Fail on non-zero.

Write-Host "[OK] AO-ACT Device Adapter v0 acceptance passed" # Success.
