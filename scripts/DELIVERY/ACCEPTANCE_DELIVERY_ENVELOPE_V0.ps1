param( # Parameter block for delivery acceptance entrypoint.
  [string]$baseUrl = "http://localhost:3000", # Base URL for the running server under test.
  [string]$nodeCmd = "node" # Node executable used to run the JS runner.
) # End param block.

Set-StrictMode -Version Latest # Enforce strict mode to catch script issues early.
$ErrorActionPreference = "Stop" # Fail fast on any non-terminating errors.

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path # Resolve repository root from script location.
$runner = Join-Path $repoRoot "scripts\DELIVERY\ACCEPTANCE_DELIVERY_ENVELOPE_V0_RUNNER.cjs" # Path to the delivery JS runner.

Write-Host "[INFO] repoRoot=$repoRoot" # Print resolved repo root for traceability.
Write-Host "[INFO] runner=$runner" # Print runner path for traceability.
Write-Host "[INFO] baseUrl=$baseUrl" # Print baseUrl for traceability.
Write-Host "[INFO] nodeCmd=$nodeCmd" # Print node command for traceability.

$exportsDir = Join-Path $repoRoot "_exports\delivery" # Delivery exports directory (SSOT for reports).
New-Item -ItemType Directory -Force -Path $exportsDir | Out-Null # Ensure exports directory exists.

$cmd = @($nodeCmd, $runner, "--baseUrl", $baseUrl, "--repoRoot", $repoRoot) # Build command argv for runner invocation.
Write-Host ("[INFO] running: " + ($cmd -join " ")) # Print exact runner invocation for audit.

& $nodeCmd $runner --baseUrl $baseUrl --repoRoot $repoRoot # Execute the runner (non-zero exit indicates failure).
if ($LASTEXITCODE -ne 0) { # If runner failed, surface report locations then fail hard.
  Write-Host "[INFO] See reports under: _exports/delivery/acceptance_report_v0.json and _exports/delivery/acceptance_report_v0.txt" # Point to SSOT outputs.
  throw "DELIVERY_ACCEPTANCE_FAILED" # Fail hard for CI/manual gate.
} # End failure handling.
