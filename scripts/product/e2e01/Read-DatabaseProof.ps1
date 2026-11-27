param([Parameter(Mandatory=$true)][ValidateSet('Before','After')][string]$Stage)
$ErrorActionPreference='Stop'
$root=Join-Path $HOME 'GEOX-E2E01-LOCAL'
$cfg=Get-Content -LiteralPath (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
$Pg='geox-product-e2e01-postgres'
if((docker inspect --format '{{.Id}}' $Pg) -cne $cfg.pgContainerId -or
   (docker inspect --format '{{.State.Status}}' $Pg) -cne 'running' -or
   (docker inspect --format '{{.State.Status}}' geox-v1-postgres) -cne 'exited' -or
   (docker port $Pg 5432/tcp) -cne '127.0.0.1:15435'){throw 'HOLD_DATABASE_IDENTITY'}
$old=@(docker inspect geox-v1-postgres | ConvertFrom-Json)[0]
$admin=@($old.Config.Env | Where-Object {$_ -like 'POSTGRES_USER=*'})
if($admin.Count -ne 1){throw 'HOLD_ADMIN_IDENTITY'}
$admin=$admin[0].Substring(14)
Remove-Variable old
$tables=@('public.facts','public.field_index_v1','public.field_polygon_v1','geox_manager_v1.field_soil_document_revision_p2_v1','geox_manager_v1.field_soil_document_confirmation_p2_v1','geox_manager_v1.field_crop_review_p3_v1','geox_manager_v1.field_native_assessment_p3p_v1','geox_manager_v1.field_context_followup_p4_v1','geox_manager_v1.migration_ledger_v1')
$parts=@()
foreach($t in $tables){
 $parts+= "SELECT '$t' AS relation,count(*) AS row_count,encode(sha256(convert_to(COALESCE(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') AS digest FROM (SELECT encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') AS h FROM $t x) s"
}
$sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='30s'; SELECT json_agg(q ORDER BY relation) FROM ("+($parts -join ' UNION ALL ')+") q; ROLLBACK;"
$raw=@(docker exec $Pg psql -X -w -qAt -U $admin -d landos -v ON_ERROR_STOP=1 -c $sql)
if($LASTEXITCODE -ne 0){throw 'HOLD_DATABASE_SNAPSHOT'}
$rows=@(($raw -join '') | ConvertFrom-Json)
if($rows.Count -ne $tables.Count -or @($rows|Where-Object{$_.digest -notmatch '^[a-f0-9]{64}$'}).Count){throw 'HOLD_SNAPSHOT_FORMAT'}
$file=Join-Path $root 'prewrite-db-before.json'
$json=ConvertTo-Json -InputObject $rows -Depth 4 -Compress
if($Stage -eq 'Before'){
 if(Test-Path -LiteralPath $file){throw 'HOLD_BASELINE_ALREADY_EXISTS'}
 [IO.File]::WriteAllText($file,$json,(New-Object Text.UTF8Encoding($false)))
 Write-Host 'PREWRITE_DB_BASELINE=CAPTURED'
}else{
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'HOLD_BASELINE_MISSING'}
 if([IO.File]::ReadAllText($file) -cne $json){throw 'HOLD_DATABASE_SNAPSHOT_CHANGED'}
 Write-Host 'NEGATIVE_PROOF_DATABASE_ROWS_AND_DIGESTS=UNCHANGED'
}
$rows | Select-Object relation,row_count,digest | ConvertTo-Json -Depth 3
