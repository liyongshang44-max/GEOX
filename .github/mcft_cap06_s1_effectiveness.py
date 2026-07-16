from __future__ import annotations
import json
from pathlib import Path

R=Path.cwd(); S1='MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1'; S2='MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1'
HEAD='6ed8956155fba4d7ae040f88ab1870e564945f7c'; CI=29493034432; MERGE='4fc1044085c4befad7852089b6ebe2afab46a5ca'; PROOF=29493733228
RH='sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60'; CH='sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3'
CW='sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d'; HW='sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a'
B=['docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md','docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json','docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md','scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs']
def P(x): return R/x
def J(x): return json.loads(P(x).read_text())
def W(x,v): P(x).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def one(t,a,b,n):
 c=t.count(a)
 if c!=1: raise RuntimeError(f'{n}:{c}')
 return t.replace(a,b,1)

old=J('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json')
e={'schema_version':'geox_mcft_cap_06_s1_effectiveness_v2','effectiveness_id':'MCFT-CAP-06.S1.CORRECTED-MERGED-MAIN-EFFECTIVENESS-V2','capability_line_id':'MCFT-CAP-06','delivery_slice_id':S1,'status':'MERGED_EFFECTIVE','effective':True,'effectiveness_revision':'CORRECTED_SUCCESSOR_READINESS_V2','implementation_pr_number':2519,'implementation_exact_head':HEAD,'implementation_exact_head_ci_run':CI,'implementation_merge_commit':MERGE,'head_to_merge_file_delta_count':0,'head_to_merge_tree_equivalence':'PASS','postmerge_probe_pr_number':2520,'postmerge_probe_closed_without_merge':True,'postmerge_workflow_run':PROOF,'postmerge_gate':'PASS','canonical_residual_count':24,'residual_set_hash':RH,'case_input_set_hash':CH,'calibration_window_hash':CW,'holdout_window_hash':HW,'window_hash_semantics':'ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1','required_window_semantic_companion_hashes':{'residual_set_hash':RH,'case_input_set_hash':CH,'ordered_residual_hashes_required':True},'calibration_sensitive_case_count':16,'minimum_sensitive_case_count':4,'calibration_regime_counts':{'LOW_EXCESS':8,'MID_EXCESS':2,'HIGH_EXCESS':6},'calibration_represented_sensitive_regime_count':3,'minimum_required_sensitive_regime_count':2,'holdout_regime_counts':{'LOW_EXCESS':0,'MID_EXCESS':0,'HIGH_EXCESS':8},'holdout_purpose':'HIGH_EXCESS_STRESS_HOLDOUT_ONLY','holdout_generalization_claim':'NOT_ESTABLISHED','base_replay_exactness':'PASS_24_EXACT_STORAGE_AND_ZERO_MASS_BALANCE_ERROR','successor_readiness_data_precondition':'PASS','runtime_source_authorized':True,'canonical_write_effective_for_s1':True,'canonical_write_scope':['twin_forecast_residual_v1'],'migration_delta':0,'active_delivery_slice_id':S2,'authorized_not_started_slice_ids':[S2],'s2_authorized':True,'s2_implementation_started':False,'candidate_runtime_implemented':False,'shadow_evaluation_runtime_implemented':False,'calibration_contract_math_implemented':False,'model_activation_authorized':False,'active_config_switch_authorized':False,'successor_capability_line_authorized':False,'writeback_validation':{'implementation_exact_head_ci':'PASS','head_to_merge_tree_equivalence':'PASS','exact_merged_main_proof':'PASS','active_slice_ssot_consistency':'PASS','exact_changed_file_count':9,'temporary_workflows_retained':False,'generated_acceptance_artifacts_retained':False},'effectiveness_writeback_changed_file_boundary':B,'superseded_prior_effectiveness':old,'preserved_nonclaims':['NO_S2_IMPLEMENTATION','NO_CALIBRATION_CANDIDATE','NO_SHADOW_EVALUATION','NO_MODEL_ACTIVATION','NO_ACTIVE_CONFIG_SWITCH','NO_STATE_OR_CHECKPOINT_MUTATION_BY_EFFECTIVENESS_WRITEBACK','NO_PUBLIC_ROUTE_OR_WEB_OR_SCHEDULER','NO_MCFT_CAP_07_AUTHORIZATION']}; W('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json',e)

