param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ProjectId = "P_DEFAULT",
  [string]$GroupId = "G_CAF",
  [int64]$StartTs = 1430294400000,
  [int64]$EndTs = 1430298000000
)

$ErrorActionPreference = "Stop"

function Assert($cond, $msg) {
  if (-not $cond) { throw "ASSERT FAILED: $msg" }
}

function Curl-Json-WithRetry($url, $attempts = 30, $sleepMs = 500) {
  for ($i=1; $i -le $attempts; $i++) {
    try {
      $raw = & curl.exe -sS "$url" 2>$null
      if (-not $raw -or $raw.Trim() -eq "") { throw "empty" }
      return ($raw | ConvertFrom-Json)
    } catch {
      if ($i -eq $attempts) { return $null }
      Start-Sleep -Milliseconds $sleepMs
    }
  }
  return $null
}

Write-Host "== Apple IV v0 Agronomy Acceptance (Sprint 7: 3 endpoints) ==" -ForegroundColor Cyan

$qs = "projectId=$ProjectId&groupId=$GroupId&startTs=$StartTs&endTs=$EndTs"

$report = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/report?$qs"
Assert ($report -ne $null) "report returned null"
Assert ($report.type -eq "agronomy_report_v0") "type mismatch"
Assert ($report.schema_version -eq "0") "schema_version mismatch"
Assert ($report.report_id -like "ar_*") "report_id missing"
Assert ($report.determinism_hash -match "^[0-9a-f]{64}$") "determinism_hash invalid"

$summary = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/summary?$qs"
Assert ($summary -ne $null) "summary returned null"
Assert ($summary.type -eq "agronomy_report_summary_v0") "summary type mismatch"
Assert ($summary.report_id -eq $report.report_id) "summary report_id mismatch"
Assert ($summary.determinism_hash -eq $report.determinism_hash) "summary determinism_hash mismatch"
Assert ([int]$summary.metric_count -ge 0) "metric_count missing"
Assert ([int]$summary.marker_count -ge 0) "marker_count missing"

$ev = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/evidence_refs?$qs"
Assert ($ev -ne $null) "evidence_refs returned null"
Assert ($ev.type -eq "agronomy_evidence_refs_v0") "evidence_refs type mismatch"
Assert ($ev.report_id -eq $report.report_id) "evidence_refs report_id mismatch"
Assert ($ev.determinism_hash -eq $report.determinism_hash) "evidence_refs determinism_hash mismatch"
Assert ($ev.evidence_refs -is [System.Array]) "evidence_refs not array"

$report2 = Curl-Json-WithRetry "$BaseUrl/api/agronomy/v0/report?$qs"
Assert ($report2 -ne $null) "report2 returned null"
Assert ($report2.determinism_hash -eq $report.determinism_hash) "determinism_hash not stable"

Write-Host ("OK determinism_hash={0}" -f $report.determinism_hash)
Write-Host "PASS Apple IV v0 Agronomy Acceptance (Sprint 7)" -ForegroundColor Green
