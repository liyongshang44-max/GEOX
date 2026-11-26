# P6-A2 — candidate product persistence (not admitted)
Base: c6d666b4addaf71610bf3135c9380bb2b6ee5069.
This is an additive source candidate, not a new SSOT or production authorization.
The five business table definitions are carried from P2/P3/P3P/P4 isolated candidates.
Only namespace qualification and explicit grants differ. The extra table is a migration ledger.
Use existing PostgreSQL; do not create a new database server, modify CAP07, R4285 or public runtime grants.
The dedicated geox_manager_v1 schema is intentionally outside public, which is subject to legacy broad grants.
P6-C must qualify all five table references explicitly; no search_path fallback or dual storage.
The SQL is in a subdirectory so the flat legacy SQL scanner cannot execute it implicitly.
Platform admin separately provisions the product migrator LOGIN (secret owner action) and runs
the explicit provision SQL once, only against an authorized product DB. Provision rejects existing
objects instead of silently adopting. The migration owner is NOLOGIN; the dedicated product
migrator may SET ROLE; Runtime has only USAGE, SELECT and INSERT (ledger SELECT only).
The built one-shot entry is apps/server/dist/apps/server/src/product_manager_migration_v1.js.
No default Compose, server bootstrap, route registration or deployment change in this candidate.
Before admission: real PG16 positive/negative proof, existing commercial bootstrap reentry,
fresh and upgrade, restart and exact readback, workload role inventory and effective ACL.
ADR authority storage and manager API integration remain separate work. No historical test rows
or KBS data copied. No science, publication or execution authority established.
