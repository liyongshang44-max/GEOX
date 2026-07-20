// apps/server/scripts/write_dist_entries.cjs
// Purpose: create stable compiled Runtime entrypoints for the server, jobs worker, external database-platform bootstrap, and dedicated MCFT-CAP-07 one-shot migration workload.
// Boundary: file packaging only; generated Runtime entrypoints do not share credentials or collapse one-shot database authority into the long-running server process.

const fs = require("node:fs");
const path = require("node:path");

const base = path.resolve(__dirname, "..");
const dist = path.join(base, "dist");
fs.mkdirSync(dist, { recursive: true });

const entries = [
  {
    name: "server.js",
    content: `import "./apps/server/src/server.js";\n`,
  },
  {
    name: path.join("jobs", "runtime.js"),
    content: `import { runJobsRuntime } from "../apps/server/src/jobs/runtime.js";

runJobsRuntime().catch((error) => {
  console.error(\`FATAL: jobs runtime crashed: \${error instanceof Error ? error.stack ?? error.message : String(error)}\`);
  process.exit(1);
});
`,
  },
  {
    name: path.join("database", "platform_bootstrap.js"),
    content: `import { runMcftCap07DatabasePlatformBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.js";
import { runRuntimeSchemaCompatibilityBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.js";
import { runRuntimeDispatchQueueBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/runtime_dispatch_queue_bootstrap_v1.js";
import { runRuntimeDeviceStatusCompatibilityBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/runtime_device_status_compatibility_bootstrap_v1.js";
import { runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/runtime_skill_registry_compatibility_bootstrap_v1.js";
import { runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1 } from "../apps/server/src/infra/runtime_field_fertility_compatibility_bootstrap_v1.js";

async function runDatabasePlatformBootstrapV1() {
  await runMcftCap07DatabasePlatformBootstrapFromEnvironmentV1();
  await runRuntimeSchemaCompatibilityBootstrapFromEnvironmentV1();
  await runRuntimeDispatchQueueBootstrapFromEnvironmentV1();
  await runRuntimeDeviceStatusCompatibilityBootstrapFromEnvironmentV1();
  await runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1();
  await runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1();
}

runDatabasePlatformBootstrapV1().catch((error) => {
  console.error(\`FATAL: database platform bootstrap failed: \${error instanceof Error ? error.stack ?? error.message : String(error)}\`);
  process.exit(1);
});
`,
  },
  {
    name: path.join("database", "mcft_cap07_migration.js"),
    content: `import { runMcftCap07StartupMigrationFromEnvironmentV1 } from "../apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.js";

runMcftCap07StartupMigrationFromEnvironmentV1().catch((error) => {
  console.error(\`FATAL: MCFT-CAP-07 startup migration failed: \${error instanceof Error ? error.stack ?? error.message : String(error)}\`);
  process.exit(1);
});
`,
  },
];

for (const entry of entries) {
  const fp = path.join(dist, entry.name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, entry.content, "utf8");
}
