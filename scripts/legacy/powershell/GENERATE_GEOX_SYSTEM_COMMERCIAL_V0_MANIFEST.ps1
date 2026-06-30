Set-StrictMode -Version Latest # Enforce strict mode so undefined variables / properties throw.
$ErrorActionPreference = 'Stop' # Ensure any non-terminating error stops execution.

# --- Paths ---
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path # Compute repository root as parent of scripts/.
$manifestPath = Join-Path $repoRoot 'manifests\geox_system_commercial_v0.manifest.json' # Canonical manifest file that should be committed for the tag.
$artifactDir = Join-Path $repoRoot 'artifacts\commercial_manifest\commercial_v0' # Artifact output directory for generated copies.
$acceptanceReportPath = Join-Path $repoRoot 'artifacts\system_acceptance\commercial_v0\system_acceptance_report.json' # System acceptance report path.

# --- Logging helpers ---
function Write-Info([string]$m) { Write-Host ("[INFO] " + $m) } # Standard info log.
function Write-Ok([string]$m) { Write-Host ("[OK]   " + $m) -ForegroundColor Green } # Standard ok log.
function Write-Warn([string]$m) { Write-Host ("[WARN] " + $m) -ForegroundColor Yellow } # Standard warning log.
function Fail([string]$m) { Write-Host ("[FAIL] " + $m) -ForegroundColor Red; throw $m } # Standard failure that throws.

# --- Hash helpers ---
function Sha256-File([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { Fail "SHA256_FILE_NOT_FOUND: $path" } # Guard: required file exists.
  $h = Get-FileHash -Algorithm SHA256 -LiteralPath $path # Compute SHA-256 hash of the file.
  return ($h.Hash.ToLowerInvariant()) # Return lower-case hex string.
}

function Dir-HashV1([string]$dir, [string[]]$includeGlobs) {
  if (-not (Test-Path -LiteralPath $dir)) { Fail "DIR_HASH_DIR_NOT_FOUND: $dir" } # Guard: directory exists.

  $files = @() # Collector for file paths.
  foreach ($g in $includeGlobs) { # Expand each include glob.
    $files += Get-ChildItem -LiteralPath $dir -Recurse -File -Filter $g | Select-Object -ExpandProperty FullName # Collect matching files.
  }

  $files = $files | Sort-Object -Unique # Deterministic ordering and uniqueness.
  if ($files.Count -eq 0) { Fail "DIR_HASH_EMPTY: $dir (globs=$($includeGlobs -join ','))" } # Guard: must hash something.

  $lines = New-Object System.Collections.Generic.List[string] # Stable textual material to hash.
  foreach ($f in $files) { # For each file path.
    $rel = $f.Substring($dir.Length).TrimStart('\','/') # Compute relative path inside the directory.
    $fh = (Get-FileHash -Algorithm SHA256 -LiteralPath $f).Hash.ToLowerInvariant() # Hash file contents.
    $lines.Add(($rel.Replace('\\','/') + ' ' + $fh)) | Out-Null # Append "rel hash" line.
  }

  $payload = ($lines.ToArray() -join "`n") # Join lines with LF to create deterministic payload.
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload) # Convert to UTF-8 bytes.
  $sha = [System.Security.Cryptography.SHA256]::Create() # Create SHA256 object.
  try { # Ensure we dispose crypto provider.
    $digest = $sha.ComputeHash($bytes) # Compute digest bytes.
  } finally {
    $sha.Dispose() # Dispose SHA256 object.
  }

  $hex = -join ($digest | ForEach-Object { $_.ToString('x2') }) # Convert digest bytes to hex.
  return @{ dir = $dir; include = $includeGlobs; file_count = $files.Count; sha256 = $hex } # Return structured result.
}

# --- Git commit ---
$gitCommit = $null # Placeholder for git commit.
try {
  $gitCommit = (& git rev-parse HEAD 2>$null).Trim() # Read current git commit if git exists.
} catch {
  $gitCommit = 'UNKNOWN' # Fallback if git is not available.
}

# --- Inputs to hash ---
$composeFiles = @(
  'docker-compose.yml',
  'docker-compose.delivery.yml',
  'docker-compose.commercial_v0.yml'
) # Compose files participating in commercial_v0 deploy.

$acceptanceFiles = @(
  'scripts\\DEPLOY_GEOX_SYSTEM_COMMERCIAL_V0.ps1',
  'scripts\\ACCEPTANCE_GEOX_SYSTEM_COMMERCIAL_V0.ps1'
) # Acceptance / deploy scripts participating in commercial_v0.

$freezeDoc = 'docs\\GEOX-Commercial-System-Freeze-v0.md' # Commercial freeze doc v0 (Task 3 output).

# --- Compute hashes ---
$composeHashes = @() # List of compose hashes.
foreach ($f in $composeFiles) { # Iterate compose files.
  $p = Join-Path $repoRoot $f # Absolute path to compose file.
  $composeHashes += @{ path = $f; sha256 = (Sha256-File $p) } # Record hash.
}

$scriptHashes = @() # List of script hashes.
foreach ($f in $acceptanceFiles) { # Iterate script files.
  $p = Join-Path $repoRoot $f # Absolute path to script.
  $scriptHashes += @{ path = $f; sha256 = (Sha256-File $p) } # Record hash.
}

$docHash = @{ path = $freezeDoc; sha256 = (Sha256-File (Join-Path $repoRoot $freezeDoc)) } # Freeze doc hash.

# Contracts / schemas (directory hashes, deterministic).
$contractsDir = Join-Path $repoRoot 'packages\\contracts\\src' # Contracts source directory.
$contractsSchemaDir = Join-Path $repoRoot 'packages\\contracts\\src\\schema' # Contracts schema directory.
$contractsHash = Dir-HashV1 -dir $contractsDir -includeGlobs @('*.ts','*.json') # Hash TS+JSON under contracts/src.
$contractsSchemaHash = Dir-HashV1 -dir $contractsSchemaDir -includeGlobs @('*.ts','*.json') # Hash TS+JSON under contracts/src/schema.

# System acceptance report hash (optional: exists only after running acceptance).
$acceptanceReportHash = $null # Default to null if report not present.
if (Test-Path -LiteralPath $acceptanceReportPath) { # Only hash if report exists.
  $acceptanceReportHash = @{ path = 'artifacts/system_acceptance/commercial_v0/system_acceptance_report.json'; sha256 = (Sha256-File $acceptanceReportPath) } # Record report hash.
} else {
  $acceptanceReportHash = @{ path = 'artifacts/system_acceptance/commercial_v0/system_acceptance_report.json'; sha256 = $null; note = 'REPORT_NOT_FOUND_RUN_ACCEPTANCE_FIRST' } # Explicitly mark as missing.
}

# --- Assemble manifest ---
$manifest = [ordered]@{} # Ordered hashtable for stable JSON field ordering.
$manifest.manifest_id = 'geox_system_commercial_v0' # Single manifest identifier.
$manifest.version = 'v0' # Commercial freeze version.
$manifest.git_commit = $gitCommit # Git commit used to produce this manifest.
$manifest.generated_at_ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() # Generation timestamp (ms, UTC).
$manifest.profile = 'commercial_v0' # Deployment profile name.

$manifest.hashes = [ordered]@{} # Container for hashes.
$manifest.hashes.compose = $composeHashes # Hashes for docker compose inputs.
$manifest.hashes.scripts = $scriptHashes # Hashes for deploy/acceptance scripts.
$manifest.hashes.docs = @($docHash) # Hashes for docs (freeze doc).
$manifest.hashes.contracts = @(
  @{ kind = 'dir_hash_v1'; value = $contractsHash },
  @{ kind = 'dir_hash_v1'; value = $contractsSchemaHash }
) # Directory-hash bundles for contracts and schemas.
$manifest.hashes.acceptance_report = $acceptanceReportHash # Hash for generated acceptance report.

$manifest.invariants = @(
  'Execution default-disabled (no auto-run)',
  'No Apple IV output enters AO-ACT',
  'No bypass of Apple II to drive execution',
  'No standalone deployment of Apple III for external use',
  'Constitution constraints must remain enabled'
) # Human-readable invariants for commercial state.

$manifest.acceptance = [ordered]@{} # Acceptance summary block.
$manifest.acceptance.command = 'pnpm acceptance:system:commercial:v0' # Command used to generate acceptance report.
$manifest.acceptance.report_path = 'artifacts/system_acceptance/commercial_v0/system_acceptance_report.json' # Expected report path.

# --- Write outputs ---
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $manifestPath) | Out-Null # Ensure manifests/ directory exists.
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null # Ensure artifact directory exists.

