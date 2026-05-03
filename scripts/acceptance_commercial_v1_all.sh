param(
  [string]$BaseUrl = "http://127.0.0.1:3001",
  [string]$MqttUrl = "mqtt://127.0.0.1:1883"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  if (-not $env:PGHOST) { $env:PGHOST = "127.0.0.1" }
  if (-not $env:PGPORT) { $env:PGPORT = "5433" }
  if (-not $env:PGUSER) { $env:PGUSER = "landos" }
  if (-not $env:PGPASSWORD) { $env:PGPASSWORD = "landos_pwd" }
  if (-not $env:PGDATABASE) { $env:PGDATABASE = "landos" }
  $env:DATABASE_URL = "postgres://$($env:PGUSER):$($env:PGPASSWORD)@$($env:PGHOST):$($env:PGPORT)/$($env:PGDATABASE)"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[commercial_v1] running acceptance suite..."
Write-Host "[commercial_v1] BaseUrl=$BaseUrl"
Write-Host "[commercial_v1] MqttUrl=$MqttUrl"
Write-Host "[commercial_v1] DATABASE_URL=$($env:DATABASE_URL)"

$env:BASE_URL = $BaseUrl
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = curl.exe -s "$env:BASE_URL/health"
    if ($r -match '"ok":true') {
      $ready = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  docker compose -f docker-compose.commercial_v1.yml ps -a
  docker logs --tail 200 geox-v1-server
  throw "server not healthy"
}
Write-Host "[commercial_v1] health wait passed: $env:BASE_URL/health"

$steps = @(
  @{
    Name = "ACCEPTANCE_SPRINTA2_DEVICE_CREDENTIALS_SMOKE.ps1"
    Args = @("-BaseUrl", $BaseUrl, "-MqttUrl", $MqttUrl)
  },
  @{
    Name = "ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE.ps1"
    Args = @("-BaseUrl", $BaseUrl, "-MqttUrl", $MqttUrl)
  },
  @{
    Name = "ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1"
    Args = @("-BaseUrl", $BaseUrl)
  },
  @{
    Name = "ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1"
    Args = @("-BaseUrl", $BaseUrl)
  },
  @{
    Name = "ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE.ps1"
    Args = @("-BaseUrl", $BaseUrl)
  }
)

foreach ($step in $steps) {
  $file = Join-Path $scriptRoot $step.Name
  Write-Host "[commercial_v1] -> $($step.Name)"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $file @($step.Args)
  if ($LASTEXITCODE -ne 0) {
    throw "[commercial_v1] step failed: $($step.Name)"
  }
}

Write-Host "[commercial_v1] acceptance suite done."
