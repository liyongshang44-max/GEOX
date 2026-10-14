import contextlib
import hashlib
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
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

if __name__=='__main__':unittest.main()
