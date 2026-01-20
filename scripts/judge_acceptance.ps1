# File: scripts/judge_acceptance.ps1
<#
GEOX · Judge Repeatable Acceptance (Frozen v1) - Official Entry

HARD BOUNDARIES (DO NOT VIOLATE):
- Do NOT modify: config/judge/default.json
- Do NOT modify Judge pipeline semantics (apps/judge): this script only reads & calls the public API.
- This script produces acceptance artifacts under acceptance/ (do NOT commit large outputs).

Artifacts (per frozen spec):
- acceptance/caf009_1h_YYYYMMDDTHHMMSSZ/
  - run.json            (HTTP raw response body, exact bytes)
  - summary.json        (flat top-level schema, fixed field names; must include sensor_id; list fields must be arrays and deduped)
  - window.json         (flat top-level schema; must include sensor_id and maxTs)
  - facts_sample.txt    (N=3, sorted by fact_id)
  - README.txt          (machine-generated PASS/FAIL report)
#>

[CmdletBinding()]
param(
  [string]$sensor_id = "CAF009",  # Frozen: only CAF009
  [int]$hours = 1                 # Frozen: only 1 hour
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# UTF-8 without BOM (PowerShell 5.1 Out-File -Encoding UTF8 writes BOM)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Fail([string]$msg) {
  Write-Host ""
  Write-Host ("FAIL: {0}" -f $msg) -ForegroundColor Red
  exit 1
}

function Get-RepoRoot {
  if (-not $PSScriptRoot) { Fail "PSScriptRoot is not available; cannot resolve repo root." }
  $p = Resolve-Path (Join-Path $PSScriptRoot "..")
  if (-not $p) { Fail "failed to resolve repo root from script path." }
  return $p.ProviderPath
}

function Parse-JsonDeep([string]$raw) {
  Add-Type -AssemblyName System.Web.Extensions | Out-Null
  $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $ser.MaxJsonLength = 2147483647
  $ser.RecursionLimit = 10000
  return $ser.DeserializeObject($raw)
}

function Read-JsonFile([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { Fail ("missing file: {0}" -f $path) }

  $raw = ""
  try {
    $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  } catch {
    Fail ("failed to read file as UTF-8: {0}. Error: {1}" -f $path, $_.Exception.Message)
  }

  try {
    return Parse-JsonDeep $raw
  } catch {
    Fail ("invalid JSON file: {0}. Error: {1}" -f $path, $_.Exception.Message)
  }
}

function New-UtcStamp {
  return (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'")
}

function Ensure-DockerAvailable {
  try { docker version | Out-Null } catch { Fail "docker is not available. Start Docker Desktop first." }
}

function Ensure-PostgresPsql {
  try {
    $names = docker ps --format "{{.Names}}"
    $hasPg = $false
    foreach ($n in $names) { if ($n -eq "geox-postgres") { $hasPg = $true; break } }
    if (-not $hasPg) { Fail "docker container 'geox-postgres' not found. Start via: docker compose up --build server" }
  } catch {
    Fail ("failed to inspect docker containers: {0}" -f $_.Exception.Message)
  }

  $testSql = "select 1 as ok;"
  try {
    $out = docker exec -i geox-postgres psql -U landos -d landos -t -A -c "$testSql"
    if ($out.Trim() -ne "1") { Fail ("psql connectivity check failed (expected 1, got '{0}')" -f $out.Trim()) }
  } catch {
    Fail ("cannot run psql inside geox-postgres: {0}" -f $_.Exception.Message)
  }
}

function Ensure-ApiReachable([string]$baseUrl) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/groups?projectId=P_DEFAULT" -Method Get -TimeoutSec 10
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) {
      Fail ("API probe failed: GET /api/groups returned HTTP {0}" -f $resp.StatusCode)
    }
  } catch {
    Fail ("API not reachable at {0}. Ensure docker compose server is up and port 3000 is exposed. Error: {1}" -f $baseUrl, $_.Exception.Message)
  }
}

function Exec-ScalarSql([string]$sql) {
  $out = docker exec -i geox-postgres psql -U landos -d landos -t -A -c "$sql"
  return $out.Trim()
}

function Escape-SqlLiteral([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace "'", "''")
}

