import contextlib
import hashlib
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import material_binding as mb
import build_evidence as be
from evidence_review import review


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.payload=self.root/'payload';self.payload.mkdir()
        self.files={'scripts/runtime_acceptance/main.cjs':b'// real source\n','pnpm-lock.yaml':b'lockfileVersion: 9\n',
            'apps/server/package.json':b'{"name":"server"}\n','docs/authority.json':b'{"adopted":false}\n'}
        rows=[]
        for p,b in sorted(self.files.items()):
            mb.write_new(self.payload/p,b);rows.append({'path':p,'sha256':mb.sha(b),'size_bytes':len(b),'category':mb.category(p)})
        self.manifest={'schema_version':mb.SCHEMA,'subject_commit_sha':be.SUBJECT,'scope_version':'CONSERVATIVE_REPOSITORY_SOURCE_V1',
            'files':rows,'content_inventory_sha256':mb.sha(mb.canonical(rows)),'execution_entrypoints':['scripts/runtime_acceptance/main.cjs']}
        self.path=self.root/'binding.json';self.save()
    def save(self):
        self.path.write_bytes(mb.canonical(self.manifest));self.digest=mb.sha(self.path.read_bytes())
    def verify(self,**kw):
        return mb.verify(self.payload,self.path,kw.get('digest',self.digest),kw.get('subject',be.SUBJECT),kw.get('loaded',[]))
    def test_actual_bytes_match(self):
        self.assertEqual(self.verify()['files_verified'],4)
    def test_source_drift(self):
        (self.payload/'scripts/runtime_acceptance/main.cjs').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'CONTENT_DRIFT'):self.verify()
    def test_lock_drift(self):
        (self.payload/'pnpm-lock.yaml').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'CONTENT_DRIFT'):self.verify()
    def test_authority_schema_drift(self):
        (self.payload/'docs/authority.json').write_bytes(b'{}')
        with self.assertRaisesRegex(ValueError,'CONTENT_DRIFT'):self.verify()
    def test_added_code(self):
        (self.payload/'scripts/runtime_acceptance/extra.cjs').write_bytes(b'new')
        with self.assertRaisesRegex(ValueError,'EXTRA_MATERIAL'):self.verify()
    def test_missing_code(self):
        (self.payload/'scripts/runtime_acceptance/main.cjs').unlink()
        with self.assertRaisesRegex(ValueError,'MISSING_MATERIAL'):self.verify()
    def test_wrong_subject(self):
        with self.assertRaisesRegex(ValueError,'SUBJECT_MISMATCH'):self.verify(subject='b'*40)
    def test_untrusted_manifest(self):
        self.manifest['files'][0]['sha256']='0'*64;self.path.write_bytes(mb.canonical(self.manifest))
        with self.assertRaisesRegex(ValueError,'UNTRUSTED'):self.verify()
    def test_duplicate_entry(self):
        self.manifest['files'].append(self.manifest['files'][0]);self.save()
        with self.assertRaisesRegex(ValueError,'DUPLICATE'):self.verify()
    def test_path_escape(self):
        self.manifest['files'][0]['path']='../outside';self.save()
        with self.assertRaisesRegex(ValueError,'UNSAFE_PATH'):self.verify()
    def test_loaded_outside_release(self):
        out=self.root/'outside.cjs';out.write_bytes(b'x')
        with self.assertRaisesRegex(ValueError,'LOADED_PATH_OUTSIDE_RELEASE'):self.verify(loaded=[out])
    def test_loaded_actual_entry(self):
        r=self.verify(loaded=[self.payload/'scripts/runtime_acceptance/main.cjs'])
        self.assertEqual(r['loaded_paths_verified'],['scripts/runtime_acceptance/main.cjs']);self.assertFalse(r['execution_authorized'])
    def test_unbound_dependency_not_claimed_verified(self):
        node=self.payload/'node_modules';node.mkdir();(node/'example.js').write_bytes(b'not-bound')
        self.assertFalse(self.verify()['installed_dependencies_verified'])
        with self.assertRaisesRegex(ValueError,'LOADED_PATH_NOT_BOUND'):self.verify(loaded=[node/'example.js'])
    def test_offline_no_subprocess_or_network(self):
        with patch.object(socket,'socket',side_effect=AssertionError('network')),patch.object(subprocess,'run',side_effect=AssertionError('process')),patch.object(subprocess,'Popen',side_effect=AssertionError('process')):
            self.assertEqual(self.verify()['files_verified'],4)
    def test_does_not_overwrite(self):
        with self.assertRaises(FileExistsError):mb.write_new(self.path,b'no')
    def test_wrong_inventory_digest(self):
        self.manifest['content_inventory_sha256']='0'*64;self.save()
        with self.assertRaisesRegex(ValueError,'INVENTORY_INVALID'):self.verify()
    def test_case_collision(self):
        row=dict(self.manifest['files'][0]);row['path']=row['path'].upper();self.manifest['files'].append(row);self.save()
        with self.assertRaisesRegex(ValueError,'DUPLICATE_OR_CASE_COLLISION'):self.verify()
    def test_irrelevant_markdown_not_runtime(self):
        (self.payload/'docs/notes.md').write_bytes(b'unrelated')
        self.assertEqual(self.verify()['files_verified'],4)
    def test_original_evidence_tamper(self):
        self.manifest['files'][1]['category']='untrusted';self.save()
        with self.assertRaisesRegex(ValueError,'CATEGORY_MISMATCH'):self.verify()


class RealCandidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name)/'release'
        cls.repo=Path(__file__).resolve().parents[2]
        cls.summary=be.build(cls.repo,be.SUBJECT,cls.root)
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def test_exact_collections(self):
        self.assertEqual([self.summary[k] for k in ['qcp_checks','historical_checks','entry_checks','frozen_paths','frozen_unchanged']],[54,52,65,108,108])
        self.assertFalse(self.summary['overall_pass_issuance_allowed'])
    def test_raw_evidence_offline_review(self):
        with patch.object(subprocess,'run',side_effect=AssertionError('no Git')),patch.object(socket,'socket',side_effect=AssertionError('no network')):
            self.assertEqual(review(self.root,self.summary['adoption_manifest_sha256'])['status'],'EVIDENCE_MAPPING_BYTES_VERIFIED_ADOPTION_BLOCKED')
    def test_no_raw_no_pass(self):
        m=json.loads((self.root/'adoption-evidence-manifest.json').read_bytes())
        self.assertTrue(all(x['actual_conclusion']=='BLOCKED' for x in m['checks']))
        self.assertTrue(any(x['check_id']=='LEGACY_AM19_PERSISTENT_24T' and x['original_evidence'] for x in m['checks']))
    def test_manifest_promoted_pass_rejected(self):
        p=self.root/'adoption-evidence-manifest.json';old=p.read_bytes();m=json.loads(old);m['checks'][0]['actual_conclusion']='PASS';raw=mb.canonical(m)
        try:
            p.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'UNREVIEWED_CHECK_PROMOTION'):review(self.root,mb.sha(raw))
        finally:p.write_bytes(old)
    def test_original_commit_tamper_rejected(self):
        m=json.loads((self.root/'adoption-evidence-manifest.json').read_bytes());p=self.root/m['first_parent']['commits'][0]['raw_path'];old=p.read_bytes()
        try:
            p.write_bytes(old+b' ')
            with self.assertRaisesRegex(ValueError,'RAW_EVIDENCE_CHANGED'):review(self.root,self.summary['adoption_manifest_sha256'])
        finally:p.write_bytes(old)
    def test_cross_manifest_binding(self):
        p=self.root/'release-material-binding.json';old=p.read_bytes()
        try:
            p.write_bytes(old+b' ')
            with self.assertRaisesRegex(ValueError,'RAW_EVIDENCE_CHANGED'):review(self.root,self.summary['adoption_manifest_sha256'])
        finally:p.write_bytes(old)
    def test_no_output_reuse(self):
        with self.assertRaises(FileExistsError):be.build(self.repo,be.SUBJECT,self.root)
    def test_entrypoint_versions_bound(self):
        m=json.loads((self.root/'release-material-binding.json').read_bytes());rows={x['path']:x for x in m['files']}
        self.assertTrue(all(x in rows for x in be.ENTRYPOINTS))
        self.assertEqual(rows['pnpm-lock.yaml']['category'],'dependency_lock')
    def test_entry65_source_anchor_drift(self):
        src=(self.root/'payload'/be.ENTRY_TEST).read_bytes().replace(b'assert.equal(x.measureStartupMs',b'changedAssertion')
        with self.assertRaisesRegex(ValueError,'ENTRY_SOURCE_CHANGED'):be.entry65(src)


class FormalQcpPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.repo=self.root/'repo';self.repo.mkdir()
        subprocess.run(['git','init','-q'],cwd=self.repo,check=True);subprocess.run(['git','config','user.email','fixture@example.com'],cwd=self.repo,check=True);subprocess.run(['git','config','user.name','fixture'],cwd=self.repo,check=True)
        ids=[f'CHECK_{i:02d}' for i in range(49)]+sorted(be.FORMAL_ALLOWED_NA)+[be.FORMAL_ENGINEERING_CHECK];frozen=[]
        for i in range(108):
            rel=f'scripts/frozen/f{i:03d}.cjs';p=self.repo/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('// frozen\n');frozen.append(rel)
        q={'dependency_resolvers':{'V13_RUNTIME_SEMANTIC_CLOSURE':{'roots':[],'additional_exact_paths':frozen}},'checks':[{'check_id':x,'owner':'fixture','applicable_stages':['SUCCESSOR_SUBJECT_PRE_MERGE']} for x in ids]}
        p=self.repo/be.QCP;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(q)+'\n')
        for rel in be.ENTRYPOINTS:
            x=self.repo/rel;x.parent.mkdir(parents=True,exist_ok=True);x.write_text('// entry\n')
        subprocess.run(['git','add','.'],cwd=self.repo,check=True);subprocess.run(['git','commit','-qm','fixture'],cwd=self.repo,check=True);self.subject=subprocess.check_output(['git','rev-parse','HEAD'],cwd=self.repo,text=True).strip();self.zip=self.root/'qcp.zip';self._zip()
    def _zip(self,blockers=0,na=None):
        na=set(be.FORMAL_ALLOWED_NA if na is None else na);q=json.loads(subprocess.check_output(['git','show',self.subject+':'+be.QCP],cwd=self.repo));ids=[x['check_id'] for x in q['checks']]
        results=[{'check_id':cid,'status':'NOT_APPLICABLE' if cid in na else 'PASS','applicability':'NOT_APPLICABLE' if cid in na else 'REQUALIFY','reason_code':'STAGE_NOT_APPLICABLE' if cid in na else 'DIAGNOSTIC_PASS','dependency_digest':'sha256:'+'1'*64,'execution':'NOT_APPLICABLE' if cid in na else 'DIAGNOSTIC_COMMAND'} for cid in ids]
        counts={'total_checks':55,'pass':50,'fail':0,'not_applicable':5,'carry_forward':0,'required':20,'requalify':30,'proof_bound_preserved_required':0,'unknown':0,'forbidden':0,'authority_errors':0,'unknown_changed_paths':0,'blocker_count':blockers}
        docs={'MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json':{'status':'PASS'},'MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json':{'status':'PASS','head_sha':self.subject,'failures':[]},'MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json':{'status':'FAIL','head_sha':self.subject},'MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json':{'status':'PASS','head_sha':self.subject},'MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json':{'status':'PASS','all_durable_anchor_refs_resolvable':True,'all_live_refs_match_when_present':True,'all_requalification_live_refs_match':True},'MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json':{'status':'PASS','head_sha':self.subject,'unknown_changed_paths':[],'authority_errors':[],'resolver_errors':[]},'MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json':{'status':'PASS','stage':'SUCCESSOR_SUBJECT_PRE_MERGE','generation':'v13','head_sha':self.subject,'counts':counts,'results':results,'blockers':[] if blockers==0 else [{'x':1}]},'MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json':{'status':'PASS','hop_count':1,'first_parent_chain_complete':True,'merge_tree_equivalence_all':True,'candidate_to_merge_zero_delta_all':True,'runtime_mutation':False,'database_mutation':False,'production_runtime_start_authorized':False,'production_owner_activation_authorized':False,'formal_v5_authorized':False,'a0_authorized':False,'o00_o23_authorized':False}}
        with zipfile.ZipFile(self.zip,'w') as z:
            for name,obj in docs.items():z.writestr(name,json.dumps(obj))
    def test_final_package_success(self):
        out=self.root/'out';r=be.finalize_qcp_adoption(self.repo,self.subject,self.zip,out);self.assertEqual([r['formal_checks'],r['frozen_paths']],[54,108]);c=json.loads((out/'adoption-candidate.json').read_text());self.assertEqual(len(c['checks']),54);self.assertEqual(sum(x['result']=='NOT_APPLICABLE' for x in c['checks']),5);self.assertTrue((out/'release-material-binding.json').is_file());self.assertFalse(r['execution_authorized'])
    def test_blocker_rejected(self):
        self._zip(blockers=1)
        with self.assertRaisesRegex(ValueError,'QCP_ALL_BLOCKERS_NOT_PASS'):be.finalize_qcp_adoption(self.repo,self.subject,self.zip,self.root/'bad')
    def test_na_set_rejected(self):
        wrong=set(be.FORMAL_ALLOWED_NA);wrong.remove(next(iter(wrong)));wrong.add('CHECK_00');self._zip(na=wrong)
        with self.assertRaisesRegex(ValueError,'QCP_NOT_APPLICABLE_SET_CHANGED'):be.finalize_qcp_adoption(self.repo,self.subject,self.zip,self.root/'bad2')

