param(
  [string]$BaseUrl = "http://localhost:3000", # Base URL for server endpoints.
  [string]$ProjectId = "P_DEFAULT", # Project identifier for agronomy queries.
  [string]$GroupId = "G_CAF", # Group identifier for agronomy queries.
  [int64]$StartTs = 1430294400000, # Inclusive window start timestamp (ms).
  [int64]$EndTs = 1430298000000 # Exclusive window end timestamp (ms).
)

$ErrorActionPreference = "Stop" # Fail fast on all errors.

function Assert($cond, $msg) { # Simple assertion helper.
  if (-not $cond) { throw "ASSERT FAILED: $msg" } # Throw with consistent prefix for log grep.
}

function Get-ObjPropNamesSorted($obj) { # Return sorted property names of a PSObject.
  if ($null -eq $obj) { return @() } # Null-safe.
  return @($obj.PSObject.Properties.Name | Sort-Object) # Deterministic order for comparison.
}

function Curl-Json-WithRetry($url, $attempts = 120, $sleepMs = 500) { # GET JSON with retry loop.
  $lastErr = $null # Keep last error message for diagnostics.
  for ($i=1; $i -le $attempts; $i++) { # Retry loop.
    try {
      $raw = & curl.exe -sS "$url" 2>&1 # Fetch as text, capture stderr.
      $exit = $LASTEXITCODE # Capture curl exit code.
      if ($exit -ne 0) { throw ("curl_exit={0} {1}" -f $exit, ($raw | Out-String).Trim()) } # Fail on curl error.
      if (-not $raw -or ($raw | Out-String).Trim() -eq "") { throw "empty" } # Fail on empty response.
      return (($raw | Out-String) | ConvertFrom-Json) # Parse JSON into object.
    } catch {
      $lastErr = $_.Exception.Message # Record error.
      if ($i -eq $attempts) { # Final attempt exhausted.
        if ($lastErr) { Write-Host ("Curl-Json-WithRetry failed: {0}" -f $lastErr) -ForegroundColor Yellow } # Log warning.
        return $null # Return null on failure after retries.
      }
      Start-Sleep -Milliseconds $sleepMs # Backoff before retry.
    }
  }
  if ($lastErr) { Write-Host ("Curl-Json-WithRetry failed: {0}" -f $lastErr) -ForegroundColor Yellow } # Defensive log.
  return $null # Defensive null return.
}

function Curl-Json-WithStatus($url) { # GET JSON while preserving HTTP status code (for negative tests).
  $tmpBody = [System.IO.Path]::GetTempFileName() # Temp file for response body.
  try {
    $args = @() # Build curl args.
    $args += "-sS" # Silent but show errors.
    $args += "-o" ; $args += $tmpBody # Write body to file.
    $args += "-w" ; $args += "%{http_code}" # Print status code only.
    $args += "$url" # URL.
    $code = & curl.exe @args 2>$null # Execute curl; capture stdout as status code string.
    if ($LASTEXITCODE -ne 0) { throw "curl_exit=$LASTEXITCODE" } # Fail if curl failed.
    $raw = Get-Content -LiteralPath $tmpBody -Raw -Encoding UTF8 # Read body text.
    $obj = $null # Parsed JSON placeholder.
    if ($raw -and $raw.Trim().Length -gt 0) { $obj = $raw | ConvertFrom-Json } # Parse if non-empty.
    return [pscustomobject]@{ status = [int]$code; body = $obj; raw = $raw } # Return status+body.
  } finally {
    if (Test-Path -LiteralPath $tmpBody) { Remove-Item -LiteralPath $tmpBody -Force } # Cleanup temp body file.
  }
}

Write-Host "== Apple IV v0 Agronomy Acceptance (Sprint 7: 3 endpoints + Sprint 8 negative checks) ==" -ForegroundColor Cyan # Header.

$qs = "projectId=$ProjectId&groupId=$GroupId&startTs=$StartTs&endTs=$EndTs" # Build stable query string.

