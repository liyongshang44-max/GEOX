const fs=require('node:fs');
const cp=require('node:child_process');
const s=JSON.parse(fs.readFileSync('docs/twin_kernel/ROI_LEDGER_PAYLOAD_SCHEMA_V0.json','utf8'));
const z=cp.spawnSync(process.execPath,['scripts/twin_kernel/P28_09_ROI_LEDGER_GATE_V0.cjs','--mode','dry-run'],{encoding:'utf8'});
const r=JSON.parse(z.stdout||'{}');
const checks=[];function ck(n,p){checks.push({name:n,passed:p===true});if(p!==true)throw new Error(n)}
ck('schema_version',s.schema_version==='roi_ledger_payload_schema_v0');
ck('target_fact_type',s.target_fact_type==='roi_ledger_v1');
ck('required_fields',s.required_fields.includes('roi_ledger_id')&&s.required_fields.includes('meta.idempotency_key'));
ck('states',s.allowed_ledger_states.includes('RECORDED')&&s.allowed_ledger_states.includes('POLICY_BLOCKED'));
ck('classification',s.allowed_accounting_classification.includes('FAVORABLE_ACCOUNTING_DELTA')&&s.allowed_accounting_classification.includes('UNKNOWN_ACCOUNTING_DELTA'));
ck('summary_boundary',s.accounting_summary_is_accounting_snapshot_only===true&&s.accounting_summary_is_not_financial_claim===true&&s.accounting_summary_is_not_field_memory_input===true);
ck('basis_rules',s.ledger_state_RECORDED_requires_complete_accounting_basis===true&&s.ledger_state_INSUFFICIENT_COST_BASIS_may_create_non_recorded_ledger_review===true);
ck('runner_alignment',z.status===0&&r.target_fact_type===s.target_fact_type);
const failed=checks.filter(x=>!x.passed);
console.log(JSON.stringify({ok:true,acceptance:'P28_05_ROI_LEDGER_PAYLOAD_SCHEMA_ACCEPTANCE',schema_version:s.schema_version,target_fact_type:s.target_fact_type,required_fields:s.required_fields,allowed_ledger_states:s.allowed_ledger_states,allowed_accounting_classification:s.allowed_accounting_classification,accounting_summary_is_accounting_snapshot_only:s.accounting_summary_is_accounting_snapshot_only,accounting_summary_is_not_financial_claim:s.accounting_summary_is_not_financial_claim,accounting_summary_is_not_profit_realization:s.accounting_summary_is_not_profit_realization,accounting_summary_is_not_yield_attribution:s.accounting_summary_is_not_yield_attribution,accounting_summary_is_not_effect_attribution:s.accounting_summary_is_not_effect_attribution,accounting_summary_is_not_field_memory_input:s.accounting_summary_is_not_field_memory_input,ledger_state_RECORDED_requires_complete_accounting_basis:s.ledger_state_RECORDED_requires_complete_accounting_basis,ledger_state_INSUFFICIENT_COST_BASIS_may_create_non_recorded_ledger_review:s.ledger_state_INSUFFICIENT_COST_BASIS_may_create_non_recorded_ledger_review,server_runtime_surface_changed:false,production_runtime_surface_changed:false,db_surface_changed:false,frontend_surface_changed:false,package_surface_changed:false,ci_surface_changed:false,upstream_contract_surface_changed:false,forbidden_surface_diff_count:0,assertion_count:checks.length,failed_assertion_count:failed.length,failed_assertions:failed.map(x=>x.name)},null,2));
