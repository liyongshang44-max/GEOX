# AM22 GFS progress diagnostic V1

Engineering-only read-only observer. No Runtime, Provider retry-budget, authority, container or lease mutation. It does not recover acquisition, qualify an A0, generate six-phase input, or authorize Formal execution.

## Evidence and limits

Read-only production transaction checks the database name and exact six-key scope. Claims are counted as durable attempt claims, not successful HTTP requests. Pair metadata is observed, never certified as a scientific/provenance qualification. A live lease at one database sample is not H5. Missing logs and unavailable SQL are not interpreted as no failures or zero rows.

The existing health logger omits the wrapped transport cause. This observer cannot retrospectively determine HTTP status versus timeout/reset or prove provider publication. It reports UNKNOWN. It keeps member-fetch failures separately from the repeated missed-window messages so a restart loop does not overwrite the earlier failure in its summary. Only permitted health tokens are emitted; URLs, messages, credentials and cause objects are excluded.

## Operator command after this candidate is accepted

Use a clean checkout of the accepted exact main, dependencies already installed, and the restored operator PowerShell environment. No image build or cutover is required. The runner uses the host database credentials solely for SELECT statements within BEGIN READ ONLY and reads the mounted durable Evidence log. The original target below is a diagnostic target, never a new execution window.

```powershell
node scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs --live --operator-authorized --target=2026-10-09T07:00:00.000Z
if ($LASTEXITCODE -ne 0) { throw 'Diagnostic blocked; unavailable evidence is not an empty result' }
```

Offline mode: `--input=/absolute/path/snapshot.json`. Input schema is exercised by the acceptance script. Output is diagnostic-only and all Formal/production authorization fields remain false.

## Governance

Predecessor is protected-main 0d19c4b9f7eb9067824f68014babd757c74f1943 (#3680). All 44 existing QCP checks and resolvers remain unchanged; one exact-path diagnostic check is appended. The prior recovery verifier receives only a diagnostic delegation line. Its entire previous body is compared byte-for-byte, and its actual qualification is replayed against a separate checkout of the adopted predecessor. R6/G12/G13 files and frozen Runtime are unchanged. No old failure receipt becomes a success receipt.