s=J('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json'); s.update(status='MERGED_EFFECTIVE_CORRECTED',s1_effective=True,s2_authorized=True); s['effectiveness']={'effective':True,'effectiveness_revision':'CORRECTED_SUCCESSOR_READINESS_V2','implementation_pr_number':2519,'implementation_exact_head':HEAD,'implementation_exact_head_ci_run':CI,'merge_commit':MERGE,'head_to_merge_file_delta_count':0,'head_to_merge_tree_equivalence':'PASS','postmerge_probe_pr_number':2520,'postmerge_probe_closed_without_merge':True,'postmerge_workflow_run':PROOF,'postmerge_gate':'PASS'}; s['candidate_tree_validation'].update(exact_head_ci_status='PASS',repository_typecheck=f'PASS_EXACT_HEAD_CI_{CI}',repository_build=f'PASS_EXACT_HEAD_CI_{CI}'); s['effectiveness_writeback_changed_file_boundary']=B; W('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json',s)

er=J('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json'); er['status']='CORRECTION_MERGED_EFFECTIVE'; er['effectiveness']={'effective':True,'implementation_exact_head':HEAD,'implementation_exact_head_ci_run':CI,'merge_commit':MERGE,'head_to_merge_tree_equivalence':'PASS','postmerge_probe_pr_number':2520,'postmerge_probe_closed_without_merge':True,'postmerge_workflow_run':PROOF,'postmerge_gate':'PASS'}; W('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json',er)

c=J('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json'); c.update(status='MERGED_EFFECTIVE',reconciliation_effective=True,next_repository_action=S2,effectiveness_condition='SATISFIED_BY_PR_2519_AND_PROOF_RUN_29493733228'); q=c['current_state']; q.update(active_delivery_slice_id=S2,s1='MERGED_EFFECTIVE_CORRECTED',controlled_residual_window_effective=True,s1_successor_readiness_effective=True,s2='AUTHORIZED_NOT_STARTED',s2_authorized=True,s2_implementation_started=False,calibration_contract_math_implemented=False); x=c['proof']['s1_controlled_data_correction']; x.update(correction_pr_number=2519,exact_head=HEAD,exact_head_ci_run=CI,merge_commit=MERGE,head_to_merge_file_delta_count=0,head_to_merge_tree_equivalence='PASS',postmerge_probe_pr_number=2520,postmerge_probe_closed_without_merge=True,postmerge_workflow_run=PROOF,postmerge_gate='PASS',regime_acceptance='PASS_16_SENSITIVE_3_REGIMES',postgresql_acceptance='9_PASS_0_FAIL',effective=True,effectiveness_ref='docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json'); c['s1_candidate'].update(status='MERGED_EFFECTIVE_CORRECTED',residual_set_hash=RH,case_input_set_hash=CH,calibration_window_hash=CW,holdout_window_hash=HW,exact_head_ci_run=CI,postmerge_workflow_run=PROOF); W('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',c)

d=J('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json'); d.update(implementation_status='S1_CORRECTION_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED',active_delivery_slice_id=S2,candidate_slices=[],authorized_not_started_slices=[S2],next_repository_action=S2,s1_effective=True,s1_successor_readiness_effective=True,s2_authorized=True,s2_implementation_started=False,s1_prior_mechanical_effectiveness_preserved=True); d['blocked_slices']=[z for z in d['blocked_slices'] if z!=S2]
for z in d['completed_or_effective_slices']:
 if z.get('delivery_slice_id')==S1: z.update(status='MERGED_EFFECTIVE_CORRECTED',correction_pr_number=2519,exact_head=HEAD,exact_head_ci_run=CI,merge_commit=MERGE,head_to_merge_file_delta_count=0,head_to_merge_tree_equivalence='PASS',postmerge_probe_pr_number=2520,postmerge_workflow_run=PROOF,postmerge_gate='PASS',canonical_residual_count=24,residual_set_hash=RH,case_input_set_hash=CH,calibration_window_hash=CW,holdout_window_hash=HW,successor_readiness_data_precondition='PASS')
W('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',d)

