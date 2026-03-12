# GEOX Commercial v1 acceptance one-click entry.
$ErrorActionPreference = "Stop"

Write-Host "[commercial_v1] running acceptance suite..."

$steps = @(
  "ACCEPTANCE_SPRINTA2_DEVICE_CREDENTIALS_SMOKE.ps1",
  "ACCEPTANCE_SPRINTA1_TELEMETRY_MQTT_SMOKE.ps1",
  "ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1",
  "ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE.ps1",
  "ACCEPTANCE_SPRINT27_EXECUTOR_RUNTIME_V1_SMOKE.ps1"
)

foreach ($s in $steps) {
  $p = Join-Path $PSScriptRoot $s
  Write-Host "[commercial_v1] -> $s"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $p
}

Write-Host "[commercial_v1] acceptance suite done."
