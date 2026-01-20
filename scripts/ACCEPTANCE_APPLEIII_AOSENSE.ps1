param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Post-JsonFile($url, $path) {
  $raw = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$path"
  return ($raw | ConvertFrom-Json)
}

function Post-JsonString($url, $json) {
  $tmp = Join-Path $env:TEMP ("geox_post_{0}.json" -f ([guid]::NewGuid().ToString("N")))
  $json | Out-File -Encoding utf8 -FilePath $tmp
  $raw = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$tmp"
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  return ($raw | ConvertFrom-Json)
}

Write-Host "== Apple III v0 AO-SENSE Acceptance (Sprint 2: marker_v1 evidence) =="

$inputPath = ".\acceptance\acceptance_input_caf009_1h.json"
if (-not (Test-Path $inputPath)) { throw "MISSING_INPUT_JSON: $inputPath" }

# 1) Judge run (source of AO-SENSE)
$run = Post-JsonFile "$BaseUrl/api/judge/run" $inputPath

if ($null -eq $run.ao_sense -or $run.ao_sense.Count -eq 0) {
  throw "NO_AO_SENSE_FROM_JUDGE"
}

$ao = $run.ao_sense[0]

# 2) Create Task (Apple III responsibility: persist Judge output into facts)
$taskBodyObj = @{
  subjectRef = $ao.subjectRef
  window = $ao.window
  sense_kind = $ao.sense_kind
  sense_focus = $ao.sense_focus
  priority = $ao.priority
  supporting_problem_state_id = $ao.supporting_problem_state_id
  supporting_determinism_hash = $run.determinism_hash
  supporting_effective_config_hash = $run.effective_config_hash
}

$taskJson = ($taskBodyObj | ConvertTo-Json -Depth 20)
$task = Post-JsonString "$BaseUrl/api/control/ao_sense/task" $taskJson

if ($task.ok -ne $true) { throw ("TASK_CREATE_FAILED: " + ($task | ConvertTo-Json -Depth 20)) }

Write-Host ("OK task_id={0} fact_id={1}" -f $task.task_id, $task.fact_id)

# 3) Create a marker_v1 as "real new evidence" (Sprint 2 evidence policy)
# Marker is a ledger fact and does not introduce agronomy/value judgement.
$markerTs = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$markerBodyObj = @{
  ts = $markerTs
  sensorId = "CAF009"
  groupId = "G_CAF"
  type = "local_anomaly"
  source = "human"
  note = ("AO-SENSE receipt evidence marker; task_id={0}" -f $task.task_id)
}

$markerJson = ($markerBodyObj | ConvertTo-Json -Depth 20)
$marker = Post-JsonString "$BaseUrl/api/marker" $markerJson

if ($marker.ok -ne $true) { throw ("MARKER_CREATE_FAILED: " + ($marker | ConvertTo-Json -Depth 20)) }

Write-Host ("OK marker fact_id={0}" -f $marker.fact_id)

# 4) Create Receipt (must reference evidence; Sprint 2 uses marker_v1 ref)
$receiptBodyObj = @{
  task_id = $task.task_id
  executed_at_ts = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  result = "success"
  evidence_refs = @(@{ kind="marker_v1"; ref_id=$marker.fact_id })
}

$receiptJson = ($receiptBodyObj | ConvertTo-Json -Depth 20)
$receipt = Post-JsonString "$BaseUrl/api/control/ao_sense/receipt" $receiptJson

if ($receipt.ok -ne $true) { throw ("RECEIPT_CREATE_FAILED: " + ($receipt | ConvertTo-Json -Depth 20)) }

Write-Host ("OK receipt_id={0} fact_id={1}" -f $receipt.receipt_id, $receipt.fact_id)

# 5) Non-regression: rerun Judge (no requirement that problem_state improves)
$run2 = Post-JsonFile "$BaseUrl/api/judge/run" $inputPath
if ($run2.determinism_hash -ne $run.determinism_hash) {
  throw ("NON_REGRESSION_FAILED: determinism_hash changed ({0} -> {1})" -f $run.determinism_hash, $run2.determinism_hash)
}

Write-Host "PASS Apple III v0 AO-SENSE Acceptance (Sprint 2 marker evidence)"