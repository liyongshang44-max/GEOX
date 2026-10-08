param(
    [string]$RepoRoot = "$env:LOCALAPPDATA\Temp\geox-mcft-cap09-a60aa685-fresh",
    [string]$ConfigFile = "$HOME\.geox\mcft-cap09\local-config\formal-v5-a60aa685-20261008T114136274Z.clixml"
)
& {
    $ErrorActionPreference = "Stop"
    $Cap09Required = @(
        "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
        "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
        "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
        "GEOX_MCFT_CAP09_DURABLE_LOG_ROOT"
    )
    $Cap09Missing = @($Cap09Required | Where-Object { -not [Environment]::GetEnvironmentVariable($_, "Process") })
    if ($Cap09Missing.Count -gt 0) {
        if (-not (Test-Path -LiteralPath $ConfigFile)) { throw "ARM_RETIREMENT_LOCAL_CONFIG_REQUIRED" }
        $Cap09Saved = Import-Clixml -LiteralPath $ConfigFile
        if ($Cap09Saved -is [System.Collections.IDictionary]) {
            $Cap09Entries = @($Cap09Saved.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Name = $_.Key; Value = $_.Value } })
        } else {
            $Cap09Entries = @($Cap09Saved.PSObject.Properties | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Value = $_.Value } })
        }
        foreach ($Cap09Entry in $Cap09Entries) {
            if ($Cap09Entry.Name -notin $Cap09Required) { continue }
            if ($Cap09Entry.Value -isnot [System.Security.SecureString]) { throw "ARM_RETIREMENT_SECURE_CONFIG_FORMAT_REQUIRED" }
            $Cap09Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Cap09Entry.Value)
            try {
                [Environment]::SetEnvironmentVariable($Cap09Entry.Name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Cap09Pointer), "Process")
            } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Cap09Pointer) }
        }
        Remove-Variable Cap09Saved, Cap09Entries, Cap09Entry -ErrorAction SilentlyContinue
    }
    $Cap09Missing = @($Cap09Required | Where-Object { -not [Environment]::GetEnvironmentVariable($_, "Process") })
    if ($Cap09Missing.Count -gt 0) { throw "ARM_RETIREMENT_MISSING_CONFIG: $($Cap09Missing -join ', ')" }
    if (-not (Test-Path -LiteralPath "D:\pdsl\bin\psql.exe")) { throw "ARM_RETIREMENT_PSQL_PATH_REQUIRED" }
    $env:PATH = "D:\pdsl\bin;$env:PATH"
    $env:GEOX_DEPLOYMENT_SUBJECT_COMMIT = "a60aa6858662ce87b989ff752c50969f21ad4619"
    $env:GEOX_MCFT_CAP09_LOCAL_HOST_ID_PATH = "$HOME\.geox\mcft-cap09\local-host-id-v1"
    $env:GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH = Join-Path $RepoRoot "acceptance-output\MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json"
    $Cap09Tool = Join-Path $PSScriptRoot "RETIRE_MCFT_CAP_09_FORMAL_ARM_HOST_V1.cjs"
    $Cap09Verify = Join-Path $PSScriptRoot "VERIFY_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"
    Write-Host "Read-only host evidence collection; waiting for owner renewal."
    & node $Cap09Tool "--repo-root=$RepoRoot" "--arm=$HOME\.geox\mcft-cap09\formal-v5\arm-rearm-a60aa685-v1.json" --operator-authorized
    if ($LASTEXITCODE -ne 0) { throw "ARM_RETIREMENT_STOPPED; preserve files and report only the error code." }
    & node $Cap09Verify
    if ($LASTEXITCODE -ne 0) { throw "ARM_RETIREMENT_RECEIPT_VERIFICATION_FAILED" }
    Write-Host "PASS: old ARM retired; audit bytes preserved; Evidence/Twin were not stopped. New A0 remains unauthorized."
}