function HttpPostRawBytes([string]$url, [string]$jsonBody) {
  try {
    # PS 5.1 Desktop: use Invoke-WebRequest and capture RawContentStream bytes.
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -Method Post -ContentType "application/json" -Body $jsonBody -TimeoutSec 120

    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) {
      Fail ("POST {0} failed: HTTP {1}" -f $url, $resp.StatusCode)
    }

    $ms = New-Object System.IO.MemoryStream
    $resp.RawContentStream.Position = 0
    $resp.RawContentStream.CopyTo($ms)
    return ,($ms.ToArray())
  } catch {
    Fail ("POST {0} failed. Error: {1}" -f $url, $_.Exception.Message)
  }
}

function Write-JsonNoBom([string]$path, [object]$obj, [int]$depth) {
  $json = $obj | ConvertTo-Json -Depth $depth
  [System.IO.File]::WriteAllText($path, $json, $Utf8NoBom)
}

function Has-Key($obj, [string]$key) {
  if ($null -eq $obj) { return $false }

  if ($obj -is [System.Collections.IDictionary]) {
    # Prefer ContainsKey if available (Hashtable / Dictionary<,> / many IDictionary impls)
    if ($obj.PSObject.Methods.Name -contains "ContainsKey") {
      try { return [bool]$obj.ContainsKey($key) } catch { return $false }
    }

    # Fallback to IDictionary.Contains(object) if present
    if ($obj.PSObject.Methods.Name -contains "Contains") {
      try { return [bool]$obj.Contains([object]$key) } catch { return $false }
    }

    return $false
  }

  return ($null -ne ($obj.PSObject.Properties.Match($key) | Select-Object -First 1))
}

function Get-Val($obj, [string]$key) {
  if (-not (Has-Key $obj $key)) { return $null }

  if ($obj -is [System.Collections.IDictionary]) {
    return $obj[$key]
  }

  return $obj.PSObject.Properties[$key].Value
}

# --- StrictMode-safe property access helpers ---
function Try-GetPropValue($obj, [string]$name) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties.Match($name) | Select-Object -First 1
  if ($null -eq $p) { return $null }
  return $p.Value
}

function As-Array($v) {
  if ($null -eq $v) { return @() }
  if ($v -is [System.Array]) { return @($v) }
  return @($v)
}

# ---------- main ----------

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

# Frozen: lock parameters to prevent disputes
if ($sensor_id -ne "CAF009") { Fail ("frozen acceptance only supports sensor_id=CAF009 (got '{0}')" -f $sensor_id) }
if ($hours -ne 1) { Fail ("frozen acceptance only supports hours=1 (got '{0}')" -f $hours) }

Ensure-DockerAvailable
$baseUrl = "http://127.0.0.1:3000"
Ensure-ApiReachable -baseUrl $baseUrl
Ensure-PostgresPsql

# SSOT read: expected_interval_ms must come from config/judge/default.json
$ssotPath = Join-Path $repoRoot "config/judge/default.json"
$ssot = Read-JsonFile -path $ssotPath

if (-not (Has-Key $ssot "time_coverage")) { Fail "SSOT missing path: time_coverage (in config/judge/default.json)" }
$tc = Get-Val $ssot "time_coverage"
if (-not (Has-Key $tc "expected_interval_ms")) { Fail "SSOT missing path: time_coverage.expected_interval_ms (in config/judge/default.json)" }

[int64]$expected_interval_ms = [int64](Get-Val $tc "expected_interval_ms")
if ($expected_interval_ms -le 0) { Fail ("invalid expected_interval_ms in SSOT: {0}" -f $expected_interval_ms) }

# Frozen: CAF009 expected 10 metric names (exact set match)
$expectedMetrics = @(
  "soil_moisture_vwc_30cm",
  "soil_moisture_vwc_60cm",
  "soil_moisture_vwc_90cm",
  "soil_moisture_vwc_120cm",
  "soil_moisture_vwc_150cm",
  "soil_temp_c_30cm",
  "soil_temp_c_60cm",
  "soil_temp_c_90cm",
  "soil_temp_c_120cm",
  "soil_temp_c_150cm"
)

# Frozen: window computed by data max(ts_ms) for sensor
$sensorSql = Escape-SqlLiteral $sensor_id
$maxTsSql = "select max(ts_ms) from raw_samples where sensor_id='$sensorSql';"
$maxTsRaw = Exec-ScalarSql -sql $maxTsSql
if (-not $maxTsRaw) { Fail ("raw_samples has no data for sensor_id={0} (max(ts_ms) is NULL)" -f $sensor_id) }

[int64]$maxTs = [int64]$maxTsRaw
[int64]$endTs = $maxTs
[int64]$startTs = $endTs - ([int64]$hours * 3600000)

if ($startTs -ge $endTs) { Fail ("invalid window computed: startTs >= endTs ({0} >= {1})" -f $startTs, $endTs) }

