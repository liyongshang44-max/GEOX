# Field observation history Product extension

Scope: Product-only candidate based on `1f1e2704543924560139e7ec05c67a6d06f5dc45`. No protected-main merge, Runtime, Permit, database schema, grant or production deployment mutation.

## Implemented HTTP contract

`GET /api/product/v1/fields/:fieldRef/observations?limit=50&cursor=…`

Response uses `geox.product-api.response.v1`; `.projection.schema_version` is `geox.field-observation-history-projection.v1`. Existing three Wave-02 routes stay unchanged. The extension is explicitly registered by the public Product runtime.

Projection envelope reuses the existing non-authoritative `EVIDENCE_CASE` type with `HISTORICAL_REPLAY` semantics. It contains `status`, `field_ref`, `items`, `count`, `next_cursor`, `limitation_reason_codes`, and `current_condition_effect:NO_PROMOTION`. Historical point measurements never replace or evaluate current Runtime state; the existing current workspace keeps its own exact Runtime availability result.

Items preserve exact fact/source identity and hashes, original six-key scope, dataset/source policy/version, original observation and other role timestamps, time precision/zone status, point value/unit/depth/spatial support, quality status and hash, limitations and customer-display permission reference. Private raw retention locators and bodies are never returned. No scientific calculation or irrigation risk inference is introduced. Future ET0/weather assumptions are excluded rather than relabelled observations.

Pagination sorts `occurred_at ASC,fact_id ASC`, uses a strict keyset pair, fixes the initial as-of cutoff for both the event time and original source `role_time.ingested_at`, and signs cursors with an injected HMAC secret. Cursor scope includes customer scope and display-grant identity; tampering or cross-scope reuse fails closed. The source ingestion cutoff excludes normal late arrivals ingested after the first page. This remains bounded keyset paging, not a cross-request PostgreSQL snapshot guarantee for backfills whose source ingestion timestamp was backdated; a restarted traversal is needed to discover those newly inserted earlier records. No missing database insertion timestamp is invented.

## Data-use admission is independent from source existence

The KBS soil provider `apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts` explicitly sets `quality.raw_value_publication_authorized:false`; retained raw evidence is private. Public research origin does not itself grant the public Site permission to display raw/canonical numeric content. The new projection therefore defaults to `UNAVAILABLE / OBSERVATION_CUSTOMER_DISPLAY_PERMISSION_NOT_ESTABLISHED` and does not query `facts` without a separately approved exact display grant.

Optional runtime configuration: `GEOX_PRODUCT_OBSERVATION_DISPLAY_GRANTS_JSON` plus a server-only `GEOX_PRODUCT_OBSERVATION_CURSOR_SECRET` of at least 32 characters. A grant binds tenant/project/group/field, dataset, source use-policy reference, approval reference, expiry, `customer_visible:true` and `permission:CANONICAL_OBSERVATION_DISPLAY`. The implementation does not issue grants or prove the legal validity of an injected approval reference. Production configuration requires the existing source/resource owner’s accepted permission. No such production grant was created by this work.

The builder requires existing authorized field identity, exact scoped source/type and canonical binding, observed epistemic class, explicit observation instant matching the fact event time, acceptable source quality, canonical content hash, exact source-use-policy match and point-only numerical semantics. A lawful empty query is `AVAILABLE` with empty items; absent permission is explicitly `UNAVAILABLE`. Malformed/corrupted source facts cause a read error, not a substituted empty result.

## Reuse assessment (WP-B)

PR #3671 exact candidate `d55c12451c5a162624a771625a6f84ecaf1b2938` is reused for its ownership/data mapping: point soil observations are E01, source identity E12, time roles E13, limits E16, spatial representativeness E20. It is documentation-only, not production display permission.

PR #3650 exact candidate `ec005def78d1591e3035b56ae0f70ba399c21560`, based on `80ab7aaf…`, only adds field polygon source binding/availability. It contains no Operation/Receipt/AsExecuted/Acceptance consumption. Its nullable/geometry source strategy is conceptually reusable; its old builder changes are not merged or copied into current main.

PR #3658 exact candidate `63abeaa591708d0ddc6c54b7c2c6b60f6ae5c0b7`, based on `0e4cd036…`, separates the Formal-v5 exact-current resolver from the identity database. It is relevant to the later lawful MCFT current-state connection, not a source for historical soil observation or execution facts. Its production role/grant candidates are not applied. No old candidate is directly merged.

`apps/server/src/projections/operation_state_v1.ts` has a pure `projectOperationStateFromFacts` path, and independently tracks task/receipt/acceptance references. Its database loader at lines 234ff accepts missing project/group values through OR-blank clauses; it must not be reused unchanged as a strict customer Product source. A Product wrapper would first require complete exact customer scope and object/field bindings. Derived technical acceptance hints do not establish a formal Acceptance object or agricultural outcome.

`apps/server/src/routes/as_executed_v1.ts` GET detail/by-task/by-receipt methods use explicit tenant triple and read-domain access. Its `normalizeWholeFieldAsAppliedCoverage` write helper is called from a POST path, not the selected GETs. A future consumer should call the existing read domain/repository with exact references, not register legacy writers or infer AsExecuted from manual records/Receipt. `apps/server/src/domain/execution/as_executed_v1.ts` reads formal records from `as_executed_record_v1`; evidence and acceptance facts have distinct object types.

The CTO-provided Product database inventory currently has no execution-type facts. This work has not established a qualified live execution source or customer-visible formal Acceptance source. Therefore existing Operations/Reports/History unavailability remains; no empty execution DTO is advertised as data availability. Actual production role/table access and exact customer-row evidence remain a source-owner read qualification item, not an authorization to provision a role or modify production data.

## Verification

Node 24.22.1 local tests: 24/24 PASS across the historical projection, original customer builder, original three-route HTTP surface and public-host tests. Strict targeted TypeScript check PASS using the repository's existing `pg_readonly_query_values_v1.d.ts` augmentation. Wave-02 static acceptance: 13/13 PASS. Real restricted-record numeric values were not copied to source or public fixtures. The production sample's canonical field/time/quality shape was checked through a private, redacted read-only handoff; this is not production display permission.

Tests use explicitly synthetic records and independent display-grant fixtures. Real loopback HTTP validates authentication, field denial and GET-only behavior. No PostgreSQL writes or live upstream mutations are performed. Original Product builder/routes and public-host tests continue passing. The pre-existing Wave-02 static guard expects exactly three GET registrations in its original route module; the historical extension is registered separately so that historical guard is preserved instead of weakening its assertion.

No claim of production endpoint availability, legal raw-data redistribution permission, current MCFT state, real customer identities, execution authority or customer pilot completion.
