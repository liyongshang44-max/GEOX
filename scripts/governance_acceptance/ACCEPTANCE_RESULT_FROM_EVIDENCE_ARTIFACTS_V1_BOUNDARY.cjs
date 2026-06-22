// scripts/governance_acceptance/ACCEPTANCE_RESULT_FROM_EVIDENCE_ARTIFACTS_V1_BOUNDARY.cjs
const fs = require('fs');
function r(p){ return fs.readFileSync(p,'utf8'); }
function ok(c,m){ if(!c){ console.error('FAIL',m); process.exit(1); } console.log('PASS',m); }
const route = r('apps/server/src/routes/acceptance_v1.ts');
const start = route.indexOf('app.post("/api/v1/acceptance/from-evidence-artifacts"');
const end = route.indexOf('app.post("/api/v1/acceptance/evaluate"', start);
ok(start >= 0, 'Route exists: POST /api/v1/acceptance/from-evidence-artifacts');
const h44 = route.slice(start, end);
const builder = r('apps/server/src/domain/acceptance/acceptance_result_from_evidence_artifacts_v1.ts');
const roles = r('apps/server/src/domain/auth/roles.ts');
const auth = r('apps/server/src/auth/ao_act_authz_v0.ts');
const openapi = r('apps/server/src/routes/openapi_v1.ts');
const inv = r('apps/server/src/routes/api_route_inventory_v1.ts');
const web = fs.existsSync('apps/web/src') ? require('child_process').execSync("rg -n \"acceptance_result_v1|from-evidence-artifacts\" apps/web/src || true",{encoding:'utf8'}) : '';
ok(h44.includes('acceptance_result_v1'), 'Route uses acceptance_result_v1');
ok(h44.includes('operator_acceptance_result_submission_v1'), 'Route writes operator_acceptance_result_submission_v1');
ok(h44.includes('as_executed_record_v1'), 'Route reads as_executed_record_v1');
ok(h44.includes('evidence_artifact_v1'), 'Route reads evidence_artifact_v1');
ok(!h44.includes('/api/v1/acceptance/evaluate'), 'Route does not call existing /api/v1/acceptance/evaluate');
for (const x of ['water_response_verification_v1','roi_ledger_v1','field_memory_v1','operation_state_v1','projectReportV1','customer_delivery']) ok(!h44.includes(`type: "${x}"`) && !h44.includes(`type:'${x}'`), `Route does not write ${x}`);
ok(!/from ['"](?:pg|fastify)|from ['"].*routes|require\(['"](?:pg|fastify)/.test(builder), 'Builder does not import pg / Fastify / routes');
ok(!builder.includes('process.env'), 'Builder does not read process.env');
ok(!/Date\.now|new Date|randomUUID/.test(builder), 'Builder does not use Date.now / new Date / randomUUID');
ok(!/fetch\(|http\.|https\.|artifact_ref.*readFile|parse image|parse log/i.test(builder), 'Builder does not download or parse evidence URLs');
ok(builder.includes('s.pointer_only !== true') && builder.includes('s.no_acceptance_created !== true') && builder.includes('s.no_effect_judgement !== true') && builder.includes('p.source !== "AS_EXECUTED_RECORD_V1"'), 'Builder validates pointer_only / no_acceptance_created / no_effect_judgement and payload.source');
ok(builder.includes('source_lane === "SIMULATED_DEV_ONLY"') && builder.includes('source_lane === "DEBUG_ONLY"') && builder.includes('evidence_level === "DEBUG"') && builder.includes('is_simulated === true') && builder.includes('startsWith("dev://")') && builder.includes('startsWith("simulated://")') && builder.includes('flight-table') && builder.includes('flight_table') && !builder.includes('/dev|debug|simulated/'), 'Builder uses precise dev/simulated indicators without naked /dev/ substring regex');
ok(h44.includes('field_id=$4') && h44.includes('as_executed_id=$5') && h44.includes('task_id=$6') && h44.includes('receipt_id=$7'), 'Route uses full-scope as_executed lookup');
ok(h44.includes('acceptance.evaluate'), 'Route requires acceptance.evaluate');
ok(roles.includes('operator:') && roles.includes('"acceptance.evaluate"') && roles.includes('admin: ["*"]'), 'Operator/admin are allowed');
ok(!/approver:[^\n]*acceptance\.evaluate/.test(roles) && !/executor:[^\n]*acceptance\.evaluate/.test(roles) && !/client:[^\n]*acceptance\.evaluate/.test(roles) && !/viewer:[^\n]*acceptance\.evaluate/.test(roles) && auth.includes('isScopeAllowedForRoleV1'), 'Approver/executor/client/viewer are rejected unless explicitly granted acceptance.evaluate');
ok(openapi.includes('/api/v1/acceptance/from-evidence-artifacts') && openapi.includes('security: [{ bearerAuth: [] }]') && openapi.includes('auth_scope: "acceptance.evaluate"') && openapi.includes('audience: "operator"') && openapi.includes('boundary: "official"') && openapi.includes('owner: "acceptance-service / evidence-service"'), 'OpenAPI includes exact route with security/auth_scope/governance metadata');
ok(inv.includes('route_path: "/api/v1/acceptance/from-evidence-artifacts"') && inv.includes('customer_navigation_allowed: false'), 'API inventory includes exact route');
ok(!web.includes('from-evidence-artifacts'), 'Customer route/web files do not expose H44 acceptance as confirmed delivery');