m=J('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json'); m['baseline']={'branch':'main','commit':MERGE,'meaning':'MCFT-CAP-06 corrected S1 merged-main effective; S2 authorized not started; S3+ and MCFT-CAP-07 blocked'}; lines=m.get('capability_lines') or m.get('capabilities'); l=next(z for z in lines if z.get('capability_line_id')=='MCFT-CAP-06'); l.update(status='IMPLEMENTATION_IN_PROGRESS',active_delivery_slice_id=S2,next_authorized_slice_ids=[S2],controlled_residual_window_effective=True,s1_successor_readiness_effective=True,candidate_runtime_implemented=False,shadow_evaluation_runtime_implemented=False,calibration_contract_math_implemented=False)
for z in l['delivery_slices']:
 if z.get('delivery_slice_id')==S1: z.update(status='MERGED_EFFECTIVE_CORRECTED',effectiveness_condition_satisfied=True,correction_pr_number=2519,exact_head=HEAD,exact_head_ci_run=CI,merge_commit=MERGE,head_to_merge_file_delta_count=0,head_to_merge_tree_equivalence='PASS',postmerge_probe_pr_number=2520,postmerge_workflow_run=PROOF,postmerge_gate='PASS',residual_set_hash=RH,case_input_set_hash=CH,successor_readiness_data_precondition='PASS')
 if z.get('delivery_slice_id')==S2: z.update(status='AUTHORIZED_NOT_STARTED',implementation_started=False)
W('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',m)

tp='docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md'; t=P(tp).read_text(); t=one(t,'implementation_status:\nS1_CONTROLLED_DATA_CORRECTION_CANDIDATE','implementation_status:\nS1_CORRECTION_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED','TASK_STATUS'); t=one(t,'runtime_implementation_status:\nS1_MECHANICAL_IMPLEMENTATION_PRESERVED_SUCCESSOR_READINESS_SUPERSEDED','runtime_implementation_status:\nS1_CORRECTED_SUCCESSOR_READINESS_EFFECTIVE_S2_NOT_STARTED','TASK_RUNTIME'); t=one(t,f'active_delivery_slice_id:\n{S1}',f'active_delivery_slice_id:\n{S2}','TASK_ACTIVE'); t=one(t,f'first_permitted_repository_action:\n{S1}',f'first_permitted_repository_action:\n{S2}','TASK_ACTION'); oldtxt='本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 已 merged-main effective；原 S1 的机械持久化、幂等和重建证明保留，但后继就绪性已由 additive erratum 撤销，当前为 S1 controlled-data correction candidate。S2 及其后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 均保持未授权。'; newtxt='本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0、S0 与 corrected S1 已 merged-main effective；当前唯一 active slice 为 S2 contracts/math，状态 AUTHORIZED_NOT_STARTED。S3 及其后续、Calibration Candidate、Shadow Evaluation、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 均保持未授权。'; t=one(t,oldtxt,newtxt,'TASK_SUMMARY'); mark='<!-- MCFT-CAP-06-S1-CORRECTED-EFFECTIVENESS-V2 -->';
if mark not in t: t+=f'\n\n{mark}\n## Corrected S1 merged-main effectiveness\n\n```text\nimplementation PR: #2519\nexact head: {HEAD}\nexact-head CI: {CI} PASS\nmerge commit: {MERGE}\ntree equivalence: PASS\npostmerge proof PR: #2520 closed without merge\npostmerge proof workflow: {PROOF} PASS\nS1 status: MERGED_EFFECTIVE_CORRECTED\nS2 status: AUTHORIZED_NOT_STARTED\nS2 implementation started: false\nCandidate / Evaluation / Activation: absent\n```\n'; P(tp).write_text(t)
mp='docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md'; a=P(mp).read_text(); mm='<!-- MCFT-CAP-06-S1-CORRECTED-EFFECTIVENESS-V2 -->';
if mm not in a: a+=f'\n\n{mm}\n## MCFT-CAP-06 corrected S1 effectiveness and S2 authorization\n\n```text\ncorrected S1 implementation PR: #2519\nexact head: {HEAD}\nexact-head CI: {CI} PASS\nmerge commit: {MERGE}\ntree equivalence: PASS\nexact merged-main proof: {PROOF} PASS\ncorrected S1: MERGED_EFFECTIVE\nactive delivery slice: {S2}\nS2: AUTHORIZED_NOT_STARTED\nS3+: BLOCKED\nCalibration Candidate: NOT IMPLEMENTED\nShadow Evaluation: NOT IMPLEMENTED\nModel Activation: NOT AUTHORIZED\n```\n'; P(mp).write_text(a)

