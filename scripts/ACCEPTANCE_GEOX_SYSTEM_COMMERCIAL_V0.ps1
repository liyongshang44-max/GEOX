Set-StrictMode -Version Latest # Enforce strict variable + property usage for safety.
$ErrorActionPreference = "Stop" # Fail fast on any error.

# Resolve repoRoot from this script location (PowerShell 5.1 compatible).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path } # Script directory.
$repoRoot = Resolve-Path (Join-Path $here "..") # Repository root.

# Constants.
$profile = "commercial_v0" # Commercial profile name for report metadata.
$baseUrl = "http://127.0.0.1:3000" # Backend base URL (host port mapping).
$reportDir = Join-Path $repoRoot "artifacts\system_acceptance\commercial_v0" # Artifact output directory.
$reportPath = Join-Path $reportDir "system_acceptance_report.json" # Report output path.

# Ensure output directory exists.
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null # Create report directory.

# Report skeleton.
$report = [ordered]@{
  profile = $profile # Acceptance profile.
  started_at_ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() # Start timestamp (ms).
  finished_at_ts = 0 # Filled at end.
  verdict = "FAIL" # Default until proven PASS.
  steps = @() # Step results.
} # Report root.

function Add-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Id,
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Status,
    [Parameter(Mandatory=$false)]$Data = @{},
    [Parameter(Mandatory=$false)][string]$Note = ""
  )
  $report.steps += [ordered]@{ id=$Id; name=$Name; status=$Status; data=$Data; note=$Note } # Append step record.
}

function Write-Report {
  $report.finished_at_ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() # End timestamp (ms).
  ($report | ConvertTo-Json -Depth 50) | Set-Content -Path $reportPath -Encoding UTF8 # Write JSON report.
  Write-Host "[INFO] Report written: $reportPath" # Log artifact path.
}

# Load System.Net.Http for Windows PowerShell 5.1.
try { Add-Type -AssemblyName System.Net.Http | Out-Null } catch { } # Best-effort load.

# Shared HttpClient (avoid handler-specific types).
$client = New-Object System.Net.Http.HttpClient # HTTP client.
$client.Timeout = [TimeSpan]::FromSeconds(10) # Per-request timeout.

function Invoke-HttpJson {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$false)][hashtable]$Headers = @{},
    [Parameter(Mandatory=$false)]$BodyObj = $null
  )

  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $Url) # Request object.

  foreach ($k in $Headers.Keys) { # Apply headers.
    $null = $req.Headers.TryAddWithoutValidation($k, [string]$Headers[$k]) # Add header without strict validation.
  }

  if ($Method -ne "GET" -and $BodyObj -ne $null) { # Only attach content for non-GET.
    $json = ($BodyObj | ConvertTo-Json -Depth 50 -Compress) # JSON body.
    $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json") # JSON content.
    $req.Content = $content # Attach content.
  }

  try {
    $resp = $client.SendAsync($req).GetAwaiter().GetResult() # Send request synchronously.
    $status = [int]$resp.StatusCode # HTTP status code.
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() # Response body.
    return @{ ok=$true; status=$status; body=$body } # Return response envelope.
  } catch {
    return @{ ok=$false; status=0; body=($_.Exception.Message) } # Return error envelope.
  }
}

function Health-IsOk {
  param([hashtable]$r)
  if (-not $r.ok) { return $false } # Network error => not ok.
  if ($r.status -ne 200) { return $false } # Non-200 => not ok.
  try { $o = ($r.body | ConvertFrom-Json) } catch { return $false } # Body not JSON => not ok.
  if ($null -eq $o.ok) { return $false } # Missing ok field => not ok.
  return [bool]$o.ok # ok=true means healthy.
}

function Wait-HealthOk {
  param([int]$TimeoutSec)
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSec) # Deadline time.
  while ([DateTimeOffset]::UtcNow -lt $deadline) { # Poll loop.
    $r = Invoke-HttpJson -Method "GET" -Url "$baseUrl/api/health" -Headers @{ "Accept"="application/json" } # Health call.
    if (Health-IsOk -r $r) { return $true } # Healthy => success.
    Start-Sleep -Milliseconds 600 # Backoff.
  }
  return $false # Timed out.
}

