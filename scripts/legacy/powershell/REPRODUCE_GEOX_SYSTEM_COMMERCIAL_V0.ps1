# GEOX · Sprint 24 — Commercial Freeze v0
# Reproduce Script (Operator) — run deploy + acceptance + manifest regeneration and compare STABLE hashes.

Set-StrictMode -Version Latest # Enforce strict mode for safer PowerShell execution.
$ErrorActionPreference = "Stop" # Stop on any error.

function Fail([string]$m) { Write-Host "[FAIL] $m" -ForegroundColor Red; throw $m } # Fail helper.
function Ok([string]$m)   { Write-Host "[OK]   $m" -ForegroundColor Green } # OK helper.
function Info([string]$m) { Write-Host "[INFO] $m" -ForegroundColor Cyan } # Info helper.

# Resolve repo root from this script location.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path # Repo root path.

# Paths to key scripts and manifest.
$deployCmd = "pnpm deploy:commercial:v0" # Deploy command (commercial profile).
$acceptCmd = "pnpm acceptance:system:commercial:v0" # System acceptance command (commercial profile).
$manifestPath = Join-Path $repoRoot "manifests\geox_system_commercial_v0.manifest.json" # Freeze manifest path.
$manifestGen = Join-Path $repoRoot "scripts\GENERATE_GEOX_SYSTEM_COMMERCIAL_V0_MANIFEST.ps1" # Generator script.

# Compute SHA-256 hex of a string (UTF-8 without BOM).
function Sha256HexOfString([string]$s) { # Hash helper for canonical JSON strings.
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s) # Encode as UTF-8 bytes.
  $sha = [System.Security.Cryptography.SHA256]::Create() # Create SHA256 instance.
  $hash = $sha.ComputeHash($bytes) # Compute hash.
  -join ($hash | ForEach-Object { $_.ToString("x2") }) # Return lowercase hex.
}

# Flatten an object tree into a map: "path.like.this" => value.
function Flatten-Json([object]$node, [string]$prefix, [hashtable]$out) { # Recursive flattener.
  if ($null -eq $node) { return } # Skip null nodes.
  if ($node -is [System.Collections.IDictionary]) { # Handle objects/hashtables.
    foreach ($k in $node.Keys) { # Iterate keys.
      $p = if ($prefix) { "$prefix.$k" } else { "$k" } # Build dot path.
      Flatten-Json -node $node[$k] -prefix $p -out $out # Recurse.
    }
    return # Done for dictionary.
  }
  if ($node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) { # Handle arrays.
    $i = 0 # Index counter.
    foreach ($x in $node) { # Iterate elements.
      $p = if ($prefix) { "$prefix[$i]" } else { "[$i]" } # Build index path.
      Flatten-Json -node $x -prefix $p -out $out # Recurse.
      $i++ # Increment index.
    }
    return # Done for array.
  }
  $out[$prefix] = $node # Leaf value.
}

# Extract "stable" leaf key/value pairs from the manifest.
# Stable = code/config/doc hashes + commit + contract dir hashes.
# Volatile (ignored) = acceptance report hash (changes every run), timestamps, artifact filenames, etc.
function Get-StableLeafMap([object]$manifestObj) { # Stable extractor.
  $flat = @{} # Flat map of all leaves.
  Flatten-Json -node $manifestObj -prefix "" -out $flat # Flatten manifest.
  $stable = @{} # Stable-only leaf map.
  foreach ($k in $flat.Keys) { # Iterate flattened keys.
    $v = $flat[$k] # Read value.
    $key = $k.TrimStart(".") # Normalize leading dot if any.
    if ($key -eq "git_commit") { $stable[$key] = $v; continue } # Keep commit.
    if ($key -match '^(compose|script|doc|contracts)\.' ) { # Keep core hash domains.
      if ($key -match 'acceptance_report') { continue } # Ignore acceptance report.
      if ($key -match 'started_at|finished_at|generated_at|timestamp|artifact') { continue } # Ignore timestamps/artifacts.
      $stable[$key] = $v # Keep stable leaf.
      continue # Next key.
    }
  }
  return $stable # Return stable map.
}