class MergedQcpPackageTests(unittest.TestCase):
    _zip=FormalQcpPackageTests._zip
    def git(self,*args):
        return subprocess.check_output(['git',*args],cwd=self.repo,text=True).strip()
    def setUp(self):
        FormalQcpPackageTests.setUp(self)
        self.base=self.subject
        (self.repo/'scripts/candidate.cjs').write_text('// candidate\n')
        self.git('add','.');self.git('commit','-qm','candidate');self.subject=self.git('rev-parse','HEAD');self._zip()
        tree=self.git('rev-parse','HEAD^{tree}')
        self.merged=self.git('commit-tree',tree,'-p',self.base,'-p',self.subject,'-m','adopt candidate')
        self.git('update-ref','refs/remotes/origin/main',self.merged)
        with zipfile.ZipFile(self.zip) as z:self.docs={n:json.loads(z.read(n)) for n in z.namelist()}
        for name in ['MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json','MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json']:
            self.docs[name].update(base_sha=self.base,stage='SUCCESSOR_SUBJECT_PRE_MERGE',generation='v13')
        self.docs['MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json'].update(admitted_base_sha=self.base,current_protected_main_sha=self.base,current_protected_main_match=True,baseline_qualification_carry_forward_authorized=False)
        self.record={'schema':'MCFT_CAP09_MERGED_QCP_SOURCE_V1','repository':'liyongshang44-max/GEOX','observed_main_sha':self.merged,
          'pull_request':{'number':1,'merged':True,'base_ref':'main','base_sha':self.base,'head_sha':self.subject,'merge_commit_sha':self.merged},
          'workflow_run':{'id':2,'repository':'liyongshang44-max/GEOX','event':'pull_request','status':'completed','conclusion':'success','head_sha':self.subject,'path':'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml'},
          'artifact':{'id':3,'name':'mcft-cap09-qualification-control-plane-'+self.subject,'expired':False,'workflow_run':{'id':2,'head_sha':self.subject}}}
        self.repack()
    def repack(self):
        with zipfile.ZipFile(self.zip,'w') as z:
            for n,obj in self.docs.items():z.writestr(n,json.dumps(obj))
        self.record['artifact']['digest']='sha256:'+be.sha(self.zip.read_bytes())
    def finalize(self):
        return be.finalize_qcp_adoption(self.repo,self.merged,self.zip,self.root/'merged-out',self.record)
    def test_zero_delta_merge_preserves_raw_reports(self):
        before=self.zip.read_bytes();result=self.finalize();out=self.root/'merged-out'
        self.assertEqual(result['subject_sha'],self.merged);self.assertEqual(result['qcp_execution_subject_sha'],self.subject)
        self.assertFalse(result['qcp_executed_at_subject']);self.assertFalse(result['execution_authorized'])
        self.assertEqual((out/'source-qcp-artifact.zip').read_bytes(),before)
        with zipfile.ZipFile(self.zip) as z:
            for n in z.namelist():self.assertEqual((out/'raw'/n).read_bytes(),z.read(n))
        proof=json.loads((out/'qcp-proof.json').read_text());self.assertEqual(proof['first_parent_hop_count'],2)
        candidate=json.loads((out/'adoption-candidate.json').read_text())
        for row in candidate['checks']:
            evidence=json.loads((out/row['evidence_ref']).read_text());self.assertEqual(evidence['subject_sha'],self.merged)
            self.assertEqual(evidence['qcp_execution_subject_sha'],self.subject)
            self.assertEqual(evidence['merge_derivation_sha256'],be.sha((out/'merge-derivation.json').read_bytes()))
    def test_default_exact_subject_check_remains_strict(self):
        with self.assertRaisesRegex(ValueError,'QCP_SUBJECT_MISMATCH'):be.finalize_qcp_adoption(self.repo,self.merged,self.zip,self.root/'strict-out')
    def test_renaming_old_heads_is_rejected(self):
        self.docs['MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json']['head_sha']=self.merged;self.repack()
        with self.assertRaisesRegex(ValueError,'QCP_SUBJECT_MISMATCH'):self.finalize()
    def test_changed_merge_tree_rejected(self):
        (self.repo/'scripts/candidate.cjs').write_text('// changed at merge\n');self.git('add','.')
        self.merged=self.git('commit-tree',self.git('write-tree'),'-p',self.base,'-p',self.subject,'-m','changed merge')
        self.record['pull_request']['merge_commit_sha']=self.merged;self.record['observed_main_sha']=self.merged;self.git('update-ref','refs/remotes/origin/main',self.merged)
        with self.assertRaisesRegex(ValueError,'MERGE_SOURCE_TREE_CHANGED'):self.finalize()
    def test_unmerged_pr_rejected(self):
        self.record['pull_request']['merged']=False
        with self.assertRaisesRegex(ValueError,'MERGE_PR_NOT_ADOPTED'):self.finalize()
    def test_wrong_parent_rejected(self):
        self.record['pull_request']['base_sha']=self.subject
        with self.assertRaisesRegex(ValueError,'MERGE_PARENT_BINDING_MISMATCH'):self.finalize()
    def test_source_run_failure_rejected(self):
        self.record['workflow_run']['conclusion']='failure'
        with self.assertRaisesRegex(ValueError,'MERGE_SOURCE_RUN_NOT_SUCCESS'):self.finalize()
    def test_wrong_workflow_rejected(self):
        self.record['workflow_run']['path']='other.yml'
        with self.assertRaisesRegex(ValueError,'MERGE_SOURCE_WORKFLOW_MISMATCH'):self.finalize()
    def test_artifact_digest_rejected(self):
        self.record['artifact']['digest']='sha256:'+'0'*64
        with self.assertRaisesRegex(ValueError,'MERGE_ARTIFACT_DIGEST_MISMATCH'):self.finalize()
    def test_artifact_run_rejected(self):
        self.record['artifact']['workflow_run']['id']=99
        with self.assertRaisesRegex(ValueError,'MERGE_ARTIFACT_RUN_MISMATCH'):self.finalize()
    def test_unknown_main_snapshot_rejected(self):
        self.record['observed_main_sha']=self.subject
        with self.assertRaisesRegex(ValueError,'MERGE_MAIN_SNAPSHOT_MISMATCH'):self.finalize()
    def test_unadopted_merge_rejected(self):
        self.git('update-ref','refs/remotes/origin/main',self.base);self.record['observed_main_sha']=self.base
        with self.assertRaisesRegex(ValueError,'MERGE_SUBJECT_NOT_ADOPTED_FIRST_PARENT'):self.finalize()
    def test_source_qcp_base_mismatch_rejected(self):
        self.docs['MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json']['base_sha']=self.subject;self.repack()
        with self.assertRaisesRegex(ValueError,'MERGE_QCP_BASE_MISMATCH'):self.finalize()
    def test_first_parent_proof_mismatch_rejected(self):
        self.docs['MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json']['admitted_base_sha']=self.subject;self.repack()
        with self.assertRaisesRegex(ValueError,'MERGE_FIRST_PARENT_PROOF_BASE_MISMATCH'):self.finalize()
    def test_source_blocker_still_rejected(self):
        self.docs['MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json']['status']='FAIL';self.repack()
        with self.assertRaisesRegex(ValueError,'QCP_ALL_BLOCKERS_NOT_PASS'):self.finalize()
    def test_no_overwrite(self):
        self.finalize()
        with self.assertRaisesRegex(ValueError,'OUTPUT_EXISTS'):self.finalize()

if __name__=='__main__':unittest.main()