# Frozen: points_present = count(distinct ts_ms) within window, inclusive endTs
$pointsSql = "select count(distinct ts_ms) from raw_samples where sensor_id='$sensorSql' and ts_ms >= $startTs and ts_ms <= $endTs;"
[int64]$points_present = [int64](Exec-ScalarSql -sql $pointsSql)

# Frozen: expected_points / min_points_required
[int64]$expected_points = [int64][Math]::Floor(([int64]$hours * 3600000) / [double]$expected_interval_ms)
[int64]$min_points_required = [int64][Math]::Ceiling($expected_points * 0.9)

# Frozen: metrics_present (names) within window; exact set match; output missing/extra
$metricsSql = "select metric from raw_samples where sensor_id='$sensorSql' and ts_ms >= $startTs and ts_ms <= $endTs group by metric order by metric;"
$presentMetrics = @()
try {
  $presentMetrics = @(docker exec -i geox-postgres psql -U landos -d landos -t -A -c "$metricsSql" |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" })
} catch {
  Fail ("failed to query metrics in window: {0}" -f $_.Exception.Message)
}

$expectedSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $expectedMetrics) { [void]$expectedSet.Add($m) }

$presentSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $presentMetrics) { [void]$presentSet.Add($m) }

$missingMetrics = @()
foreach ($m in $expectedMetrics) { if (-not $presentSet.Contains($m)) { $missingMetrics += $m } }

$extraMetrics = @()
foreach ($m in $presentMetrics) { if (-not $expectedSet.Contains($m)) { $extraMetrics += $m } }

[int]$metrics_present = $presentSet.Count

# PASS/FAIL aggregation (frozen checks)
$pass = $true
$failReasons = New-Object System.Collections.Generic.List[string]

if ($points_present -lt $min_points_required) {
  $pass = $false
  $failReasons.Add(("points_present({0}) < min_points_required({1})" -f $points_present, $min_points_required))
}

if (($missingMetrics.Count -gt 0) -or ($extraMetrics.Count -gt 0) -or ($metrics_present -ne 10)) {
  $pass = $false
  $failReasons.Add(("metrics set mismatch: present={0} expected=10 missing={1} extra={2}" -f $metrics_present, $missingMetrics.Count, $extraMetrics.Count))
}

# Output directory
$stamp = New-UtcStamp
$outDirRel = Join-Path "acceptance" ("caf009_1h_{0}" -f $stamp)
$outDir = Join-Path $repoRoot $outDirRel
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Call Judge
$bodyObj = @{
  subjectRef = @{ projectId = "P_DEFAULT"; groupId = "G_CAF" }
  scale      = "group"
  window     = @{ startTs = $startTs; endTs = $endTs }
}
$bodyJson = $bodyObj | ConvertTo-Json -Depth 10 -Compress
$runUrl = "$baseUrl/api/judge/run"

# run.json: must save HTTP raw response body bytes (exact)
[byte[]]$runBytes = HttpPostRawBytes -url $runUrl -jsonBody $bodyJson
$runJsonPath = Join-Path $outDir "run.json"
[System.IO.File]::WriteAllBytes($runJsonPath, $runBytes)

# Parse JSON without altering run.json
$rawRunBodyText = ""
try {
  $rawRunBodyText = [System.Text.Encoding]::UTF8.GetString($runBytes)
} catch {
  Fail ("failed to decode run.json as UTF-8 for JSON parsing (run.json saved): {0}" -f $outDirRel)
}

$parsedRun = $null
try {
  $parsedRun = Parse-JsonDeep $rawRunBodyText
} catch {
  Fail ("Judge returned non-JSON response. run.json saved at: {0}" -f $outDirRel)
}

# Required fields existence (StrictMode-safe)
foreach ($k in @("run_id","determinism_hash","effective_config_hash","input_fact_ids","problem_states","ao_sense")) {
  if (-not (Has-Key $parsedRun $k)) { Fail ("Judge response missing field: {0}" -f $k) }
}

$run_id = [string](Get-Val $parsedRun "run_id")
$determinism_hash = [string](Get-Val $parsedRun "determinism_hash")
$effective_config_hash = [string](Get-Val $parsedRun "effective_config_hash")

# --- Extract list fields + dedupe (frozen requirement) ---
$problemTypes = @()
foreach ($ps in As-Array (Get-Val $parsedRun "problem_states")) {
  $pt = $null
  if ($ps -is [System.Collections.IDictionary]) {
    if (Has-Key $ps "problem_type") { $pt = Get-Val $ps "problem_type" }
  } else {
    $pt = Try-GetPropValue $ps "problem_type"
  }
  if ($pt) { $problemTypes += [string]$pt }
}