# Canonicalize stable map to a deterministic JSON string with sorted keys.
function Canonical-StableJson([hashtable]$stableMap) { # Canonical JSON builder.
  $ordered = [ordered]@{} # Ordered map for stable serialization.
  foreach ($k in ($stableMap.Keys | Sort-Object)) { # Sort keys.
    $ordered[$k] = $stableMap[$k] # Copy in sorted order.
  }
  ($ordered | ConvertTo-Json -Compress) # Emit canonical JSON (no whitespace).
}

# Read manifest "before" snapshot.
if (-not (Test-Path $manifestPath)) { Fail "Freeze manifest not found: $manifestPath" } # Ensure manifest exists.
$beforeText = Get-Content $manifestPath -Raw # Read manifest file.
$beforeObj = $beforeText | ConvertFrom-Json # Parse JSON.
$beforeStable = Get-StableLeafMap -manifestObj $beforeObj # Extract stable leaves.
$beforeCanon = Canonical-StableJson -stableMap $beforeStable # Canonical stable JSON.
$beforeStableHash = Sha256HexOfString $beforeCanon # Stable hash of manifest content.

Info "repoRoot=$repoRoot" # Print repo root.
Info "freeze_manifest=$manifestPath" # Print manifest path.
Info "freeze_manifest.stable_hash=$beforeStableHash" # Print stable hash (the reproducibility anchor).

# Backup manifest file to avoid dirty working tree after regeneration.
$backupPath = "$manifestPath.bak" # Backup file path.
Copy-Item -Force $manifestPath $backupPath # Backup current freeze manifest.

try {
  Info "Step 01: deploy commercial_v0" # Start deploy step.
  & pnpm deploy:commercial:v0 | Out-Host # Run deploy (stream output).
  Ok "Deploy completed" # Mark deploy OK.

  Info "Step 02: system acceptance commercial_v0" # Start acceptance step.
  & pnpm acceptance:system:commercial:v0 | Out-Host # Run acceptance (stream output).
  Ok "Acceptance completed" # Mark acceptance OK.

  Info "Step 03: regenerate manifest (environment-specific) and compare STABLE hashes" # Start manifest step.
  & powershell -NoProfile -ExecutionPolicy Bypass -File $manifestGen | Out-Host # Regenerate manifest.
  if (-not (Test-Path $manifestPath)) { Fail "Manifest regeneration did not produce: $manifestPath" } # Validate output.

  $afterText = Get-Content $manifestPath -Raw # Read regenerated manifest.
  $afterObj = $afterText | ConvertFrom-Json # Parse regenerated JSON.
  $afterStable = Get-StableLeafMap -manifestObj $afterObj # Extract stable leaves.
  $afterCanon = Canonical-StableJson -stableMap $afterStable # Canonical stable JSON.
  $afterStableHash = Sha256HexOfString $afterCanon # Stable hash of regenerated manifest.

  Info "regen_manifest.stable_hash=$afterStableHash" # Print stable hash after regeneration.

  if ($beforeStableHash -ne $afterStableHash) { # Compare stable hashes.
    # Provide a minimal diff hint by printing first few differing keys.
    $diffKeys = @() # Initialize diff keys.
    foreach ($k in ($beforeStable.Keys + $afterStable.Keys | Sort-Object -Unique)) { # Union keys.
      $bv = $beforeStable[$k] # Before value.
      $av = $afterStable[$k] # After value.
      if ($bv -ne $av) { $diffKeys += $k } # Record differences.
    }
    $hint = ($diffKeys | Select-Object -First 12) -join ", " # Diff hint keys (first 12).
    Fail "STABLE manifest mismatch. This indicates non-reproducible code/doc/config hashes under current environment. DiffKeys(first12)=[$hint]" # Fail with hint.
  }

  # NOTE: We intentionally do NOT compare the full manifest file hash.
  # Reason: the manifest may contain volatile fields (timestamps, acceptance report hash, artifact filenames)
  # and the file bytes can be affected by line-ending policy. Those are not part of the freeze semantics.
  Ok "Reproduce PASS (stable manifest hashes match; acceptance PASS)" # Final OK.

} finally {
  # Restore the original freeze manifest to keep the worktree clean.
  if (Test-Path $backupPath) { # If backup exists.
    Copy-Item -Force $backupPath $manifestPath # Restore.
    Remove-Item -Force $backupPath # Remove backup.
  }
}
