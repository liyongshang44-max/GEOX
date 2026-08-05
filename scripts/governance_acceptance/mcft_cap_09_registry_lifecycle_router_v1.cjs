#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const lane=process.env.MCFT_REGISTRY_LANE;
const mode=process.env.MCFT_REGISTRY_MODE;
const routes={
's2-cross-lifecycle-repair':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs'],
's2-registry-registration':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_REGISTRATION.cjs'],
's2-candidate-signal':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs',lane==='trusted-registry-bootstrap'?'--trusted-lifecycle':'--registration-lifecycle'],
's1-cross-lifecycle-repair':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR.cjs'],
's1-registry-registration':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs'],
's1-candidate-signal':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs',lane==='trusted-registry-bootstrap'?'--trusted-lifecycle':'--registration-lifecycle'],
};
if(lane==='trusted-registry-bootstrap'){
routes['workflow-repair']=['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs'];
routes['registry-existing-paths-correction']=['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs','--registry-existing-paths-correction'];
routes['candidate-signal']=['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs','--candidate-signal'];
routes.bootstrap=['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs','--bootstrap'];
}
const route=routes[mode];
if(!route) throw new Error(`UNSUPPORTED_CAP09_REGISTRY_LIFECYCLE:${lane}:${mode}`);
const result=cp.spawnSync(process.execPath,route,{stdio:'inherit',env:process.env});
if(result.error) throw result.error;
process.exit(result.status??1);
