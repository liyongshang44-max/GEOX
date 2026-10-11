#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Repo = 'D:\gptdown\GEOX-cap09-iso-execution-72dc0304a21a',
  [string]$EvidenceRoot = 'D:\gptdown\MCFT-CAP09-ISOLATED-INFRA-20261010',
  [string]$RetryBundle,
  [switch]$Execute
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Signed retry dispatch shares the Node gate. No-bundle mode remains read-only.
# Default-unadopted trust rejects live effects before source/network checks.
function GitRead([string[]]$Arguments) {
  $lines = & git -C $Repo @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw "GIT_READ_FAILED: $($Arguments -join ' ')" }
  return ([string[]]@($lines) -join "`n").Trim()
}
if ($Execute -or $RetryBundle) {
  if (-not $RetryBundle) { throw 'RETRY_BUNDLE_REQUIRED' }
  if (-not [System.IO.Path]::IsPathRooted($RetryBundle)) { throw 'RETRY_BUNDLE_ABSOLUTE_PATH_REQUIRED' }
  $runner = Join-Path $Repo 'scripts\runtime_acceptance\RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs'
  $mode = if ($Execute) { '--execute' } else { '--preflight-only' }
  & node $runner '--operator-authorized' '--governed-retry' $mode '--all' '--retry-bundle' $RetryBundle
  if ($LASTEXITCODE -ne 0) { throw 'GOVERNED_RETRY_STOPPED_NO_AUTOMATIC_RETRY' }
  return
}
if (-not (Test-Path -LiteralPath $Repo -PathType Container)) { throw 'SOURCE_REPO_MISSING' }
if (-not (Test-Path -LiteralPath $EvidenceRoot -PathType Container)) { throw 'EVIDENCE_ROOT_MISSING' }
$head = GitRead @('rev-parse', 'HEAD')
$origin = GitRead @('ls-remote', 'origin', 'refs/heads/main')
$main = ($origin -split '\s+')[0]
$staged = GitRead @('diff', '--cached', '--name-only')
$unstaged = GitRead @('diff', '--name-only')
$untracked = GitRead @('ls-files', '--others', '--exclude-standard')
$original = Join-Path $EvidenceRoot 'qualification-evidence-72dc0304a21a-20261011T00Z\started.json'
$oldAudit = Join-Path $EvidenceRoot 'failed-first-execute-readonly-audit-v2.json'
$clean = ($staged.Length -eq 0 -and $unstaged.Length -eq 0 -and $untracked.Length -eq 0)
$previous = (Test-Path -LiteralPath $original -PathType Leaf) -and (Test-Path -LiteralPath $oldAudit -PathType Leaf)
$result = [ordered]@{
 schema_version = 'geox_mcft_cap09_windows_local_entry_readonly_v1'
 timestamp_utc = [DateTime]::UtcNow.ToString('o')
 source_head = $head
 protected_main = $main
 exact_protected_main = ($head -eq $main)
 source_clean = $clean
 original_attempt_evidence_present = $previous
 github_actions_required_for_provider_execution = $false
 producer_execution_implemented = $false
 timing_execution_implemented = $false
 controlled_delay_execution_implemented = $false
 evidence_receipt_write_performed = $false
 execute_authorized = $false
 retry_authorized = $false
 status = 'LOCAL_EXECUTION_BOUNDARY_READONLY_EXECUTE_HOLD'
}
$result | ConvertTo-Json -Depth 5
Write-Host 'NO_PROVIDER_NO_DATABASE_WRITE_NO_OBJECT_STORAGE_WRITE'