$json = ($manifest | ConvertTo-Json -Depth 40) # Serialize manifest to JSON.

# Write manifest into repo (committable).
[System.IO.File]::WriteAllText($manifestPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false))) # Write without BOM (important for stable hashing).

# Write a copy into artifacts with timestamp for audit.
$artifactPath = Join-Path $artifactDir ("geox_system_commercial_v0.manifest." + $manifest.generated_at_ts + '.json') # Timestamped artifact path.
[System.IO.File]::WriteAllText($artifactPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false))) # Write without BOM.

Write-Ok "Manifest written: $manifestPath" # Confirm repo manifest.
Write-Ok "Manifest artifact written: $artifactPath" # Confirm artifact copy.

# Print key hashes for convenience.
Write-Info "git_commit=$gitCommit" # Print commit.
foreach ($c in $composeHashes) { Write-Info ("compose." + $c.path + '.sha256=' + $c.sha256) } # Print compose hashes.
foreach ($s in $scriptHashes) { Write-Info ("script." + $s.path + '.sha256=' + $s.sha256) } # Print script hashes.
Write-Info ("doc." + $docHash.path + '.sha256=' + $docHash.sha256) # Print doc hash.
Write-Info ("contracts.src.dir_hash_v1.sha256=" + $contractsHash.sha256) # Print contracts src dir hash.
Write-Info ("contracts.schema.dir_hash_v1.sha256=" + $contractsSchemaHash.sha256) # Print contracts schema dir hash.
if ($acceptanceReportHash.sha256) { Write-Info ("acceptance_report.sha256=" + $acceptanceReportHash.sha256) } else { Write-Warn $acceptanceReportHash.note } # Print report hash or warning.
