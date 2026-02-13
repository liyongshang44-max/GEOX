# Sprint 25 · Approval Request v1 Smoke Acceptance
# Notes:
# - Keep `param(...)` as the first non-comment statement (PowerShell requirement).
# - Use curl.exe with --data-binary "@file" to avoid quoting/escaping issues.

param(
  [string]$baseUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$m) {
  throw ("FAIL: " + $m)
}

function Info([string]$m) {
  Write-Host ("INFO: " + $m)
}

function DetectBaseUrl {
  $candidates = @(
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://[::1]:3000"
  )

  foreach ($u in $candidates) {
    try {
      $r = curl.exe -s "$u/api/health"
      if ($LASTEXITCODE -eq 0 -and $r) {
        # Prefer the one that actually has the approval route mounted.
        $probePath = "$u/api/control/approval_request/v1/requests?tenant_id=tenantA&project_id=projectA&group_id=groupA&limit=1"
        $probe = curl.exe -s -H "Authorization: Bearer dev_ao_act_admin_v0" $probePath
        if ($LASTEXITCODE -eq 0 -and $probe -and ($probe -notmatch '"statusCode"\s*:\s*404')) {
          return $u
        }
      }
    } catch { }
  }

  foreach ($u in $candidates) {
    try {
      $r = curl.exe -s "$u/api/health"
      if ($LASTEXITCODE -eq 0 -and $r) { return $u }
    } catch { }
  }

  Fail "Could not detect a reachable baseUrl on :3000 (health check failed)."
}

function Ensure-ApiReachable([string]$u) {
  $r = curl.exe -s "$u/api/health"
  if ($LASTEXITCODE -ne 0 -or -not $r) {
    Fail "API not reachable at $u (GET /api/health failed)."
  }
}

function Write-JsonTempFile([object]$obj) {
  $tmp = Join-Path $env:TEMP ("geox_apr_" + [Guid]::NewGuid().ToString("N") + ".json")
  $json = $obj | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tmp, $json, $utf8NoBom)
  return $tmp
}

function CurlPostJsonFile([string]$url, [string]$jsonFile, [string]$token) {
  $args = @(
    "-s",
    "-X", "POST",
    $url,
    "-H", "Content-Type: application/json",
    "-H", ("Authorization: Bearer " + $token),
    "--data-binary", ("@" + $jsonFile)
  )
  $out = curl.exe @args
  return $out
}

function CurlGetJson([string]$url, [string]$token) {
  $args = @(
    "-s",
    $url,
    "-H", ("Authorization: Bearer " + $token)
  )
  $out = curl.exe @args
  return $out
}

function Has-Prop([object]$o, [string]$name) {
  if ($null -eq $o) { return $false }
  return $null -ne ($o.PSObject.Properties | Where-Object { $_.Name -eq $name })
}

function Get-PropAny([object]$o, [string[]]$names) {
  foreach ($n in $names) {
    if (Has-Prop $o $n) { return $o.$n }
  }
  return $null
}

if ($baseUrl -eq "") {
  $baseUrl = DetectBaseUrl
}
Info ("using baseUrl=" + $baseUrl)
Ensure-ApiReachable $baseUrl

$token = "dev_ao_act_admin_v0"

Info "guardrail ok: no decision_plan_v0 list/query API detected."
Info "decision_plan_v0 insertion skipped (no public append endpoint by design)."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1") -baseUrl $baseUrl
Info "Sprint16 guardrail ok."

$createReq = @{
  issuer = @{
    kind = "human"
    id = "dev_ao_act_admin_v0"
    namespace = "ao_act_tokens_v0"
  }
  tenant_id = "tenantA"
  project_id = "projectA"
  group_id = "groupA"
  proposal = @{
    action_type = "PLOW"
    target = "field:fieldA"
    parameters = @{
      dry_run = $true
    }
    reason = "smoke"
  }
}
$tmpCreate = Write-JsonTempFile $createReq
$rawCreate = CurlPostJsonFile ("{0}/api/control/approval_request/v1/request" -f $baseUrl) $tmpCreate $token
Remove-Item -Force $tmpCreate -ErrorAction SilentlyContinue

$create = $null
try { $create = $rawCreate | ConvertFrom-Json } catch { $create = $null }
$requestId = Get-PropAny $create @("request_id","requestId","id")
if (-not $requestId) {
  Fail ("create missing request_id. raw=" + $rawCreate)
}
Info ("created request_id=" + $requestId)

$approveReq = @{
  tenant_id = "tenantA"
  project_id = "projectA"
  group_id = "groupA"
  request_id = $requestId
}
$tmpApprove = Write-JsonTempFile $approveReq
$rawApprove = CurlPostJsonFile ("{0}/api/control/approval_request/v1/approve" -f $baseUrl) $tmpApprove $token
Remove-Item -Force $tmpApprove -ErrorAction SilentlyContinue

$approve = $null
try { $approve = $rawApprove | ConvertFrom-Json } catch { $approve = $null }
$ok = Get-PropAny $approve @("ok")
if ($ok -ne $true) {
  Fail ("approve failed: " + $rawApprove)
}
$actTaskId = Get-PropAny $approve @("act_task_id","task_id","id")
if (-not $actTaskId) {
  Fail ("approve missing act_task_id. raw=" + $rawApprove)
}
Info ("approved -> act_task_id=" + $actTaskId)

$rawList = CurlGetJson ("{0}/api/control/approval_request/v1/requests?tenant_id=tenantA&project_id=projectA&group_id=groupA&limit=5" -f $baseUrl) $token
if (-not $rawList) {
  Fail "list returned empty response"
}

Info "[PASS] ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE"
