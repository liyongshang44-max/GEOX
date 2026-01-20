param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Invoke-WithRetry($fn, [int]$MaxAttempts = 20, [int]$SleepMs = 300) {
  $lastErr = $null
  for ($i=1; $i -le $MaxAttempts; $i++) {
    try {
      return & $fn
    } catch {
      $lastErr = $_
      Start-Sleep -Milliseconds $SleepMs
    }
  }
  throw ("RETRY_EXHAUSTED: " + $lastErr)
}

function Wait-ServerReady() {
  Invoke-WithRetry {
    $raw = curl.exe -sS "$BaseUrl/api/judge/problem_states?limit=1"
    if (-not $raw) { throw "EMPTY_RESPONSE" }
    $obj = $raw | ConvertFrom-Json
    if ($null -eq $obj) { throw "JSON_PARSE_NULL" }
    return $true
  } 30 250 | Out-Null
}

function Post-JsonFile($url, $path) {
  return Invoke-WithRetry {
    $raw = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$path"
    if (-not $raw) { throw "EMPTY_RESPONSE" }
    return ($raw | ConvertFrom-Json)
  } 15 250
}

function Post-JsonString($url, $json) {
  $tmp = Join-Path $env:TEMP ("geox_post_{0}.json" -f ([guid]::NewGuid().ToString("N")))
  $json | Out-File -Encoding utf8 -FilePath $tmp
  try {
    return Invoke-WithRetry {
      $raw = curl.exe -sS -X POST $url -H "Content-Type: application/json" --data-binary "@$tmp"
      if (-not $raw) { throw "EMPTY_RESPONSE" }
      return ($raw | ConvertFrom-Json)
    } 15 250
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Get-NextTask($projectId, $groupId) {
  $hdr = Join-Path $env:TEMP ("geox_hdr_{0}.txt" -f ([guid]::NewGuid().ToString("N")))
  $body = Join-Path $env:TEMP ("geox_body_{0}.txt" -f ([guid]::NewGuid().ToString("N")))
  $url = "$BaseUrl/api/control/ao_sense/next_task?projectId=$projectId&groupId=$groupId"
  $null = curl.exe -sS -D $hdr -o $body $url
  $statusLine = (Get-Content $hdr | Select-Object -First 1)
  $status = [int]($statusLine.Split(" ")[1])
  $content = ""
  if (Test-Path $body) { $content = (Get-Content $body -Raw) }
  Remove-Item $hdr,$body -Force -ErrorAction SilentlyContinue
  return @{ status = $status; body = $content }
}

function Assert($cond, $msg) {
  if (-not $cond) { throw "ASSERT FAILED: $msg" }
}

Write-Host "== Apple III v0 AO-SENSE Acceptance (Sprint 4: next_task selector, no contract change) =="

Wait-ServerReady

$inputPath = ".\acceptance\acceptance_input_caf009_1h.json"
if (-not (Test-Path $inputPath)) { throw "MISSING_INPUT_JSON: $inputPath" }

# 1) Judge run (source of AO-SENSE)
$run = Post-JsonFile "$BaseUrl/api/judge/run" $inputPath
Assert ($run -ne $null) "judge/run returned null"

if ($null -eq $run.ao_sense -or $run.ao_sense.Count -eq 0) { throw "NO_AO_SENSE_FROM_JUDGE" }

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

# 3) next_task must return this task (since no receipt exists yet)
$nt = Get-NextTask "P_DEFAULT" "G_CAF"
Assert ($nt.status -eq 200) ("next_task status != 200 (got {0})" -f $nt.status)
$ntObj = ($nt.body | ConvertFrom-Json)
Assert ($ntObj.ok -eq $true) "next_task ok!=true"
Assert ($ntObj.item.record_json.task_id -eq $task.task_id) "next_task did not return the created task"
Write-Host ("OK next_task returned task_id={0}" -f $ntObj.item.record_json.task_id)

# 4) Create executor marker (no marker contract change): encode executor in note as structured JSON
$markerTs = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$executorMeta = @{ executor_kind = "human"; executor_id = "demo_executor_001"; task_id = $task.task_id } | ConvertTo-Json -Compress
$markerBodyObj = @{
  ts = $markerTs
  sensorId = "CAF009"
  groupId = "G_CAF"
  type = "local_anomaly"
  source = "human"
  note = ("AO_SENSE_EXECUTION " + $executorMeta)
}

$markerJson = ($markerBodyObj | ConvertTo-Json -Depth 20)
$marker = Post-JsonString "$BaseUrl/api/marker" $markerJson
if ($marker.ok -ne $true) { throw ("MARKER_CREATE_FAILED: " + ($marker | ConvertTo-Json -Depth 20)) }
Write-Host ("OK executor marker fact_id={0}" -f $marker.fact_id)

# 5) Create Receipt referencing marker_v1
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

# 6) next_task must now return 204
$nt2 = Get-NextTask "P_DEFAULT" "G_CAF"
Assert ($nt2.status -eq 204) ("next_task status != 204 (got {0}) body={1}" -f $nt2.status, $nt2.body)

Write-Host "PASS Apple III v0 AO-SENSE Acceptance (Sprint 4 next_task selector)"