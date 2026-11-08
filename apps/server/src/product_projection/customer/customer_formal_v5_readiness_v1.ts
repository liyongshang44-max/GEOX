// GEOX Product ↔ Formal-v5 MCFT read-boundary V1 (inactive unless explicitly opted in).
// No new writer, no cross-tenant scope mapping, no source modification, no legacy API.
import type { Pool } from "pg";

export const PRODUCT_FORMAL_V5_READ_MODE_V1 = "FORMAL_V5_RESEARCH_EXACT_SCOPE_V1" as const;
export const PRODUCT_FORMAL_V5_SCOPE_V1 = Object.freeze({
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t4r1",
});

export const PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1 = Object.freeze([
  "facts",
  "twin_fact_visibility_index_v1",
  "twin_fact_visibility_epoch_v1",
  "twin_active_lineage_index_v1",
  "twin_object_idempotency_index_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
] as const);

const PRODUCT_DB = "geox_mcft_cap09_production_runtime_v1";
const FORMAL_DB = "geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const ROLE = "geox_product_readonly_login_v1";

function fail(code: string): never { throw new Error("PRODUCT_FORMAL_V5_" + code); }

function dbUri(input: string, expected: string): URL {
  let u: URL;
  try { u = new URL(input); } catch { return fail("DB_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(u.protocol)) fail("DB_PROTOCOL_INVALID");
  if (decodeURIComponent(u.username) !== ROLE) fail("READONLY_ROLE_REQUIRED");
  if (!u.password) fail("DB_PASSWORD_MISSING");
  if (!["require", "verify-full"].includes(u.searchParams.get("sslmode") ?? "")) fail("SSL_REQUIRED");
  if (decodeURIComponent(u.pathname.replace(/^\//, "")) !== expected) fail("DB_IDENTITY_FORBIDDEN");
  if (!u.hostname) fail("HOST_REQUIRED");
  return u;
}

export function assertProductFormalV5CrossDatabaseUrisV1(
  identityUrl: string,
  canonicalUrl: string,
): void {
  const identity = dbUri(identityUrl, PRODUCT_DB);
  const formal = dbUri(canonicalUrl, FORMAL_DB);
  // The two connection strings may use separate passwords, but not different
  // projects/hosts or user principals. pg_database cannot cross physical DBs.
  if (identity.hostname !== formal.hostname || identity.port !== formal.port) {
    fail("CROSS_HOST_OR_PORT_FORBIDDEN");
  }
}

export function isAllowedFormalV5ResearchFieldV1(scope: {
  tenant_id: string; project_id: string; group_id: string;
}, fieldId: string): boolean {
  return scope.tenant_id === PRODUCT_FORMAL_V5_SCOPE_V1.tenant_id
    && scope.project_id === PRODUCT_FORMAL_V5_SCOPE_V1.project_id
    && scope.group_id === PRODUCT_FORMAL_V5_SCOPE_V1.group_id
    && fieldId === PRODUCT_FORMAL_V5_SCOPE_V1.field_id;
}

type IdentityRow = { db: string; project_id: string | null; branch_id: string | null; db_readonly: string; role: string };
type RelationRow = { relation: string; exists: boolean; can_select: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean };
export type ProductFormalV5ReadinessV1 = {
  status: "PASS_PRECONDITIONS_ONLY" | "BLOCKED";
  reason_codes: string[];
  cross_database_same_neon_project_and_branch: boolean;
  role_read_only: boolean;
  complete_cap07_read_model_prerequisites: boolean;
  first_state_visible: boolean;
  mcft_stage1b_qualified: false;
  site_data_smoke_passed: false;
};

function identityCompatible(a: IdentityRow, b: IdentityRow): boolean {
  return a.db === PRODUCT_DB && b.db === FORMAL_DB
    && Boolean(a.project_id) && a.project_id === b.project_id
    && Boolean(a.branch_id) && a.branch_id === b.branch_id;
}

/**
 * Read-only host preflight. PASS_PRECONDITIONS_ONLY never means customer API
 * routing, source snapshot/identity hashes, G12/G13 or Sites E2E has passed.
 * This function does not access production HTTP routes or write to databases.
 */
export async function verifyProductFormalV5ReadinessV1(
  identityPool: Pick<Pool, "query">,
  canonicalPool: Pick<Pool, "query">,
): Promise<ProductFormalV5ReadinessV1> {
  const identitySql =
    "SELECT current_database()::text AS db,current_setting('neon.project_id',true)::text AS project_id,current_setting('neon.branch_id',true)::text AS branch_id,current_setting('transaction_read_only')::text AS db_readonly,current_user::text AS role";
  const [i, f] = await Promise.all([
    identityPool.query<IdentityRow>(identitySql),
    canonicalPool.query<IdentityRow>(identitySql),
  ]);
  const identity = i.rows[0], formal = f.rows[0];
  if (!identity || !formal) fail("DB_IDENTITY_READBACK_EMPTY");
  const reasons: string[] = [];
  const same = identityCompatible(identity,formal);
  if (!same) reasons.push("PRODUCT_FORMAL_NEON_PROJECT_BRANCH_OR_DATABASE_MISMATCH");
  const readonly = identity.db_readonly === "on" && formal.db_readonly === "on"
    && identity.role === ROLE && formal.role === ROLE;
  if (!readonly) reasons.push("PRODUCT_FORMAL_READONLY_SESSION_ROLE_NOT_VERIFIED");

  const relations = await canonicalPool.query<RelationRow>(
    `SELECT expected.relation,
            to_regclass('public.' || expected.relation) IS NOT NULL AS exists,
            COALESCE(has_table_privilege(current_user,to_regclass('public.' || expected.relation),'SELECT'),false) AS can_select,
            COALESCE(has_table_privilege(current_user,to_regclass('public.' || expected.relation),'INSERT'),false) AS can_insert,
            COALESCE(has_table_privilege(current_user,to_regclass('public.' || expected.relation),'UPDATE'),false) AS can_update,
            COALESCE(has_table_privilege(current_user,to_regclass('public.' || expected.relation),'DELETE'),false) AS can_delete
       FROM unnest($1::text[]) AS expected(relation)
      ORDER BY expected.relation`,
    [[...PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1]],
  );
  const byName=new Map(relations.rows.map(r=>[r.relation,r]));
  for(const name of PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1){
    const r=byName.get(name);
    if(!r?.exists) reasons.push("PRODUCT_FORMAL_REQUIRED_RELATION_MISSING:"+name);
    else if(!r.can_select) reasons.push("PRODUCT_FORMAL_SELECT_PRIVILEGE_MISSING:"+name);
    if(r&&(r.can_insert||r.can_update||r.can_delete)) reasons.push("PRODUCT_FORMAL_WRITE_PRIVILEGE_FORBIDDEN:"+name);
  }
  const readModelReady=PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1.every(name=>{
    const r=byName.get(name);
    return r?.exists&&r.can_select&&!r.can_insert&&!r.can_update&&!r.can_delete;
  });

  const idRows = await identityPool.query<{field_id:string}>(
    "SELECT field_id FROM public.field_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 LIMIT 2",
    Object.values(PRODUCT_FORMAL_V5_SCOPE_V1),
  );
  if(idRows.rows.length!==1 || idRows.rows[0].field_id!==PRODUCT_FORMAL_V5_SCOPE_V1.field_id){
    reasons.push("PRODUCT_FORMAL_RESEARCH_FIELD_IDENTITY_CARDINALITY_INVALID");
  }
  const activeRows=await canonicalPool.query<{season_id:string;zone_id:string}>(
    "SELECT season_id,zone_id FROM public.twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 LIMIT 3",
    Object.values(PRODUCT_FORMAL_V5_SCOPE_V1),
  );
  const exactlyOne=activeRows.rows.length===1&&Boolean(activeRows.rows[0].season_id)&&Boolean(activeRows.rows[0].zone_id);
  if(!exactlyOne) reasons.push(activeRows.rows.length===0?"MCFT_FORMAL_ACTIVE_LINEAGE_NOT_ESTABLISHED":"MCFT_FORMAL_ACTIVE_LINEAGE_AMBIGUOUS");
  let firstState=false;
  if(exactlyOne){
    const exact=activeRows.rows[0];
    const state=await canonicalPool.query<{n:string}>(
      "SELECT count(*)::text AS n FROM (SELECT 1 FROM public.twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 LIMIT 1) AS selected",
      [...Object.values(PRODUCT_FORMAL_V5_SCOPE_V1),exact.season_id,exact.zone_id],
    );
    firstState=state.rows[0]?.n==="1";
  }
  if(!firstState) reasons.push("MCFT_FORMAL_POSTERIOR_STATE_NOT_YET_PERSISTED");
  return {
    status:reasons.length===0?"PASS_PRECONDITIONS_ONLY":"BLOCKED",
    reason_codes:reasons.sort(),
    cross_database_same_neon_project_and_branch:same,
    role_read_only:readonly,
    complete_cap07_read_model_prerequisites:readModelReady,
    first_state_visible:firstState,
    mcft_stage1b_qualified:false,
    site_data_smoke_passed:false,
  };
}
