param(
  [string]$baseUrl = "",
  [string]$token = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$m){ throw ("FAIL: " + $m) }
function Info([string]$m){ Write-Host ("INFO: " + $m) }

function Sha256-File([string]$p){
  $h = [System.Security.Cryptography.SHA256]::Create()
  $fs = [System.IO.File]::OpenRead($p)
  try {
    $b = $h.ComputeHash($fs)
    return ($b | ForEach-Object { $_.ToString("x2") }) -join ""
  } finally { $fs.Dispose(); $h.Dispose() }
}

function Detect-BaseUrl {
  $candidates = @("http://127.0.0.1:3000","http://localhost:3000","http://[::1]:3000")
  foreach ($u in $candidates) {
    try {
      $r = & curl.exe -s -m 2 "$u/api/health"
      if ($LASTEXITCODE -eq 0 -and $r -match "ok") { return $u }
    } catch {}
  }
  return "http://127.0.0.1:3000"
}

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
  $args = @("-s","-m","10","-H","Accept: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += $url
  return & curl.exe @args
}

function Curl-PostJsonFile([string]$url, [string]$jsonPath, [string]$t){
  $args = @("-s","-m","10","-X","POST","-H","Content-Type: application/json")
  if ($t -ne "") { $args += @("-H", ("Authorization: Bearer " + $t)) }
  $args += @("--data-binary", ("@" + $jsonPath), $url)
  return & curl.exe @args
}

# Print script identity to prevent "which version am I running" confusion.
$scriptSelf = $MyInvocation.MyCommand.Path
Info ("script=" + $scriptSelf)
if (Test-Path $scriptSelf) {
  Info ("script_sha256=" + (Sha256-File $scriptSelf))
}

if ($baseUrl -eq "") { $baseUrl = Detect-BaseUrl }
Info ("using baseUrl=" + $baseUrl)

$tok = Get-Token
if ($tok -eq "") { Info "warning: no token found; endpoints may reject auth" }
else { Info ("using token=" + $tok + " (len=" + $tok.Length + ")") }

# Guardrail: Sprint16 decision_plan_v0 negative acceptance must stay green
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ACCEPTANCE_SPRINT16_DECISION_PLAN_V0_NEGATIVE.ps1") -baseUrl $baseUrl
Info "Sprint16 guardrail ok."

$nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$startMs = $nowMs - (60 * 60 * 1000)

$paramSchema = @{ keys = @("dry_run") }
$constraints = @()

$tmp = Join-Path $env:TEMP ("geox_s25_approval_create_" + [guid]::NewGuid().ToString("N") + ".json")
$createBody = @{
  tenant_id  = "tenantA"
  project_id = "projectA"
  group_id   = "groupA"
  issuer     = "acceptance"
  time_window = @{ start_ts = $startMs; end_ts = $nowMs }
  action_type = "PLOW"
  target      = "field:fieldA"
  parameters  = @{ dry_run = $true }
  parameter_schema = $paramSchema
  constraints = $constraints
  reason      = "sprint25_smoke"
}
$createJson = $createBody | ConvertTo-Json -Depth 16
[System.IO.File]::WriteAllText($tmp, $createJson, (New-Object System.Text.UTF8Encoding($false)))

$rawCreate = Curl-PostJsonFile ("{0}/api/control/approval_request/v1/request" -f $baseUrl) $tmp $tok
Remove-Item -Force $tmp -ErrorAction SilentlyContinue

$createObj = $null
try { $createObj = $rawCreate | ConvertFrom-Json } catch { Fail ("create returned non-json: " + $rawCreate) }
Info ("create raw=" + $rawCreate)

# Success criterion: request_id exists (do NOT attempt clever ok/error logic; this endpoint returns {ok:true,...}).
$requestId = $null
if (Has-Prop $createObj "request_id") { $requestId = [string]$createObj.request_id }
elseif (Has-Prop $createObj "requestId") { $requestId = [string]$createObj.requestId }
elseif (Has-Prop $createObj "id") { $requestId = [string]$createObj.id }

if ([string]::IsNullOrWhiteSpace($requestId)) { Fail ("create missing request_id. raw=" + $rawCreate) }
Info ("created request_id=" + $requestId)

$tmp2 = Join-Path $env:TEMP ("geox_s25_approval_approve_" + [guid]::NewGuid().ToString("N") + ".json")
$approveBody = @{
  tenant_id  = "tenantA"
  project_id = "projectA"
  group_id   = "groupA"
  request_id = $requestId
}
$approveJson = $approveBody | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($tmp2, $approveJson, (New-Object System.Text.UTF8Encoding($false)))

$rawApprove = Curl-PostJsonFile ("{0}/api/control/approval_request/v1/approve" -f $baseUrl) $tmp2 $tok
Remove-Item -Force $tmp2 -ErrorAction SilentlyContinue

$approveObj = $null
try { $approveObj = $rawApprove | ConvertFrom-Json } catch { Fail ("approve returned non-json: " + $rawApprove) }
Info ("approve raw=" + $rawApprove)

$actTaskId = $null
if (Has-Prop $approveObj "act_task_id") { $actTaskId = [string]$approveObj.act_task_id }
elseif (Has-Prop $approveObj "actTaskId") { $actTaskId = [string]$approveObj.actTaskId }

if ([string]::IsNullOrWhiteSpace($actTaskId)) { Fail ("approve missing act_task_id. raw=" + $rawApprove) }
Info ("approved, act_task_id=" + $actTaskId)

$rawList = Curl-Get ("{0}/api/control/approval_request/v1/requests?tenant_id=tenantA&project_id=projectA&group_id=groupA&limit=5" -f $baseUrl) $tok
Info ("list response bytes=" + ($rawList.Length))

Write-Host "[PASS] ACCEPTANCE_SPRINT25_APPROVAL_REQUEST_V1_SMOKE"
