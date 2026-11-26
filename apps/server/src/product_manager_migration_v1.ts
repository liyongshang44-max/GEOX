// Explicit one-shot candidate entry, separate from Server startup and MCFT.
import { runProductManagerMigrationV1 } from "./infra/product_manager_migration_v1.js";
if (["DATABASE_URL","GEOX_RUNTIME_DATABASE_URL","GEOX_MIGRATION_DATABASE_URL","GEOX_DB_PLATFORM_ADMIN_DATABASE_URL"].some(k=>String(process.env[k]??"").trim())) {
  throw new Error("P6_PRODUCT_MIGRATION_FOREIGN_CREDENTIAL_PRESENT");
}
try {
  console.log(JSON.stringify(await runProductManagerMigrationV1({
    migrationDatabaseUrl:String(process.env.GEOX_PRODUCT_MIGRATION_DATABASE_URL??""),
    subjectCommit:String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT??""),
    repositoryRoot:process.cwd(),
  })));
} catch(e) {
  // Do not print connection details or SQL payloads.
  const msg=e instanceof Error?e.message:"";
  const code=String((e as {code?:unknown})?.code??"UNKNOWN");
  console.error(/^P6_PRODUCT_MIGRATION_[A-Z_]+$/.test(msg)?msg:"P6_PRODUCT_MIGRATION_FAILED");
  console.error("P6_PRODUCT_MIGRATION_ERROR_CODE="+(/^[A-Z0-9_]{1,32}$/.test(code)?code:"UNKNOWN"));
  process.exitCode=1;
}
