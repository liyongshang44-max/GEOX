"use strict";
// Pure CLI argument and fail-closed guard tests; no Windows execution in CI.
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const cli=require("./RUN_MCFT_CAP09_ATTEMPT3_HOST_V2_WINDOWS.cjs");
const file=path.resolve("/temp","signed-v2-run.json");
test("V2 Windows CLI requires explicit operator and unique execute/preflight mode",()=>{
 const good=["--operator-authorized","--attempt3-v2","--preflight-only","--input",file];
 assert.equal(cli.parse(good).execute,false);
 assert.equal(cli.parse(good.map(s=>s==="--preflight-only"?"--execute":s)).execute,true);
 for(const bad of [
 ["--input",file],
 good.filter(s=>s!=="--operator-authorized"),
 good.concat("--execute"),
 good.concat("--preflight-only"),
 good.concat("--unknown"),
 ["--operator-authorized","--attempt3-v2","--execute","--input","relative.json"],
 ["--operator-authorized","--attempt3-v2","--execute","--input",file,"--execute"]
 ])assert.throws(()=>cli.parse(bad));
});
test("CI cannot use Windows host CLI to consume any Permit",async()=>{
 await assert.rejects(()=>cli.run(["--operator-authorized","--attempt3-v2","--execute","--input",file]),
  /V2_WINDOWS_HOST_ONLY/);
});