function Wait-HealthUnusable {
  param([int]$TimeoutSec)
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSec) # Deadline time.
  while ([DateTimeOffset]::UtcNow -lt $deadline) { # Poll loop.
    $r = Invoke-HttpJson -Method "GET" -Url "$baseUrl/api/health" -Headers @{ "Accept"="application/json" } # Health call.
    if (-not (Health-IsOk -r $r)) { return $true } # Not healthy => unusable.
    Start-Sleep -Milliseconds 600 # Backoff.
  }
  return $false # Timed out.
}

function Get-AoActReceiptWriteToken {
  $p = Join-Path $repoRoot "config\auth\ao_act_tokens_v0.json" # Token config path.
  if (-not (Test-Path $p)) { return $null } # Missing token file => no token.
  $raw = Get-Content $p -Raw # Read JSON.
  try { $j = $raw | ConvertFrom-Json } catch { return $null } # Parse JSON.

  # Attempt common schema shapes.
  $candidates = @() # Token entries.
  if ($j.tokens) { $candidates = $j.tokens } # tokens: [...]
  elseif ($j.items) { $candidates = $j.items } # items: [...]
  elseif ($j -is [System.Collections.IEnumerable]) { $candidates = $j } # array root.

  foreach ($t in $candidates) { # Find first non-revoked token with receipt.write scope.
    $revoked = $false # Default revoked=false.
    if ($t.revoked -ne $null) { $revoked = [bool]$t.revoked } # Respect revoked flag.
    $scopes = @() # Scope list.
    if ($t.scopes) { $scopes = @($t.scopes) } # scopes.
    if (-not $revoked -and ($scopes -contains "ao_act.receipt.write")) { # Scope match.
      if ($t.token) { return [string]$t.token } # token field.
      if ($t.value) { return [string]$t.value } # value field.
    }
  }
  return $null # Not found.
}

