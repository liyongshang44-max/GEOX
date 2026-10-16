// Host-local read-only diagnostic. Never executes a production mutation.
// Usage (local trusted operator only):
// GEOX_PRODUCT_DATABASE_URL=... GEOX_PRODUCT_FORMAL_DATABASE_URL=...
// node --import tsx scripts/product_acceptance/PREFLIGHT_GEOX_PRODUCT_MCFT_FORMAL_READ_V1.ts --read-only-preflight
import { createProductApiReadOnlyPoolV1 } from "../../apps/server/src/product_api/product_api_public_runtime_v1.js";
import {
  assertProductFormalV5CrossDatabaseUrisV1,
  verifyProductFormalV5ReadinessV1,
} from "../../apps/server/src/product_projection/customer/customer_formal_v5_readiness_v1.js";

async function main():Promise<void>{
  if (process.argv.length!==3 || process.argv[2]!=="--read-only-preflight"){
    throw new Error("PRODUCT_FORMAL_EXPLICIT_READ_ONLY_PREFLIGHT_FLAG_REQUIRED");
  }
  const identityUrl=String(process.env.GEOX_PRODUCT_DATABASE_URL??"");
  const canonicalUrl=String(process.env.GEOX_PRODUCT_FORMAL_DATABASE_URL??"");
  assertProductFormalV5CrossDatabaseUrisV1(identityUrl,canonicalUrl);
  const identityPool=createProductApiReadOnlyPoolV1(identityUrl);
  const canonicalPool=createProductApiReadOnlyPoolV1(canonicalUrl);
  try{
    const result=await verifyProductFormalV5ReadinessV1(identityPool,canonicalPool);
    process.stdout.write(JSON.stringify({
      schema_version:"geox.product.mcft-formal-read-only-preflight.v1",
      observed_at:new Date().toISOString(),
      ...result,
      customer_authoritative_state:false,
      customer_route_smoke_verified:false,
      production_mutation:false,
    },null,2)+"\n");
    if(result.status!=="PASS_PRECONDITIONS_ONLY")process.exitCode=2;
  }finally{
    await Promise.allSettled([identityPool.end(),canonicalPool.end()]);
  }
}
main().catch(error=>{
  process.stderr.write("PRODUCT_FORMAL_READ_PREFLIGHT_FAIL_CLOSED:"+String((error as Error).message)+"\n");
  process.exitCode=2;
});
