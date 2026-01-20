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

function Get-Json($url) {
  $raw = curl.exe -sS $url
  return ($raw | ConvertFrom-Json)
}

function Assert($cond, $msg) {
  if (-not $cond) { throw "ASSERT FAILED: $msg" }
}

Write-Host "== Apple III v0 AO-SENSE Acceptance (Sprint 3: readonly projections) =="

$inputPath = ".\acceptance\acceptance_input_caf009_1h.json"
if (-not (Test-Path $inputPath)) { throw "MISSING_INPUT_JSON: $inputPath" }

# 1) Judge run (source of AO-SENSE)
$run = Post-JsonFile "$BaseUrl/api/judge/run" $inputPath
Assert ($run -ne $null) "judge/run returned null"

if ($null -eq $run.ao_sense -or $run.ao_sense.Count -eq 0) {
  throw "NO_AO_SENSE_FROM_JUDGE"
}

$ao = $run.ao_sense[0]

# 2) Create Task
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

# 3) Create marker_v1 as real evidence
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

# 4) Create Receipt referencing marker_v1
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

# 6) Read-only projections: tasks/receipts must be queryable from facts
$tasks = Get-Json ("$BaseUrl/api/control/ao_sense/tasks?projectId=P_DEFAULT&groupId=G_CAF&limit=50")
Assert ($tasks.ok -eq $true) "tasks endpoint ok!=true"
Assert ($tasks.items.Count -ge 1) "tasks.items empty"
$foundTask = $false
foreach ($it in $tasks.items) {
  if ($it.record_json -ne $null -and $it.record_json.task_id -eq $task.task_id) { $foundTask = $true }
}
Assert ($foundTask) "created task not found in tasks projection"

$receipts = Get-Json ("$BaseUrl/api/control/ao_sense/receipts?task_id=$($task.task_id)&limit=50")
Assert ($receipts.ok -eq $true) "receipts endpoint ok!=true"
Assert ($receipts.items.Count -ge 1) "receipts.items empty"
$foundReceipt = $false
foreach ($it in $receipts.items) {
  if ($it.record_json -ne $null -and $it.record_json.receipt_id -eq $receipt.receipt_id) { $foundReceipt = $true }
}
Assert ($foundReceipt) "created receipt not found in receipts projection"

Write-Host "PASS Apple III v0 AO-SENSE Acceptance (Sprint 3 readonly projections)"