$uncertaintySources = @()
foreach ($ps in As-Array (Get-Val $parsedRun "problem_states")) {
  $us = $null
  if ($ps -is [System.Collections.IDictionary]) {
    if (Has-Key $ps "uncertainty_sources") { $us = Get-Val $ps "uncertainty_sources" }
  } else {
    $us = Try-GetPropValue $ps "uncertainty_sources"
  }

  foreach ($u in As-Array $us) {
    if ($u) { $uncertaintySources += [string]$u }
  }
}

$aoSenseKinds = @()
$aoSenseFocus = @()
foreach ($a in As-Array (Get-Val $parsedRun "ao_sense")) {
  $k = $null
  $f = $null

  if ($a -is [System.Collections.IDictionary]) {
    if (Has-Key $a "sense_kind") { $k = Get-Val $a "sense_kind" }
    if (Has-Key $a "sense_focus") { $f = Get-Val $a "sense_focus" }
  } else {
    $k = Try-GetPropValue $a "sense_kind"
    $f = Try-GetPropValue $a "sense_focus"
  }

  if ($k) { $aoSenseKinds += [string]$k }
  if ($f) { $aoSenseFocus += [string]$f }
}

# Force arrays ALWAYS (even when empty), then dedupe
$problemTypes = @($problemTypes | Where-Object { $_ -and $_.Trim() -ne "" } | Sort-Object -Unique)
$uncertaintySources = @($uncertaintySources | Where-Object { $_ -and $_.Trim() -ne "" } | Sort-Object -Unique)
$aoSenseKinds = @($aoSenseKinds | Where-Object { $_ -and $_.Trim() -ne "" } | Sort-Object -Unique)
$aoSenseFocus = @($aoSenseFocus | Where-Object { $_ -and $_.Trim() -ne "" } | Sort-Object -Unique)

# Frozen: SAMPLING_DENSITY assertion source is uncertainty_sources only
if ($points_present -ge $min_points_required) {
  if ($uncertaintySources -contains "SAMPLING_DENSITY") {
    $pass = $false
    $failReasons.Add("uncertainty_sources contains SAMPLING_DENSITY while points_present >= min_points_required")
  }
}

# facts_sample.txt: N=3, input_fact_ids sorted lexicographically, take first N
[int]$N = 3
$factIds = @()
foreach ($fid in As-Array (Get-Val $parsedRun "input_fact_ids")) { $factIds += [string]$fid }
$factIds = $factIds | Sort-Object
$sampleFactIds = $factIds | Select-Object -First $N

$factsSamplePath = Join-Path $outDir "facts_sample.txt"
$factsLines = New-Object System.Collections.Generic.List[string]

foreach ($fid in $sampleFactIds) {
  $fidSql = Escape-SqlLiteral $fid
  $factSql = "select fact_id, occurred_at, left(record_json, 220) as head from facts where fact_id = '$fidSql';"
  try {
    $row = docker exec -i geox-postgres psql -U landos -d landos -t -A -F " | " -c "$factSql"
    $row = $row.Trim()
    if (-not $row) {
      $factsLines.Add("$fid | <MISSING> | <MISSING>")
    } else {
      $row = $row -replace "`r`n", " "
      $row = $row -replace "`n", " "
      $factsLines.Add($row)
    }
  } catch {
    $factsLines.Add("$fid | <ERROR> | $($_.Exception.Message)")
  }
}
[System.IO.File]::WriteAllLines($factsSamplePath, $factsLines.ToArray(), $Utf8NoBom)

# window.json (flat schema; must include sensor_id and maxTs)
$windowObj = [ordered]@{
  sensor_id            = $sensor_id
  hours                = $hours
  maxTs                = $maxTs
  startTs              = $startTs
  endTs                = $endTs
  expected_interval_ms = $expected_interval_ms
  expected_points      = $expected_points
  min_points_required  = $min_points_required
  points_present       = $points_present
  metrics_present      = $metrics_present
}
$windowPath = Join-Path $outDir "window.json"
Write-JsonNoBom -path $windowPath -obj $windowObj -depth 20

