// Purpose: provision the bounded MCFT-CAP-08 runner and extend its exact ACL for the authority-bound T17 transition guard.
// Boundary: role and ACL normalization only; no business DDL, canonical facts, projection rows, Runtime execution, or shared commercial database mutation.
import { Pool } from "pg";
import {
  MCFT_CAP08_DATABASE_NAME_PATTERN_V1,
  MCFT_CAP08_RELATION_PRIVILEGES_V1 as MCFT_CAP08_BASE_RELATION_PRIVILEGES_V1,
  MCFT_CAP08_RUNNER_ROLE_V1,
  runMcftCap08DatabasePlatformBootstrapV1 as runMcftCap08BaseDatabasePlatformBootstrapV1,
} from "./mcft_cap08_database_platform_bootstrap_base_v1.js";
import type { McftCap08BootstrapConfigV1 } from "./mcft_cap08_database_platform_bootstrap_base_v1.js";

export { MCFT_CAP08_DATABASE_NAME_PATTERN_V1, MCFT_CAP08_RUNNER_ROLE_V1 };
export type { McftCap08BootstrapConfigV1 };

export const MCFT_CAP08_RELATION_PRIVILEGES_V1 = {
  ...MCFT_CAP08_BASE_RELATION_PRIVILEGES_V1,
  twin_cap08_s4_t17_transition_guard_v1: ["SELECT", "INSERT"],
} as const;

const T17_GUARD_RELATION_V1 = "public.twin_cap08_s4_t17_transition_guard_v1" as const;

export async function runMcftCap08DatabasePlatformBootstrapV1(config: McftCap08BootstrapConfigV1) {
  const base = await runMcftCap08BaseDatabasePlatformBootstrapV1(config);
  const pool = new Pool({ connectionString: config.admin_database_url, max: 1 });
  try {
    const presence = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [T17_GUARD_RELATION_V1]);
    if (presence.rows[0]?.present !== true) throw new Error("MCFT_CAP08_T17_TRANSITION_GUARD_RELATION_MISSING");

    await pool.query(`REVOKE ALL ON TABLE ${T17_GUARD_RELATION_V1} FROM ${MCFT_CAP08_RUNNER_ROLE_V1}`);
    await pool.query(`GRANT SELECT, INSERT ON TABLE ${T17_GUARD_RELATION_V1} TO ${MCFT_CAP08_RUNNER_ROLE_V1}`);

    const privilegeNames = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const;
    const actual: string[] = [];
    for (const privilege of privilegeNames) {
      const result = await pool.query(`SELECT has_table_privilege($1,$2,$3) AS ok`, [
        MCFT_CAP08_RUNNER_ROLE_V1,
        T17_GUARD_RELATION_V1,
        privilege,
      ]);
      if (result.rows[0]?.ok === true) actual.push(privilege);
    }
    if (JSON.stringify(actual) !== JSON.stringify(["SELECT", "INSERT"])) {
      throw new Error(`MCFT_CAP08_T17_TRANSITION_GUARD_PRIVILEGES_NOT_EXACT:${actual.join(",")}`);
    }

    return {
      ...base,
      relation_count: Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).length,
      t17_transition_guard_privileges: actual,
      t17_transition_guard_acl_extension: true,
    };
  } finally {
    await pool.end();
  }
}
