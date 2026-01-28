# scripts/ACCEPTANCE_AO_ACT_V0.ps1
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runner  = Join-Path $PSScriptRoot "ACCEPTANCE_AO_ACT_V0_RUNNER.mjs"
$baseUrl = $env:GEOX_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) { $baseUrl = "http://localhost:3000" }
Write-Host "[INFO] repoRoot=$repoRoot"
Write-Host "[INFO] runner=$runner"
Write-Host "[INFO] baseUrl=$baseUrl"
if (-not (Test-Path $runner)) { throw "Runner not found: $runner" }
$nodeCmd = "node"
Push-Location $repoRoot
try {
  Write-Host "[INFO] nodeCmd=$nodeCmd"
  Write-Host "[INFO] running: $nodeCmd `"$runner`" --baseUrl `"$baseUrl`""
  & $nodeCmd $runner --baseUrl $baseUrl
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "AO-ACT v0 acceptance failed (exit_code=$code)" }
  Write-Host "[OK] AO-ACT v0 acceptance passed"
} finally { Pop-Location }
