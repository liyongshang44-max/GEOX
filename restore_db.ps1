# GEOX/scripts/ops/restore_db.ps1
# Ops1: restore a PostgreSQL custom dump file via pg_restore inside docker container.

param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path, # Resolve repository root from script location by default.
  [string]$DumpFile, # Require input dump file path.
  [string]$ContainerName = "geox-postgres", # Default postgres container name.
  [string]$DatabaseName = "landos", # Default target database name.
  [string]$DbUser = "landos", # Default postgres user.
  [switch]$CreateDb  # Optionally create the target db before restoring.
)

Set-StrictMode -Version Latest # Enforce strict PowerShell semantics.
$ErrorActionPreference = "Stop" # Stop immediately on any error.

function Assert([bool]$cond, [string]$msg){ # Define simple assertion helper.
  if (-not $cond) { throw ("ASSERT_FAIL: " + $msg) } # Throw descriptive error on failed assertion.
} # End assertion helper.

Assert (-not [string]::IsNullOrWhiteSpace($DumpFile)) "DumpFile is required" # Require caller provide dund file path.
$repoRootResolved = (Resolve-Path $RepoRoot).Path # Normalize repo root to absolute path.
$dumpPathResolved = if ([System.IO.Path]::IsPathRooted($DumpFile)) { $DumpFile } else { Join-Path $repoRootResolved $DumpFile } # Normalize dump path to absolute path.
Assert (Test-Path $dumpPathResolved) ("dump file not found: " + $dumpPathResolved) # Require dump file to exist.
$containerId = (& docker ps -q -f "name=^${ContainerName}$").Trim() # Query running container id by exact name.
Assert (-not [string]::IsNullOrWhiteSpace($containerId)) ("postgres container not running: " + $ContainerName) # Require running postgres container.

$dumpInContainer = "/tmp/geox_ops_restore.job.dump" # Use stable temp path inside container for piped dump.
& docker cp $dumpPathResolved "${ContainerName}:$dumpInContainer" | Out-Null # Copy dump file into the container before restore.

if ($CreateDb) { # Optionally create target db when requested.
  & docker exec $ContainerName sh -lc ("dropdb -U {0} --if-exists {1} && createdb -U {0} {1}" -f $DbUser, $DatabaseName) | Out-Null # Recreate target db from scratch.
} # End optional create-db branch.

$stderrFile = Join-Path $env:TEMP ("geox_restore_stderr_" + [guid]::NewGuid().ToString("N") + ".txt") # Use temp file to capture restore stderr.
try { # Enforce cleanup for temp file and container payload.
  $args = @(
    "exec", $ContainerName, "sh", "-lc", ("pg_restore -U {0} -d {1} --clean --if-exists --no-owner $dumpInContainer" -f $DbUser, $DatabaseName)
  )  # Build docker exec command for pg_restore.
  &docker @args 2> $stderrFile | Out-Null # Run restore and capture stderr for diagnostics.
  $exitCode = $LASTEXITCODE # Capture command exit code.
  $stderr = if (Test-Path $stderrFile) { [System.IO.File]::ReadAllText($stderrFile) } else { "" } # Read captured diagnostics.
  if ($exitCode -ne 0) { throw ("RESTORE_DB_FAILED: exit=" + $exitCode + " stderr=" + $stderr) } # Fail on non-zero restore exit.
} finally { # Always clean temp artifacts.
  if (Test-Path $stderrFile) { Remove-Item -Force $stderrFile } # Remove temp stderr file.
  & docker exec $ContainerName sh -lc ("rm -f $dumpInContainer") | Out-Null # Remove temp dump file from container.
} # End restore cleanup.

Write-Host ("OK: db restored from " + $dumpPathResolved) # Print success marker with input path.
Write-Host ("OK: database=" + $DatabaseName) # Print target db for audit trail.
