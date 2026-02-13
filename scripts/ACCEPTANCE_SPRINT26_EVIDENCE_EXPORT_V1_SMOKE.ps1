param(
  [string]$baseUrl = "http://127.0.0.1:3000",
  [string]$token = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$m){ throw ("FAIL: " + $m) }
function Info([string]$m){ Write-Host ("INFO: " + $m) }

function Has-Prop($obj, [string]$name){
  if ($null -eq $obj) { return $false }
  return ($obj.PSObject.Properties.Name -contains $name)
}

function Get-Token {
  if ($token -ne "") { return $token }
  if ($env:GEOX_AO_ACT_TOKEN -and $env:GEOX_AO_ACT_TOKEN.Trim() -ne "") { return $env:GEOX_AO_ACT_TOKEN.Trim() }

  $p = Join-Path $PSScriptRoot "..\config\auth\ao_act_tokens_v0.json"
  if (!(Test-Path $p)) { return "" }

  $j = Get-Content $p -Raw | ConvertFrom-Json
  if (Has-Prop $j "tokens" -and $j.tokens) {
    foreach ($rec in $j.tokens) {
      if (Has-Prop $rec "token") {
        $t = [string]$rec.token
        if (-not [string]::IsNullOrWhiteSpace($t)) { return $t }
      }
    }
  }
  return ""
}

function Curl-Get([string]$url, [string]$t){
  $args = @("-s","-m","20","-H","Accept: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += $url
  return & curl.exe @args
}

function Curl-PostJsonFile([string]$url, [string]$jsonPath, [string]$t){
  $args = @("-s","-m","20","-X","POST","-H","Content-Type: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += @("--data-binary", ("@" + $jsonPath), $url)
  return & curl.exe @args
}

function Get-StatusValue($obj){
  if ($null -eq $obj) { return $null }
  if (Has-Prop $obj "status") { return [string]$obj.status }
  if (Has-Prop $obj "state") { return [string]$obj.state }
  if (Has-Prop $obj "job" -and $obj.job) {
    if (Has-Prop $obj.job "status") { return [string]$obj.job.status }
    if (Has-Prop $obj.job "state") { return [string]$obj.job.state }
  }
  return $null
}

function Get-ShaValue($obj){
  if ($null -eq $obj) { return $null }
  if (Has-Prop $obj "artifact_sha256") { return [string]$obj.artifact_sha256 }
  if (Has-Prop $obj "sha256") { return [string]$obj.sha256 }
  if (Has-Prop $obj "job" -and $obj.job) {
    if (Has-Prop $obj.job "artifact_sha256") { return [string]$obj.job.artifact_sha256 }
    if (Has-Prop $obj.job "sha256") { return [string]$obj.job.sha256 }
  }
  return $null
}

$tok = Get-Token
if ($tok -eq "") { Fail "no token found (set -token or GEOX_AO_ACT_TOKEN or config/auth/ao_act_tokens_v0.json)" }
Info ("using baseUrl=" + $baseUrl)
Info ("using token=" + $tok + " (len=" + $tok.Length + ")")

# 1) Reuse Sprint25: create approval request + approve -> act_task_id
$rawS25 = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE.ps1") -baseUrl $baseUrl -token $tok 2>&1 | Out-String
if ($rawS25 -notmatch "\[PASS\] ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE") { Fail ("Sprint25 prerequisite failed. output=" + $rawS25) }
Info "Sprint25 prerequisite ok."

$actTaskId = $null
foreach ($line in ($rawS25 -split "`r?`n")) {
  if ($line -match "act_task_id=([a-zA-Z0-9_\-]+)") { $actTaskId = $Matches[1] }
}
if ([string]::IsNullOrWhiteSpace($actTaskId)) { Fail ("could not extract act_task_id from sprint25 output. output=" + $rawS25) }
Info ("using act_task_id=" + $actTaskId)

# 2) Create export job
$tmp = Join-Path $env:TEMP ("geox_s26_export_create_" + [guid]::NewGuid().ToString("N") + ".json")
$body = @{
  tenant_id  = "tenantA"
  project_id = "projectA"
  group_id   = "groupA"
  act_task_id = $actTaskId
  template = "ao_act_basic_v1"
}
$json = $body | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

$rawCreate = Curl-PostJsonFile ("{0}/api/delivery/evidence_export/v1/jobs" -f $baseUrl) $tmp $tok
Remove-Item -Force $tmp -ErrorAction SilentlyContinue
Info ("create raw=" + $rawCreate)

$createObj = $null
try { $createObj = $rawCreate | ConvertFrom-Json } catch { Fail ("create returned non-json: " + $rawCreate) }

$jobId = $null
if (Has-Prop $createObj "job_id") { $jobId = [string]$createObj.job_id }
elseif (Has-Prop $createObj "jobId") { $jobId = [string]$createObj.jobId }
elseif (Has-Prop $createObj "id") { $jobId = [string]$createObj.id }
if ([string]::IsNullOrWhiteSpace($jobId)) { Fail ("create job missing job_id: " + $rawCreate) }
Info ("created job_id=" + $jobId)

# 3) Poll status (robust shape)
$status = $null
$artifactSha = $null
$downloadUrl = ("{0}/api/delivery/evidence_export/v1/jobs/{1}/download" -f $baseUrl, $jobId)
for ($i=0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  $rawStatus = Curl-Get ("{0}/api/delivery/evidence_export/v1/jobs/{1}" -f $baseUrl, $jobId) $tok
  Info ("status raw=" + $rawStatus)

  $st = $null
  try { $st = $rawStatus | ConvertFrom-Json } catch { Fail ("status returned non-json: " + $rawStatus) }

  $status = Get-StatusValue $st
  $artifactSha = Get-ShaValue $st

  if ([string]::IsNullOrWhiteSpace($status)) { Fail ("status missing field (status/state/job.status). raw=" + $rawStatus) }
  if ($status -eq "done") { break }
  if ($status -eq "failed") { Fail ("job failed: " + $rawStatus) }
}
if ($status -ne "done") { Fail ("job not done in time; last status=" + $status) }
Info ("job done, sha256=" + $artifactSha)

# 4) Download artifact and verify
$tmpOut = Join-Path $env:TEMP ("geox_s26_export_" + $jobId + ".json")
& curl.exe -s -m 20 -H ("Authorization: Bearer " + $tok) -o $tmpOut $downloadUrl
if (!(Test-Path $tmpOut)) { Fail ("download missing: " + $tmpOut) }
$bytes = [System.IO.File]::ReadAllBytes($tmpOut)
if ($bytes.Length -lt 10) { Fail "downloaded artifact too small" }
Remove-Item -Force $tmpOut -ErrorAction SilentlyContinue

if ([string]::IsNullOrWhiteSpace($artifactSha)) { Fail "missing artifact sha256 in status" }

Write-Host "[PASS] ACCEPTANCE_SPRINT26_EVIDENCE_EXPORT_V1_SMOKE"
