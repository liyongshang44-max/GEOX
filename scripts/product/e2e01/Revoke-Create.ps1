$ErrorActionPreference='Stop'
$file=Join-Path $HOME 'GEOX-E2E01-LOCAL\owner-land-grants.json'
$p=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
if($p.schema -cne 'geox.local-owner-land-grants.e2e01.v1' -or $p.phase -cne 'PREWRITE' -or $p.create_status -cne 'ACTIVE' -or $p.revision -ne 1 -or @($p.field_grants).Count -ne 0){throw 'HOLD_OWNER_POLICY_STATE'}
$p.create_status='REVOKED'
$p.revision=2
$tmp=$file+'.new'
if(Test-Path -LiteralPath $tmp){throw 'HOLD_POLICY_TEMP_EXISTS'}
[IO.File]::WriteAllText($tmp,($p|ConvertTo-Json -Depth 4 -Compress),(New-Object Text.UTF8Encoding($false)))
[IO.File]::Replace($tmp,$file,($file+'.revision1.bak'))
Write-Host 'OWNER_CREATE_GRANT_REVOKED=PASS'
Write-Host 'WRITE_ADMISSION_REMAINS_FALSE'
