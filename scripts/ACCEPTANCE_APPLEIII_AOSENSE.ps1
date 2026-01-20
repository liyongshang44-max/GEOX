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

Write-Host "== Apple III v0 AO-SENSE Acceptance =="

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

# 3) Create Receipt (must reference evidence; v0 allows referencing ledger fact_id)
$receiptBodyObj = @{
  task_id = $task.task_id
  executed_at_ts = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  result = "success"
  evidence_refs = @(@{ kind="fact_id"; ref_id=$task.fact_id })
}

$receiptJson = ($receiptBodyObj | ConvertTo-Json -Depth 20)
$receipt = Post-JsonString "$BaseUrl/api/control/ao_sense/receipt" $receiptJson

if ($receipt.ok -ne $true) { throw ("RECEIPT_CREATE_FAILED: " + ($receipt | ConvertTo-Json -Depth 20)) }

Write-Host ("OK task_id={0} fact_id={1}" -f $task.task_id, $task.fact_id)
Write-Host ("OK receipt_id={0} fact_id={1}" -f $receipt.receipt_id, $receipt.fact_id)

Write-Host "PASS Apple III v0 AO-SENSE Acceptance"