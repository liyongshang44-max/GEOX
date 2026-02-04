# scripts/ACCEPTANCE_AO_ACT_AUDIT_V0.ps1
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$runner  = Join-Path $PSScriptRoot "ACCEPTANCE_AO_ACT_AUDIT_V0_RUNNER.cjs"
$baseUrl = $env:GEOX_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) { $baseUrl = "http://localhost:3000" }

# Preflight: verify the server TCP port is reachable before running Node runner.
try {
  $u = [Uri]$baseUrl
  $serverHost = $u.Host
$serverPort = $u.Port
$tnc = Test-NetConnection -ComputerName $serverHost -Port $serverPort
if (-not $tnc.TcpTestSucceeded) { throw "Server not reachable: ${serverHost}:${serverPort} (start apps/server first)" }

} catch {
  throw "Server reachability preflight failed for baseUrl=$baseUrl :: $($_.Exception.Message)"
}
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
  if ($code -ne 0) { throw "AO-ACT audit tools v0 acceptance failed (exit_code=$code)" }
  Write-Host "[OK] AO-ACT audit tools v0 acceptance passed"
} finally { Pop-Location }