gp='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs'; g=P(gp).read_text(); start=g.index("  assert.equal(erratum.status, 'CORRECTION_CANDIDATE');"); end=g.index("  const runner = readText(",start); block=f"""  assert.equal(erratum.status, 'CORRECTION_MERGED_EFFECTIVE');
  assert.equal(erratum.effectiveness.effective, true);
  assert.equal(erratum.effectiveness.implementation_exact_head, '{HEAD}');
  assert.equal(erratum.effectiveness.implementation_exact_head_ci_run, {CI});
  assert.equal(erratum.effectiveness.merge_commit, '{MERGE}');
  assert.equal(erratum.effectiveness.postmerge_workflow_run, {PROOF});
  assert.equal(erratum.correction.successor_readiness_data_precondition, 'PASS');
  assert.equal(erratum.correction.holdout_generalization_claim, 'NOT_ESTABLISHED');

  assert.equal(contract.canonical_deltas.twin_calibration_candidate_v1, 0);
  assert.equal(contract.canonical_deltas.twin_shadow_evaluation_v1, 0);
  assert.equal(contract.canonical_deltas.twin_model_activation_v1, 0);
  assert.equal(contract.residual_set_hash, EXPECTED_RESIDUAL_SET_HASH);
  assert.equal(contract.case_input_set_hash, EXPECTED_CASE_INPUT_SET_HASH);

  assert.equal(status.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(status.s1_effective, true);
  assert.equal(status.s2_authorized, true);
  assert.equal(status.effectiveness.effective, true);
  assert.equal(status.effectiveness.implementation_exact_head, '{HEAD}');
  assert.equal(status.effectiveness.implementation_exact_head_ci_run, {CI});
  assert.equal(status.effectiveness.merge_commit, '{MERGE}');
  assert.equal(status.effectiveness.postmerge_workflow_run, {PROOF});

  assert.equal(priorEffectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(priorEffectiveness.effective, true);
  assert.equal(priorEffectiveness.effectiveness_revision, 'CORRECTED_SUCCESSOR_READINESS_V2');
  assert.equal(priorEffectiveness.implementation_pr_number, 2519);
  assert.equal(priorEffectiveness.implementation_exact_head, '{HEAD}');
  assert.equal(priorEffectiveness.implementation_exact_head_ci_run, {CI});
  assert.equal(priorEffectiveness.implementation_merge_commit, '{MERGE}');
  assert.equal(priorEffectiveness.postmerge_workflow_run, {PROOF});
  assert.equal(priorEffectiveness.active_delivery_slice_id, S2);
  assert.deepEqual(priorEffectiveness.authorized_not_started_slice_ids, [S2]);
  assert.equal(priorEffectiveness.s2_implementation_started, false);
  assert.equal(priorEffectiveness.candidate_runtime_implemented, false);
  assert.equal(priorEffectiveness.shadow_evaluation_runtime_implemented, false);
  assert.equal(priorEffectiveness.calibration_contract_math_implemented, false);
  assert.equal(priorEffectiveness.superseded_prior_effectiveness.implementation_pr_number, 2514);

  assert.equal(delivery.active_delivery_slice_id, S2);
  assert.deepEqual(delivery.candidate_slices, []);
  assert.deepEqual(delivery.authorized_not_started_slices, [S2]);
  assert.equal(delivery.blocked_slices.includes(S2), false);
  assert.equal(delivery.s1_effective, true);
  assert.equal(delivery.s1_successor_readiness_effective, true);
  assert.equal(delivery.s2_authorized, true);
  assert.equal(delivery.s2_implementation_started, false);

  assert.equal(current.status, 'MERGED_EFFECTIVE');
  assert.equal(current.reconciliation_effective, true);
  assert.equal(current.current_state.active_delivery_slice_id, S2);
  assert.equal(current.current_state.s1, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(current.current_state.controlled_residual_window_effective, true);
  assert.equal(current.current_state.s1_successor_readiness_effective, true);
  assert.equal(current.current_state.s2, 'AUTHORIZED_NOT_STARTED');
  assert.equal(current.current_state.s2_authorized, true);
  assert.equal(current.current_state.s2_implementation_started, false);
  assert.equal(current.current_state.calibration_contract_math_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S2);
  assert.deepEqual(line.next_authorized_slice_ids, [S2]);
  assert.equal(line.controlled_residual_window_effective, true);
  assert.equal(line.s1_successor_readiness_effective, true);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.calibration_contract_math_implemented, false);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(matrixS1.effectiveness_condition_satisfied, true);
  assert.equal(matrixS2.status, 'AUTHORIZED_NOT_STARTED');
  assert.equal(matrixS2.implementation_started, false);

"""; g=g[:start]+block+g[end:]; g=g.replace("PASS prior mechanical proof preserved while S2 authorization is withdrawn","PASS corrected S1 effectiveness preserves prior mechanical proof and authorizes S2 only"); P(gp).write_text(g)
print(json.dumps({'updated_files':sorted(B),'active_slice':S2},indent=2))