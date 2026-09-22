import { runProductApiPublicRuntimeV1 } from "./product_api/product_api_public_runtime_v1.js";

runProductApiPublicRuntimeV1().catch((error) => {
  console.error(
    `FATAL: GEOX Product API Public Runtime crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
  );
  process.exit(1);
});
