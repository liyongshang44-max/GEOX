#requires -Version 5.1
<#
CAP-09 Attempt-3 local Windows inspection, READ ONLY.
This script is not the signed Host preflight, cannot issue/consume a Permit,
cannot prove any physical stage and does not touch Provider / PG / S3.
Output is one JSON object, no credentials or input-file content.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [string]$SignedInput = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$blockers = New-Object System.Collections.Generic.List[string]
$information = New-Object System.Collections.Generic.List[string]
$begin = [DateTime]::UtcNow.ToString('o')
function ReadGit([string[]]$Params) {
  $output = & git -C $Repo @Params 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('GIT_READ_FAILED:' + ($Params -join ' ')) }
  return (([string[]]@($output)) -join [Environment]::NewLine).Trim()
}
function ShaFile([string]$File) {
  if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { return $null }
  return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()
}
$head=$null
$main=$null
$clean=$false
$hostName=[Environment]::MachineName
$code = @()
try {
  if (-not (Test-Path -LiteralPath $Repo -PathType Container)) { throw 'REPO_MISSING' }
  $Repo = (Resolve-Path -LiteralPath $Repo).Path
  if (-not ([System.IO.Path]::IsPathRooted($Repo))) { throw 'REPO_NOT_ABSOLUTE' }
  $head=ReadGit -Params @('rev-parse','HEAD')
  $porcelain=ReadGit -Params @('status','--porcelain','--untracked-files=all')
  $clean=($porcelain.Length -eq 0)
  if (-not $clean) { $blockers.Add('WORKTREE_NOT_CLEAN') }
  try {
    $remote = ReadGit -Params @('ls-remote','origin','refs/heads/main')
    $main=($remote -split '\s+')[0]
    if ($main -notmatch '^[0-9a-f]{40}$') { throw 'INVALID_REMOTE_MAIN' }
    if ($head -ne $main) { $blockers.Add('SOURCE_NOT_PROTECTED_MAIN') }
  } catch { $blockers.Add('REMOTE_MAIN_READ_UNAVAILABLE') }
  $required=@(
    'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs',
    'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs',
    'scripts/runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V2.cjs',
    'scripts/runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs',
    'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs',
    'scripts/runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs',
    'scripts/runtime_acceptance/RUN_MCFT_CAP09_ATTEMPT3_HOST_V2_WINDOWS.cjs',
    'scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts',
    'scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts',
    'scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs',
    'scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts'
  )
  foreach ($rel in $required) {
    $full=Join-Path $Repo ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
    $digest=ShaFile $full
    if ($null -eq $digest) { $blockers.Add('REQUIRED_FILE_MISSING:' + $rel) }
    $code+=@{ path=$rel; sha256=$digest; present=($null -ne $digest) }
  }
  if ([string]::IsNullOrWhiteSpace($SignedInput)) {
    $blockers.Add('SIGNED_ADOPTION_PERMIT_WINDOWS_INPUT_NOT_PROVIDED')
  } else {
    if (-not [IO.Path]::IsPathRooted($SignedInput)) {
      $blockers.Add('SIGNED_INPUT_NOT_ABSOLUTE')
    } elseif (-not (Test-Path -LiteralPath $SignedInput -PathType Leaf)) {
      $blockers.Add('SIGNED_INPUT_NOT_FOUND')
    } else {
      $information.Add('SIGNED_INPUT_EXISTS_NOT_CRYPTOGRAPHICALLY_VERIFIED')
    }
  }
  $nodeVersion = (& node --version 2>&1)
  if ($LASTEXITCODE -ne 0) { $blockers.Add('NODE_UNAVAILABLE') }
  $pyVersion = (& python --version 2>&1)
  if ($LASTEXITCODE -ne 0) { $blockers.Add('PYTHON_UNAVAILABLE') }
} catch {
  $blockers.Add('LOCAL_READONLY_INSPECTION_FAILED:' + [string]$_.Exception.Message)
}
$result=[ordered]@{
  schema_version='MCFT_CAP09_ATTEMPT3_WINDOWS_HOST_READONLY_INSPECTION_V1'
  started_at_utc=$begin
  completed_at_utc=[DateTime]::UtcNow.ToString('o')
  host_os=[Environment]::OSVersion.VersionString
  host_name=$hostName
  repository_root=$Repo
  source_head_sha=$head
  remote_protected_main_sha=$main
  head_is_remote_main=($null -ne $head -and $head -eq $main)
  worktree_clean=$clean
  required_source_files=$code
  input_present=((-not [string]::IsNullOrWhiteSpace($SignedInput)) -and (Test-Path -LiteralPath $SignedInput -PathType Leaf))
  signed_material_verified=$false
  isolated_pg_verified=$false
  isolated_s3_verified=$false
  six_stage_children_dispatched=$false
  original_six_stages_executed=0
  permit_issued=$false
  permit_consumed=$false
  production_authorized=$false
  blockers=@($blockers.ToArray())
  notes=@($information.ToArray())
  status='READONLY_LOCAL_INSPECTION_NOT_SIGNED_PREFLIGHT'
}
$result | ConvertTo-Json -Depth 12 -Compress
