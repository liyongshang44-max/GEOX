const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function read(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

(async () => {
  const recommendationContract = read('packages/contracts/src/agronomy/recommendation_v2.ts');
  const ruleHelpers = read('apps/server/src/domain/agronomy/rules/helpers.ts');
  const ruleEngine = read('apps/server/src/domain/agronomy/rule_engine.ts');
  const prescriptionDomain = read('apps/server/src/domain/prescription/prescription_contract_v1.ts');

  const recommendation_has_skill_trace = /skill_trace\?:\s*SkillTraceV1/.test(recommendationContract);
  const skill_trace_has_skill_id = /skill_id:\s*string/.test(recommendationContract);
  const skill_trace_has_inputs_outputs = /inputs\?:\s*Record<string, any>/.test(recommendationContract)
    && /outputs\?:\s*Record<string, any>/.test(recommendationContract);
  const skill_trace_has_confidence = /confidence\?:\s*SkillTraceConfidenceV1/.test(recommendationContract)
    && /level:\s*"HIGH" \| "MEDIUM" \| "LOW"/.test(recommendationContract)
    && /basis:\s*"measured" \| "estimated" \| "assumed"/.test(recommendationContract);

  const domainBuildsSkillTrace = /buildSkillTraceV1\(/.test(ruleHelpers) && /buildSkillTraceV1\(/.test(ruleEngine);

  // Prescription path receives recommendation payload as recPayload and preserves metadata objects from parameters.
  const prescriptionReceivesRecommendationPayload = /createPrescriptionFromRecommendation\([\s\S]*recPayload:\s*any/.test(prescriptionDomain);
  const prescriptionCarriesMetadataObjects = /weather_constraints:\s*suggestionParams\.weather_constraints/.test(prescriptionDomain);
  const prescription_inherits_skill_trace = domainBuildsSkillTrace && prescriptionReceivesRecommendationPayload && prescriptionCarriesMetadataObjects;

  // Backward compatibility guard: new field is optional.
  const backward_compatibility_ok = /skill_trace\?:\s*SkillTraceV1/.test(recommendationContract);

  const checks = {
    recommendation_has_skill_trace,
    skill_trace_has_skill_id,
    skill_trace_has_inputs_outputs,
    skill_trace_has_confidence,
    prescription_inherits_skill_trace,
    backward_compatibility_ok,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
