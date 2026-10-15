"""Adoption-time read-only Git-object export. Never runs legacy QCP or a provider."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile
from material_binding import canonical, category, ensure, no_links, safe_relative, sha, verify, write_new, SCHEMA

SUBJECT = 'a44b294f684027c0d1dd7a28c3735442fca736a4'
HISTORICAL = '0d62e7fa4f0905151b38c25964b48d672187e6d3'
FROZEN = '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a'
QCP = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json'
REGISTRY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json'
ENTRY_TEST = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs'
ENTRYPOINTS = ['scripts/runtime_acceptance/' + x for x in [
    'MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1', 'RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs',
    'MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs', 'RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts',
    'RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts', 'MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs',
    'AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts']]

class GitObjects:
    def __init__(self, repo):
        self.repo = str(Path(repo).resolve())
    def git(self, *args):
        return subprocess.run(['git', '-C', self.repo, *args], check=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=120).stdout
    def blob(self, subject, path):
        safe_relative(path)
        return self.git('show', subject + ':' + path)
    def tree(self, subject):
        rows = {}
        for item in self.git('ls-tree', '-rz', subject).split(b'\0'):
            if not item: continue
            meta, name = item.split(b'\t', 1); mode, kind, oid = meta.decode().split()
            rel = name.decode(); safe_relative(rel)
            rows[rel] = {'mode':mode,'kind':kind,'git_blob_sha':oid}
        return rows
    def blobs(self, rows):
        # Bounded local batch reads, no checkout, fetch, clone or validator execution.
        p = subprocess.Popen(['git','-C',self.repo,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
        try:
            for rel, row in rows.items():
                ensure(row['kind']=='blob' and row['mode'] in ('100644','100755'), 'UNSUPPORTED_TREE_ENTRY')
                p.stdin.write((row['git_blob_sha']+'\n').encode()); p.stdin.flush()
                header = p.stdout.readline().decode().split()
                ensure(len(header)==3 and header[1]=='blob', 'GIT_BLOB_MISSING')
                n=int(header[2]); data=p.stdout.read(n); ensure(len(data)==n and p.stdout.read(1)==b'\n','GIT_BATCH_TRUNCATED')
                ensure(hashlib.sha1(b'blob '+str(n).encode()+b'\0'+data).hexdigest()==row['git_blob_sha'],'GIT_BLOB_MISMATCH')
                yield rel,data
        finally:
            p.stdin.close(); p.stdout.close(); p.wait(timeout=10)

def source_record(path, data, oid=None):
    return {'path':path,'git_blob_sha':oid or hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),
            'sha256':sha(data),'size_bytes':len(data)}

def closure(files, roots):
    patterns = [r'(?:import|export)\s+(?:type\s+)?(?:[^"\']*?\s+from\s+)?["\']([^"\']+)["\']',
                r'require\(\s*["\']([^"\']+)["\']\s*\)', r'import\(\s*["\']([^"\']+)["\']\s*\)']
    import posixpath
    seen=set(); pending=list(roots); missing=[]
    while pending:
        rel=pending.pop()
        if rel in seen: continue
        if rel not in files: missing.append(rel); continue
        seen.add(rel)
        if not rel.endswith(('.ts','.tsx','.js','.cjs','.mjs')): continue
        text=files[rel].decode('utf8')
        for spec in set(s for pattern in patterns for s in re.findall(pattern,text)):
            if not spec.startswith('.'): continue
            base=posixpath.normpath(posixpath.join(posixpath.dirname(rel),spec)); ext=posixpath.splitext(base)[1]
            candidates=[base]
            if ext in ('.js','.mjs','.cjs'):
                candidates += [base[:-len(ext)]+e for e in ('.ts','.tsx','.js','.cjs','.mjs','.json')]
            elif not ext:
                candidates += [base+e for e in ('.ts','.tsx','.js','.cjs','.mjs','.json','/index.ts','/index.tsx','/index.js','/index.cjs')]
            target=next((p for p in candidates if p in files),None)
            if target: pending.append(target)
            else: missing.append(rel+' -> '+spec)
    ensure(not missing,'FROZEN_IMPORT_MISSING')
    return seen

def entry65(source):
    # Explicit expansion of the fixed source's count++ / negative() cases.
    # This is an assertion map, not an execution or a claim of historical PASS.
    groups = [
      ('startup_measurement',6,['valid','invalid','future']),
      ('v2_historical_assertions',9,['producer','timing','aggregate']),
      ('source_clean_guard',31,['clean','unstaged','staged','untracked']),
      ('frozen_closure',41,['108_paths','reject_generated_graph']),
      ('legacy_arm',46,['disabled']),('adopted_isolated_arm',54,['valid']),
      ('adopted_arm_rejections',55,['production_recovery','image_cutover','formal','a0','o00','reset','mode','run_id','subject_binding','expiry','six_hour_lead']),
      ('synthetic_arm',101,['valid']),
      ('synthetic_arm_rejections',102,['armed','mode','adopted_base','subject_binding','expiry','six_hour_lead','run_id','production_recovery','image_cutover','formal','a0','o00','reset']),
      ('host_context',105,['main','clean','ancestor','frozen','ci','platform']),
      ('isolated_targets',111,['valid']),
      ('isolated_target_rejections',112,['production_database','query_host','same_database','endpoint','bucket','first_base','output_root']),
      ('recovery_arm',116,['valid']),('recovery_reconcile',117,['valid']),
      ('recovery_rejections',120,['receipt_digest','owner','phase','formal','image']),
      ('recovery_stub',137,['retained_history']),('recovery_boundary',143,['disabled','existing_output']),
      ('ci_entry_rejections',147,['recovery','qualification'])]
    # Line anchors below are resolved from actual literals, not trusted fixed line numbers.
    markers = ['assert.equal(x.measureStartupMs','for (const file of','assert.equal(x.sourceWorktreeClean(fakeGit(gitClean)),',
       'assert.equal(readOnlyV13.length','assert.equal(legacyArm.armed','assert.equal(x.validateArm(adoptedIsoArm',
       'for(const [key,value]','assert.equal(x.validateArm(arm','for (const [k, v] of [["armed"',
       'for (const [k, v] of [["main"','assert.equal(x.isolatedTargets','for (const [k, v] of [["DATABASE_URL"',
       'x.validateArm(a, a.mode','const reconciled =','negative(() => recovery.reconcile(failed',
       'const r = recovery.execute','negative(() => recovery.execute({...a','for (const [file, args]']
    text=source.decode(); lines=text.splitlines(); result=[]
    ensure(len(groups)==len(markers),'ENTRY_MAPPING_INVALID')
    for (group,_,cases),marker in zip(groups,markers):
        matches=[i+1 for i,line in enumerate(lines) if marker in line]
        ensure(len(matches)==1,'ENTRY_SOURCE_CHANGED')
        for case in cases:
            result.append({'check_id':'ENTRY65/'+group+'/'+case,'check_revision':sha(source),'source_path':ENTRY_TEST,
                'source_line':matches[0],'source_anchor':marker,'applicability':'DEFAULT_NO_COMPILE_MODE',
                'original_evidence':None,'evidence_sha256':None,'actual_conclusion':'BLOCKED',
                'reason':'No original per-case run receipt supplied; mapping is not a test result.'})
    ensure(len(result)==65,'ENTRY_65_MEMBERSHIP_CHANGED')
    return result

def records_by_check(registry):
    found={}
    def walk(v, pointer=''):
        if isinstance(v,dict):
            if 'check_id' in v and ('evidence_id' in v or 'run_id' in v):
                found.setdefault(v['check_id'],[]).append({'registry_pointer':pointer,'record':v,
                    'record_sha256':sha(canonical(v)),'original_artifact_bytes_verified':False})
            for k,x in v.items(): walk(x,pointer+'/'+k.replace('~','~0').replace('/','~1'))
        elif isinstance(v,list):
            for i,x in enumerate(v): walk(x,pointer+'/'+str(i))
    walk(registry); return found

def ci_capture(folder, subject, out):
    if folder is None: return {}, [], []
    folder=no_links(folder); meta=json.loads((folder/'capture.json').read_bytes())
    ensure(meta['subject_commit_sha']==subject,'CI_SUBJECT_MISMATCH')
    safe_relative(meta['log_file'])
    log=(folder/meta['log_file']).read_bytes()
    retained=[]
    for name,data in [('capture.json',(folder/'capture.json').read_bytes()),(meta['log_file'],log)]:
        rel='evidence/raw/github/'+name;write_new(out/rel,data);retained.append({'path':rel,'sha256':sha(data),'size_bytes':len(data)})
    text=re.sub(r'^\d{4}-\d\d-\d\dT\S+Z ', '',log.decode(),flags=re.M);decoder=json.JSONDecoder(); candidates=[]
    for match in re.finditer(r'^\{',text,re.M):
        try: value,_=decoder.raw_decode(text[match.start():])
        except ValueError: continue
        if isinstance(value,dict) and value.get('head_sha')==subject and 'current_decisions' in value: candidates.append(value)
    ensure(len(candidates)==1,'CI_STDOUT_AMBIGUOUS_OR_MISSING');value=candidates[0]
    rel='evidence/derived-cp2-stdout.json';data=canonical(value)+b'\n';write_new(out/rel,data)
    retained.append({'path':rel,'sha256':sha(data),'size_bytes':len(data),'derived_from':retained[1]['path'],
                     'derivation':'remove timestamp prefixes and parse exact subject JSON; not original artifact bytes'})
    decisions={x['check_id']:x for x in value['current_decisions']}
    return decisions,retained,value.get('failures',[])

def build(repo, subject, output, capture=None):
    ensure(subject==SUBJECT,'UNREVIEWED_CANDIDATE_SUBJECT')
    out=Path(output).absolute();no_links(out.parent);out.mkdir() # exclusive, preserve partial outputs on failure
    git=GitObjects(repo);tree=git.tree(subject)
    selected={p:r for p,r in tree.items() if category(p) is not None or p.startswith('.github/workflows/')}
    files=dict(git.blobs(selected));q=json.loads(files[QCP]);registry=json.loads(files[REGISTRY])
    ensure(len(q['checks'])==54 and len({x['check_id'] for x in q['checks']})==54,'CURRENT_QCP_CHANGED')
    historical_bytes=git.blob(HISTORICAL,QCP);historical=json.loads(historical_bytes)
    ensure(len(historical['checks'])==52,'HISTORICAL_52_CHANGED')
    decisions,ci_files,ci_failures=ci_capture(capture,subject,out)
    if decisions: ensure(set(decisions)=={x['check_id'] for x in q['checks']},'CI_CHECK_SET_MISMATCH')
    source_records={p:source_record(p,b,tree[p]['git_blob_sha']) for p,b in files.items()}
    refs=records_by_check(registry)
    checks=[]
    for index,check in enumerate(q['checks']):
        sources=set(check['authority_refs'])
        sources.update(re.findall(r'(?:scripts|apps|packages)/[^\s"\']+\.(?:cjs|js|ts|json)',check.get('diagnostic_command') or ''))
        if check.get('execution_workflow'): sources.add(check['execution_workflow'])
        decision=decisions.get(check['check_id'])
        checks.append({'check_id':check['check_id'],'check_revision':sha(canonical(check)),
            'definition':check,'definition_pointer':'/checks/'+str(index),'definition_document':source_records[QCP],
            'implementation_sources':[source_records[p] for p in sorted(sources) if p in source_records],
            'unresolved_source_refs':[p for p in sorted(sources) if p not in source_records],
            'applicability':{'declared_stages':check['applicable_stages'],'planner_decision':decision,
                'adoption_adjudication':'BLOCKED','reason':'CP2 plan is evidence, not an ALL_BLOCKERS adoption result.'},
            'original_evidence':refs.get(check['check_id'],[]),'evidence_registry':source_records[REGISTRY],
            'actual_conclusion':'BLOCKED','reason':'Raw artifact and/or exact-subject inheritance/adoption adjudication incomplete; no PASS inferred from registry or CI job status.'})
    frozen_spec=q['dependency_resolvers']['V13_RUNTIME_SEMANTIC_CLOSURE']
    frozen_paths=sorted(closure(files,frozen_spec['roots'])|set(frozen_spec['additional_exact_paths']))
    ensure(len(frozen_paths)==108,'FROZEN_108_CHANGED');oldtree=git.tree(FROZEN)
    frozen_rows=[]
    for p in frozen_paths:
        ensure(p in oldtree,'FROZEN_SOURCE_MISSING')
        frozen_rows.append({**source_records[p],'frozen_subject_sha':FROZEN,'frozen_git_blob_sha':oldtree[p]['git_blob_sha'],
            'bytes_unchanged':tree[p]['git_blob_sha']==oldtree[p]['git_blob_sha'],
            'actual_conclusion':'PASS' if tree[p]['git_blob_sha']==oldtree[p]['git_blob_sha'] else 'FAIL',
            'scope':'GIT_OBJECT_BYTE_IDENTITY_ONLY_NOT_FULL_HISTORICAL_QUALIFICATION'})
    chain=git.git('rev-list','--first-parent',subject).decode().splitlines()
    ensure(HISTORICAL in chain,'HISTORICAL_FIRST_PARENT_MISSING');chain=chain[:chain.index(HISTORICAL)+1]
    commit_records=[]
    for commit in chain:
        raw=git.git('cat-file','commit',commit);rel='evidence/raw/git-commits/'+commit+'.txt';write_new(out/rel,raw)
        headers=raw.split(b'\n\n',1)[0].decode().splitlines()
        commit_records.append({'commit_sha':commit,'tree':next(x[5:] for x in headers if x.startswith('tree ')),
            'parents':[x[7:] for x in headers if x.startswith('parent ')],'raw_path':rel,'raw_sha256':sha(raw)})
    anchor=commit_records[-1];expected_parent='c9e027b832d1e25a20384d4853ed5564ed405fd4'
    parent_tree=git.git('rev-parse',anchor['parents'][1]+'^{tree}').decode().strip() if len(anchor['parents'])==2 else None
    second_parent=anchor['parents'][1]
    second_raw=git.git('cat-file','commit',second_parent)
    second_rel='evidence/raw/git-commits/'+second_parent+'.txt';write_new(out/second_rel,second_raw)
    second_record={'commit_sha':second_parent,'raw_path':second_rel,'raw_sha256':sha(second_raw),'tree':parent_tree}
    lineage={'historical_second_parent':second_record,'source_verifier':source_records['scripts/governance_acceptance/MCFT_CAP09_DISABLED_RETRY_HISTORICAL_INHERITANCE_V1.cjs'],
        'commits':commit_records,'historical_two_parents':len(anchor['parents'])==2,'historical_first_parent_matches':anchor['parents'][0]==expected_parent,
        'historical_merge_tree_matches_second_parent':anchor['tree']==parent_tree,'full_historical_assertions_result':'BLOCKED',
        'reason':'Raw lineage exported once at adoption; original recursive verifier not executed or replaced.'}
    old_checks={x['check_id']:x for x in historical['checks']};current_ids={x['check_id'] for x in q['checks']}
    ensure(set(old_checks)<=current_ids,'HISTORICAL_CHECK_REMOVED')
    history_mapping=[{'check_id':k,'historical_revision':sha(canonical(v)),
        'current_revision':next(x['check_revision'] for x in checks if x['check_id']==k),
        'historical_definition':v,'equivalence_result':'BLOCKED','reason':'Identity mapping present; semantic carry-forward requires adjudication.'} for k,v in old_checks.items()]
    write_new(out/'evidence/raw/historical-qcp-52.json',historical_bytes)
    manifest={'schema_version':'MCFT_CAP09_ADOPTION_EVIDENCE_MANIFEST_V1','subject_commit_sha':subject,'status':'ADOPTION_INCOMPLETE',
        'checks':checks,'historical_52':{'subject_commit_sha':HISTORICAL,'raw_sha256':sha(historical_bytes),'raw_path':'evidence/raw/historical-qcp-52.json','mapping':history_mapping},
        'entry_65':{'source':source_records[ENTRY_TEST],'mode':'MCFT_CURRENT_ENTRY_COMPILE_TEST unset; optional compile mode adds 5 cases','checks':entry65(files[ENTRY_TEST])},
        'frozen_108':frozen_rows,'first_parent':lineage,'ci_raw_and_derived_evidence':ci_files,'observed_ci_failures':ci_failures,
        'adoption_blockers':['REQUIRED_CHECK_ADJUDICATION_INCOMPLETE','HISTORICAL_EQUIVALENCE_NOT_ADOPTED','ORIGINAL_ARTIFACT_BYTES_NOT_FULLY_COLLECTED',
            'INSTALLED_DEPENDENCY_CONTENT_NOT_BOUND','WINDOWS_HOST_READBACK_PENDING'],
        'overall_pass_issuance_allowed':False,'execution_authorized':False,'production_authorized':False}
    # Preserve raw registry, definitions and every referenced implementation/workflow.
    evidence_paths={QCP,REGISTRY,ENTRY_TEST,lineage['source_verifier']['path']}
    for check in checks: evidence_paths.update(x['path'] for x in check['implementation_sources'])
    for p in sorted(evidence_paths):write_new(out/'evidence/raw/repository'/p,files[p])
    payload_rows=[]
    for p,b in sorted(files.items()):
        kind=category(p)
        if kind is None:continue
        write_new(out/'payload'/p,b)
        payload_rows.append({**source_records[p],'mode':tree[p]['mode'],'category':kind})
    binding={'schema_version':SCHEMA,'subject_commit_sha':subject,'source_tree_git_sha':git.git('rev-parse',subject+'^{tree}').decode().strip(),
        'scope_version':'CONSERVATIVE_REPOSITORY_SOURCE_V1','scope_description':'All tracked apps/packages/scripts/infra/config/schemas/tools files; all docs JSON; root toolchain configs. Conservative superset, not claimed minimal runtime closure.',
        'files':payload_rows,'content_inventory_sha256':sha(canonical(payload_rows)),'execution_entrypoints':ENTRYPOINTS,
        'category_counts':dict(Counter(x['category'] for x in payload_rows)),
        'evidence_boundary':'evidence/ is adoption proof material. payload/ contains executable source and JSON read by existing code; docs JSON are dual-role inputs and cannot be excluded merely because they are evidence.',
        'unbound_materials':[{'kind':k,'status':'BLOCKED'} for k in ['installed_node_modules_bytes','node_binary_and_native_libraries','python_and_grib_decoder_toolchain','effective_secret_free_host_config','host_acl_and_resource_identity','actual_module_load_trace']],
        'execution_authorized':False,'production_authorized':False}
    binding_bytes=canonical(binding)+b'\n'
    manifest['release_material_binding_sha256']=sha(binding_bytes)
    manifest['generator_sources']=[{'path':n,'sha256':sha((Path(__file__).parent/n).read_bytes())} for n in ['build_evidence.py','material_binding.py','evidence_review.py']]
    manifest_bytes=canonical(manifest)+b'\n'
    write_new(out/'adoption-evidence-manifest.json',manifest_bytes);write_new(out/'release-material-binding.json',binding_bytes)
    result=verify(out/'payload',out/'release-material-binding.json',sha(binding_bytes),subject,[out/'payload'/p for p in ENTRYPOINTS])
    summary={'subject_commit_sha':subject,'adoption_manifest_sha256':sha(manifest_bytes),'release_binding_sha256':sha(binding_bytes),
        'qcp_checks':len(checks),'qcp_adoption_blocked':len(checks),'historical_checks':len(history_mapping),'entry_checks':len(manifest['entry_65']['checks']),
        'frozen_paths':len(frozen_rows),'frozen_unchanged':sum(x['bytes_unchanged'] for x in frozen_rows),'first_parent_commits':len(chain),
        'release_files':len(payload_rows),'release_verification':result,'overall_pass_issuance_allowed':False,'execution_authorized':False,'production_authorized':False}
    write_new(out/'summary.json',canonical(summary)+b'\n');return summary


FORMAL_ENGINEERING_CHECK='A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY'
FORMAL_ALLOWED_NA={'V13_PRODUCER_DRIVEN_QUALIFICATION','END_TO_END_EVIDENCE_SUPPLY_DEADLINE','EXACT_ONE_PRODUCTION_OWNER','FORMAL_V5_ACTIVATION','V13_RUNTIME_HARNESS_RESOLVER_MIGRATION'}
FORMAL_QCP_MEMBERS={
 'MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json','MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json',
 'MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json','MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json',
 'MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json','MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json',
 'MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json','MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json'}

def finalize_qcp_adoption(repo,subject,artifact_zip,output):
    ensure(re.fullmatch(r'[0-9a-f]{40}',subject) is not None,'SUBJECT_INVALID')
    out=Path(output).resolve();ensure(not out.exists(),'OUTPUT_EXISTS');out.mkdir(parents=True)
    artifact_bytes=Path(artifact_zip).read_bytes();artifact_sha=sha(artifact_bytes)
    with zipfile.ZipFile(artifact_zip) as z:
        ensure(set(z.namelist())==FORMAL_QCP_MEMBERS,'QCP_ARTIFACT_MEMBER_SET_CHANGED')
        raw={n:z.read(n) for n in z.namelist()}
    docs={n:json.loads(b) for n,b in raw.items()}
    cp2=docs['MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json'];plan=docs['MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json']
    blockers=docs['MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json'];immutable=docs['MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json']
    first=docs['MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json'];semantics=docs['MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json']
    for obj,name in [(cp2,'CP2'),(plan,'PLAN'),(blockers,'ALL_BLOCKERS')]:ensure(obj.get('head_sha')==subject,'QCP_SUBJECT_MISMATCH:'+name)
    ensure(semantics.get('status')=='PASS','QCP_SEMANTICS_NOT_PASS');ensure(cp2.get('status')=='PASS' and cp2.get('failures')==[],'QCP_CP2_NOT_PASS')
    ensure(plan.get('status')=='PASS' and plan.get('unknown_changed_paths')==[] and plan.get('authority_errors')==[] and plan.get('resolver_errors')==[],'QCP_PLAN_NOT_CLOSED')
    counts=blockers.get('counts') or {};ensure(blockers.get('status')=='PASS' and blockers.get('blockers')==[],'QCP_ALL_BLOCKERS_NOT_PASS')
    ensure(counts.get('total_checks')==55 and counts.get('pass')==50 and counts.get('not_applicable')==5,'QCP_RESULT_CARDINALITY_INVALID')
    for k in ['fail','unknown','forbidden','authority_errors','unknown_changed_paths','blocker_count']:ensure(counts.get(k)==0,'QCP_BLOCKER_COUNT_NONZERO:'+k)
    ensure(immutable.get('status')=='PASS' and immutable.get('all_durable_anchor_refs_resolvable') is True and immutable.get('all_live_refs_match_when_present') is True and immutable.get('all_requalification_live_refs_match') is True,'QCP_IMMUTABLE_EVIDENCE_INCOMPLETE')
    ensure(first.get('status')=='PASS' and first.get('first_parent_chain_complete') is True and first.get('merge_tree_equivalence_all') is True and first.get('candidate_to_merge_zero_delta_all') is True,'QCP_FIRST_PARENT_NOT_PASS')
    for k in ['runtime_mutation','database_mutation','production_runtime_start_authorized','production_owner_activation_authorized','formal_v5_authorized','a0_authorized','o00_o23_authorized']:ensure(first.get(k) is False,'QCP_AUTHORITY_ESCALATION:'+k)

    git=GitObjects(repo);tree=git.tree(subject);selected={p:r for p,r in tree.items() if category(p) is not None or p.startswith('.github/workflows/')};files=dict(git.blobs(selected))
    q=json.loads(files[QCP]);checks=q.get('checks') or [];ensure(len(checks)==55 and len({x['check_id'] for x in checks})==55,'LOCAL_QCP_CHECK_SET_INVALID')
    by_id={x['check_id']:x for x in checks};ensure(FORMAL_ENGINEERING_CHECK in by_id,'FORMAL_ENGINEERING_CHECK_MISSING');formal=[x for x in checks if x['check_id']!=FORMAL_ENGINEERING_CHECK];ensure(len(formal)==54,'FORMAL_CHECK_COUNT_INVALID')
    results=blockers.get('results') or [];ensure(len(results)==55 and len({x.get('check_id') for x in results})==55,'QCP_RESULTS_INVALID');result_by={x['check_id']:x for x in results};ensure(set(result_by)==set(by_id),'QCP_RESULT_MEMBERSHIP_MISMATCH')
    ensure(result_by[FORMAL_ENGINEERING_CHECK].get('status')=='PASS','FORMAL_ENGINEERING_CHECK_NOT_PASS')
    observed_na={x['check_id'] for x in results if x.get('status')=='NOT_APPLICABLE'};ensure(observed_na==FORMAL_ALLOWED_NA,'QCP_NOT_APPLICABLE_SET_CHANGED')
    for cid in FORMAL_ALLOWED_NA:ensure(result_by[cid].get('reason_code')=='STAGE_NOT_APPLICABLE','QCP_NA_REASON_CHANGED:'+cid)
    frozen=q['dependency_resolvers']['V13_RUNTIME_SEMANTIC_CLOSURE'];frozen_paths=sorted(closure(files,frozen['roots'])|set(frozen['additional_exact_paths']));ensure(len(frozen_paths)==108,'FROZEN_108_CHANGED')

    rows=[]
    for index,definition in enumerate(formal,1):
        cid=definition['check_id'];decision=result_by[cid];status=decision.get('status');ensure(status in ('PASS','NOT_APPLICABLE'),'FORMAL_CHECK_NOT_CLOSED:'+cid)
        revision=sha(canonical(definition));rel=f'checks/{index:02d}-{cid}.json';ev={'schema':'MCFT_CAP09_ADOPTION_CHECK_EVIDENCE_V1','subject_sha':subject,'check_id':cid,'revision':revision,'result':status,'reason':decision.get('reason_code') or status,'qcp_applicability':decision.get('applicability'),'qcp_reason_code':decision.get('reason_code'),'dependency_digest':decision.get('dependency_digest'),'qcp_artifact_sha256':artifact_sha}
        data=canonical(ev)+b'\n';write_new(out/rel,data);rows.append({'check_id':cid,'revision':revision,'result':status,'reason':ev['reason'],'evidence_ref':rel,'sha256':sha(data)})
    proof={'schema':'MCFT_CAP09_FINAL_QCP_ADOPTION_PROOF_V1','subject_sha':subject,'status':'PASS','stage':blockers.get('stage'),'generation':blockers.get('generation'),'total_checks':55,'adoption_checks':54,'blocker_count':0,'not_applicable_ids':sorted(FORMAL_ALLOWED_NA),'engineering_check_id':FORMAL_ENGINEERING_CHECK,'engineering_check_status':'PASS','qcp_artifact_sha256':artifact_sha,'qcp_artifact_members':{n:sha(raw[n]) for n in sorted(raw)},'immutable_evidence_status':'PASS','first_parent_status':'PASS','first_parent_hop_count':first.get('hop_count'),'frozen_paths':108,'runtime_mutation':False,'execution_authorized':False,'production_authorized':False}
    proof_bytes=canonical(proof)+b'\n';write_new(out/'qcp-proof.json',proof_bytes)
    for n in sorted(raw):write_new(out/'raw'/n,raw[n])

    payload_rows=[]
    for p,b in sorted(files.items()):
        kind=category(p)
        if kind is None:continue
        payload_rows.append({'path':p,'git_blob_sha':tree[p]['git_blob_sha'],'sha256':sha(b),'size_bytes':len(b),'mode':tree[p]['mode'],'category':kind})
    ensure(all(p in {x['path'] for x in payload_rows} for p in ENTRYPOINTS),'RELEASE_ENTRYPOINT_MISSING')
    binding={'schema_version':SCHEMA,'subject_commit_sha':subject,'source_tree_git_sha':git.git('rev-parse',subject+'^{tree}').decode().strip(),'scope_version':'CONSERVATIVE_REPOSITORY_SOURCE_V1','scope_description':'Exact Git-object source binding for formal Adoption; installed dependency/interpreter bytes are separately host-bound.','files':payload_rows,'content_inventory_sha256':sha(canonical(payload_rows)),'execution_entrypoints':ENTRYPOINTS,'category_counts':dict(Counter(x['category'] for x in payload_rows)),'installed_material_separately_required':True,'execution_authorized':False,'production_authorized':False}
    binding_bytes=canonical(binding)+b'\n';write_new(out/'release-material-binding.json',binding_bytes)
    candidate={'schema':'MCFT_CAP09_ADOPTION_CANDIDATE_V1','subject_sha':subject,'scope':'TEST_ONLY','checks':rows,'frozen_paths':108,'first_parent_proven':True,'qcp_proof_ref':'qcp-proof.json','qcp_proof_sha256':sha(proof_bytes),'qcp_artifact_sha256':artifact_sha,'engineering_check_id':FORMAL_ENGINEERING_CHECK,'release_binding_ref':'release-material-binding.json','release_binding_sha256':sha(binding_bytes),'installed_material_required':True,'signature_required':True,'execution_authorized':False,'production_authorized':False}
    candidate_bytes=canonical(candidate)+b'\n';write_new(out/'adoption-candidate.json',candidate_bytes)
    summary={'status':'FINAL_QCP_ADOPTION_PACKAGE_PREPARED_UNSIGNED','subject_sha':subject,'formal_checks':54,'frozen_paths':108,'engineering_check':'PASS','not_applicable_ids':sorted(FORMAL_ALLOWED_NA),'qcp_artifact_sha256':artifact_sha,'candidate_sha256':sha(candidate_bytes),'release_binding_sha256':sha(binding_bytes),'execution_authorized':False,'production_authorized':False}
    write_new(out/'summary.json',canonical(summary)+b'\n');return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repo',required=True);parser.add_argument('--subject',required=True)
    parser.add_argument('--output',required=True);parser.add_argument('--ci-capture');parser.add_argument('--formal-qcp-artifact')
    a=parser.parse_args()
    try:
        result=finalize_qcp_adoption(a.repo,a.subject,a.formal_qcp_artifact,a.output) if a.formal_qcp_artifact else build(a.repo,a.subject,a.output,a.ci_capture)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'status':'ADOPTION_BUILD_FAILED_PRESERVE_OUTPUT','reason_code':str(e).split(':')[0] if isinstance(e,ValueError) else type(e).__name__,'execution_authorized':False}),file=sys.stderr)
        raise SystemExit(1)