# summary.json (flat schema; must include sensor_id; list fields must be arrays and deduped)
$summaryObj = [ordered]@{
  run_id                = $run_id
  determinism_hash      = $determinism_hash
  effective_config_hash = $effective_config_hash
  groupId               = "G_CAF"
  sensor_id             = $sensor_id
  hours                 = $hours
  expected_interval_ms  = $expected_interval_ms
  points_present        = $points_present
  expected_points       = $expected_points
  metrics_present       = $metrics_present
  problem_types         = $problemTypes
  uncertainty_sources   = $uncertaintySources
  ao_sense_kinds        = $aoSenseKinds
  ao_sense_focus        = $aoSenseFocus
}
$summaryPath = Join-Path $outDir "summary.json"
Write-JsonNoBom -path $summaryPath -obj $summaryObj -depth 50

# README.txt (machine-generated report)
$readmeTxt = @()
$readmeTxt += "GEOX · Judge Acceptance (Frozen v1)"
$readmeTxt += ""
$readmeTxt += ("Result: {0}" -f ($(if ($pass) { "PASS" } else { "FAIL" })))
$readmeTxt += ("OutputDir: {0}" -f $outDirRel)
$readmeTxt += ""
$readmeTxt += "Truth (frozen):"
$readmeTxt += "  projectId=P_DEFAULT"
$readmeTxt += "  groupId=G_CAF"
$readmeTxt += ("  sensor_id={0}" -f $sensor_id)
$readmeTxt += ""
$readmeTxt += "Window:"
$readmeTxt += ("  maxTs={0}" -f $maxTs)
$readmeTxt += ("  startTs={0}" -f $startTs)
$readmeTxt += ("  endTs={0}" -f $endTs)
$readmeTxt += ("  hours={0}" -f $hours)
$readmeTxt += ""
$readmeTxt += "SSOT:"
$readmeTxt += ("  expected_interval_ms (from config/judge/default.json): {0}" -f $expected_interval_ms)
$readmeTxt += ""
$readmeTxt += "Data checks:"
$readmeTxt += ("  points_present={0}" -f $points_present)
$readmeTxt += ("  expected_points={0}" -f $expected_points)
$readmeTxt += ("  min_points_required={0} (ceil(expected_points*0.9))" -f $min_points_required)
$readmeTxt += ("  metrics_present={0} (expected=10)" -f $metrics_present)
$readmeTxt += ("  metrics_missing={0}" -f ($(if ($missingMetrics.Count -eq 0) { "<none>" } else { ($missingMetrics -join ", ") })))
$readmeTxt += ("  metrics_extra={0}" -f ($(if ($extraMetrics.Count -eq 0) { "<none>" } else { ($extraMetrics -join ", ") })))
$readmeTxt += ""
$readmeTxt += "Judge call:"
$readmeTxt += "  POST /api/judge/run"
$readmeTxt += ("  run_id={0}" -f $run_id)
$readmeTxt += ("  determinism_hash={0}" -f $determinism_hash)
$readmeTxt += ("  effective_config_hash={0}" -f $effective_config_hash)
$readmeTxt += ""
$readmeTxt += "Assertions:"
$readmeTxt += "  If points_present >= min_points_required: uncertainty_sources MUST NOT contain SAMPLING_DENSITY"
$readmeTxt += "  sampling: input_fact_ids sorted lexicographically; take N=3; each line: fact_id | occurred_at | record_json[0..219]"
$readmeTxt += ""
if (-not $pass) {
  $readmeTxt += "Failure reasons:"
  foreach ($r in $failReasons) { $readmeTxt += ("  - {0}" -f $r) }
  $readmeTxt += ""
}
$readmeTxt += "Artifacts:"
$readmeTxt += "  - run.json (HTTP raw response body bytes)"
$readmeTxt += "  - summary.json (flat schema; includes sensor_id; list fields arrays deduped)"
$readmeTxt += "  - window.json (flat schema; includes sensor_id and maxTs)"
$readmeTxt += "  - facts_sample.txt"
$readmeTxt += "  - README.txt"

$readmeTxtPath = Join-Path $outDir "README.txt"
[System.IO.File]::WriteAllLines($readmeTxtPath, $readmeTxt, $Utf8NoBom)

Write-Host ""
Write-Host ("Output: {0}" -f $outDirRel)
Write-Host ("Result: {0}" -f ($(if ($pass) { "PASS" } else { "FAIL" })))
Write-Host ("points_present={0}, min_points_required={1}, expected_interval_ms={2}" -f $points_present, $min_points_required, $expected_interval_ms)
Write-Host ("metrics_present={0}, missing={1}, extra={2}" -f $metrics_present, $missingMetrics.Count, $extraMetrics.Count)

if (-not $pass) { exit 2 } else { exit 0 }