# --- Step 01: backend health ---
try {
  Write-Host "[INFO] Step 01: backend /api/health must be ok=true" # Log.
  $ok = Wait-HealthOk -TimeoutSec 30 # Wait for healthy backend.
  if (-not $ok) { throw "S01_expected_health_ok_timeout" } # Fail if not ok.
  Add-Step -Id "S01" -Name "backend health" -Status "PASS" -Data @{ status=200 } # Record pass.
  Write-Host "[OK]   Step 01: backend /api/health must be ok=true" # Log pass.
} catch {
  Add-Step -Id "S01" -Name "backend health" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# --- Step 02: admin healthz ---
try {
  Write-Host "[INFO] Step 02: admin /api/admin/healthz must be ok=true" # Log.
  $r = Invoke-HttpJson -Method "GET" -Url "$baseUrl/api/admin/healthz" -Headers @{ "Accept"="application/json" } # Call admin healthz.
  if (-not $r.ok) { throw "S02_request_failed $($r.body)" } # Network/transport failure.
  if ($r.status -ne 200) { throw "S02_expected_status_200 status=$($r.status) body=$($r.body)" } # Non-200.
  $o = $r.body | ConvertFrom-Json # Parse JSON.
  if (-not [bool]$o.ok) { throw "S02_expected_ok_true body=$($r.body)" } # ok must be true.
  Add-Step -Id "S02" -Name "admin healthz" -Status "PASS" -Data @{ status=$r.status } # Record pass.
  Write-Host "[OK]   Step 02: admin /api/admin/healthz must be ok=true" # Log pass.
} catch {
  Add-Step -Id "S02" -Name "admin healthz" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# --- Step 03: Agronomy output must NOT encode AO-ACT semantics ---
try {
  Write-Host "[INFO] Step 03: Agronomy output must NOT be able to encode AO-ACT semantics (FORBIDDEN_KEY:ao_act*)" # Log.
  $payload = @{ # Minimal interpretation v1 append payload (unknown fields tolerated; forbidden scan happens before storage).
    project_id = "demo" # Project id.
    subject_ref = @{ projectId="demo"; groupId="default" } # Subject ref.
    meta = @{ ao_act = @{ intent = "SHOULD_BE_FORBIDDEN" } } # Forbidden key injection.
    report = @{ summary = "test" } # Minimal report.
    evidence_refs = @() # No evidence required for this negative test.
  } # Payload.
  $r = Invoke-HttpJson -Method "POST" -Url "$baseUrl/api/agronomy/interpretation_v1/append" -Headers @{ "Content-Type"="application/json" } -BodyObj $payload # Call append.
  if ($r.status -ne 400 -or ($r.body -notmatch "FORBIDDEN_KEY:ao_act")) { throw "S03_expected_FORBIDDEN_KEY_ao_act status=$($r.status) body=$($r.body)" } # Require forbidden.
  Add-Step -Id "S03" -Name "agronomy cannot encode ao_act" -Status "PASS" -Data @{ status=$r.status; body=$r.body } # Record pass.
  Write-Host "[OK]   Step 03: Agronomy forbidden key gate OK (FORBIDDEN_KEY:ao_act)" # Log pass.
} catch {
  Add-Step -Id "S03" -Name "agronomy cannot encode ao_act" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# --- Step 04: AO-ACT receipt must NOT accept ProblemState fields ---
try {
  Write-Host "[INFO] Step 04: AO-ACT receipt must NOT accept ProblemState fields (FORBIDDEN_KEY:problem_state_id)" # Log.
  $token = Get-AoActReceiptWriteToken # Read token.
  if (-not $token) { throw "S04_missing_token ao_act.receipt.write not found in config/auth/ao_act_tokens_v0.json" } # Missing token.
  $payload = @{ # Minimal receipt with forbidden field injection.
    receipt_id = "r_demo" # Dummy receipt id.
    task_id = "t_demo" # Dummy task id.
    ok = $true # Dummy ok.
    problem_state_id = "ps_forbidden" # Forbidden cross-layer field.
  } # Payload.
  $r = Invoke-HttpJson -Method "POST" -Url "$baseUrl/api/control/ao_act/receipt" -Headers @{ "Authorization"=("Bearer " + $token); "Content-Type"="application/json" } -BodyObj $payload # Call receipt write.
  if ($r.status -ne 400 -or ($r.body -notmatch "FORBIDDEN_KEY:problem_state_id")) { throw "S04_expected_FORBIDDEN_KEY_problem_state_id status=$($r.status) body=$($r.body)" } # Require forbidden.
  Add-Step -Id "S04" -Name "ao-act receipt cannot accept problem_state fields" -Status "PASS" -Data @{ status=$r.status; body=$r.body } # Record pass.
  Write-Host "[OK]   Step 04: AO-ACT receipt forbidden key gate OK (problem_state_id)" # Log pass.
} catch {
  Add-Step -Id "S04" -Name "ao-act receipt cannot accept problem_state fields" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# --- Step 05: Remove Apple II => system must become unusable ---
try {
  Write-Host "[INFO] Step 05: Remove Apple II => system must become unusable (commercial_v0)" # Log.
  $composeBase = @(
    "-f", (Join-Path $repoRoot "docker-compose.yml"),
    "-f", (Join-Path $repoRoot "docker-compose.delivery.yml"),
    "-f", (Join-Path $repoRoot "docker-compose.commercial_v0.yml")
  ) # Base compose files.
  $overlay = Join-Path $repoRoot "docker-compose.commercial_v0.neg_disable_appleii.yml" # Negative overlay path.

  & docker compose @composeBase -f $overlay up -d --remove-orphans --force-recreate | Out-Null # Apply overlay (disable Apple II).
  $unusable = Wait-HealthUnusable -TimeoutSec 20 # Expect unusable quickly.
  if (-not $unusable) { throw "S05_expected_unusable_after_disable" } # Fail if still healthy.

  & docker compose @composeBase up -d --remove-orphans --force-recreate | Out-Null # Restore normal commercial profile.
  $restored = Wait-HealthOk -TimeoutSec 120 # Allow long restore due to pnpm/tsx startup.
  if (-not $restored) { throw "S05_restore_expected_health_ok" } # Fail if not restored.

  Add-Step -Id "S05" -Name "disable apple ii => system unusable" -Status "PASS" -Data @{ overlay=$overlay } # Record pass.
  Write-Host "[OK]   Step 05 Apple II removal gate OK (system unusable)" # Log pass.
} catch {
  Add-Step -Id "S05" -Name "disable apple ii => system unusable" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# --- Step 06: Forbidden bidirectional dependencies must not exist (static scan) ---
try {
  Write-Host "[INFO] Step 06: Forbidden bidirectional dependencies must not exist (static scan)" # Log.

  $rules = @(
    @{ rule_id="AIV_MUST_NOT_IMPORT_AIII_CONTROL"; file_glob="apps/server/src/routes/agronomy_*.ts"; deny_regex='from\s+["'']\./control_ao_|require\(["'']\./control_ao_' },
    @{ rule_id="AIII_CONTROL_MUST_NOT_IMPORT_AIV_AGRONOMY"; file_glob="apps/server/src/routes/control_ao_*.ts"; deny_regex='from\s+["'']\./agronomy|require\(["'']\./agronomy' }
  ) # Minimal rules for Sprint24 AIII<->AIV prohibition.

  $violations = New-Object System.Collections.ArrayList # Collect violations.

  foreach ($rule in $rules) { # Evaluate each rule.
    $glob = [string]$rule.file_glob # Glob.
    $rx = [string]$rule.deny_regex # Regex.
    $files = Get-ChildItem -Path (Join-Path $repoRoot $glob) -ErrorAction SilentlyContinue # Resolve glob.
    foreach ($f in $files) { # Scan each file.
      $txt = Get-Content -Path $f.FullName -Raw -ErrorAction SilentlyContinue # Read file text.
      if ($null -ne $txt -and ($txt -match $rx)) { # Match forbidden import.
        $null = $violations.Add([ordered]@{ rule_id=$rule.rule_id; file=($f.FullName.Substring($repoRoot.Path.Length+1)).Replace("\","/"); deny_regex=$rx }) # Record violation.
      }
    }
  }

  if ($violations.Count -gt 0) { # Any violation => FAIL.
    Add-Step -Id "S06" -Name "forbidden dependency scan" -Status "FAIL" -Data @{ violations=$violations } -Note "FORBIDDEN_DEPENDENCY_DETECTED" # Record fail.
    throw ("S06_forbidden_dependencies_detected count=" + $violations.Count) # Throw.
  }

  Add-Step -Id "S06" -Name "forbidden dependency scan" -Status "PASS" -Data @{ violations=@() } # Record pass.
  Write-Host "[OK]   Step 06 Forbidden dependency scan PASS" # Log pass.
} catch {
  Add-Step -Id "S06" -Name "forbidden dependency scan" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) # Record fail.
  throw
}

# If we reached here, all steps passed.
$report.verdict = "PASS" # Final verdict.
Write-Report # Write report.
Write-Host "[OK]   System acceptance PASS (commercial_v0)" # Log pass.
exit 0 # Success.

# Catch-all: write report and exit 1.
trap {
  try { $report.verdict = "FAIL" } catch { } # Set verdict.
  try { Add-Step -Id "SYS" -Name "system" -Status "FAIL" -Data @{} -Note ($_.Exception.Message) } catch { } # Record system failure.
  try { Write-Report } catch { } # Try write report.
  Write-Host "[FAIL] System acceptance FAIL (commercial_v0)" # Log failure.
  exit 1 # Failure.
}