$report = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/report?$qs" # Fetch report.
Assert ($report -ne $null) "report returned null" # Must return object.
Assert ($report.type -eq "agronomy_report_v0") "type mismatch" # Must match contract.
Assert ($report.schema_version -eq "0") "schema_version mismatch" # Must match version.
Assert ($report.report_id -like "ar_*") "report_id missing" # Must be prefixed.
Assert ($report.determinism_hash -match "^[0-9a-f]{64}$") "determinism_hash invalid" # Must be 64-hex.

$summary = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/summary?$qs" # Fetch summary.
Assert ($summary -ne $null) "summary returned null" # Must return object.
Assert ($summary.type -eq "agronomy_report_summary_v0") "summary type mismatch" # Must match contract.
Assert ($summary.schema_version -eq "0") "summary schema_version mismatch" # Must match version.
Assert ($summary.report_id -eq $report.report_id) "summary report_id mismatch" # Must align with report.
Assert ($summary.determinism_hash -eq $report.determinism_hash) "summary determinism_hash mismatch" # Must align determinism.
Assert ([int]$summary.metric_count -ge 0) "metric_count missing" # Must be non-negative.
Assert ([int]$summary.marker_count -ge 0) "marker_count missing" # Must be non-negative.

$ev = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/evidence_refs?$qs" # Fetch evidence refs.
Assert ($ev -ne $null) "evidence_refs returned null" # Must return object.
Assert ($ev.type -eq "agronomy_evidence_refs_v0") "evidence_refs type mismatch" # Must match contract.
Assert ($ev.schema_version -eq "0") "evidence_refs schema_version mismatch" # Must match version.
Assert ($ev.report_id -eq $report.report_id) "evidence_refs report_id mismatch" # Must align with report.
Assert ($ev.determinism_hash -eq $report.determinism_hash) "evidence_refs determinism_hash mismatch" # Must align determinism.
Assert ($ev.evidence_refs -is [System.Array]) "evidence_refs not array" # Must be an array.

# Sprint 8 negative checks: EvidenceRef is POINTER ONLY (kind, ref_id) with no extra fields.
foreach ($r in $ev.evidence_refs) { # Iterate each evidence ref.
  $props = Get-ObjPropNamesSorted $r # Get property names.
  $joined = ($props -join ",") # Join for exact comparison.
  Assert ($joined -eq "kind,ref_id") "EvidenceRef has extra/missing fields: $joined" # Enforce pointer-only schema.
  Assert ([string]$r.kind -ne "") "EvidenceRef.kind empty" # Kind must be present.
  Assert ([string]$r.ref_id -ne "") "EvidenceRef.ref_id empty" # Ref id must be present.
}

# Determinism stability: repeated calls must return same determinism_hash and evidence_refs order.
$report2 = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/report?$qs" # Fetch report again.
Assert ($report2 -ne $null) "report2 returned null" # Must return object.
Assert ($report2.determinism_hash -eq $report.determinism_hash) "determinism_hash not stable" # Must be stable.

$ev2 = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/evidence_refs?$qs" # Fetch evidence refs again.
Assert ($ev2 -ne $null) "evidence_refs2 returned null" # Must return object.
Assert (($ev2.evidence_refs | ConvertTo-Json -Compress) -eq ($ev.evidence_refs | ConvertTo-Json -Compress)) "evidence_refs not stable" # Must be stable and ordered.

# Error contract sanity: missing projectId must return { ok:false, error } with 400.
$badResp = Curl-Json-WithStatus "$BaseUrl/api/agronomy/v0/summary?groupId=$GroupId&startTs=$StartTs&endTs=$EndTs" # Make bad request.
Assert ($badResp -ne $null) "bad-request returned null" # Must return wrapper object.
Assert ($badResp.status -eq 400) "bad-request status must be 400 (got $($badResp.status))" # Must be 400.
Assert ($badResp.body -ne $null) "bad-request body null" # Must return JSON.
Assert ($badResp.body.ok -eq $false) "bad-request ok must be false" # Must indicate failure.
Assert ([string]$badResp.body.error -match "missing_or_invalid_projectId") "bad-request error mismatch" # Must match error code.

Write-Host ("OK determinism_hash={0}" -f $report.determinism_hash) # Print determinism hash.
Write-Host "PASS Apple IV v0 Agronomy Acceptance (Sprint 7 + Sprint 8)" -ForegroundColor Green # Success line.
