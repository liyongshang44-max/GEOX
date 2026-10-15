"""Offline byte/provenance review of a BLOCKED adoption manifest. Cannot promote it."""
import argparse
import hashlib
import json
from pathlib import Path
from material_binding import canonical, ensure, read_bytes, safe_relative, sha


def review(root, trusted_digest):
    root=Path(root);raw=read_bytes(root/'adoption-evidence-manifest.json')
    ensure(sha(raw)==trusted_digest,'MANIFEST_DIGEST_MISMATCH');m=json.loads(raw)
    ensure(m['schema_version']=='MCFT_CAP09_ADOPTION_EVIDENCE_MANIFEST_V1','SCHEMA_INVALID')
    ensure(m['status']=='ADOPTION_INCOMPLETE' and m['overall_pass_issuance_allowed'] is False,'UNREVIEWED_PROMOTION')
    ensure(m['execution_authorized'] is False and m['production_authorized'] is False,'AUTHORITY_FORBIDDEN')
    def checked(rel,expected):
        safe_relative(rel);b=read_bytes(root/rel);ensure(sha(b)==expected,'RAW_EVIDENCE_CHANGED');return b
    def source(row):
        b=checked('evidence/raw/repository/'+row['path'],row['sha256'])
        oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        ensure(oid==row['git_blob_sha'] and len(b)==row['size_bytes'],'SOURCE_IDENTITY_CHANGED');return b
    binding=json.loads(checked('release-material-binding.json',m['release_material_binding_sha256']))
    ensure(binding['subject_commit_sha']==m['subject_commit_sha'],'RELEASE_SUBJECT_MISMATCH')
    checks=m['checks'];ensure(len(checks)==54 and len({r['check_id'] for r in checks})==54,'CHECK_SET_CHANGED')
    q=json.loads(source(checks[0]['definition_document']));registry=json.loads(source(checks[0]['evidence_registry']))
    ensure([r['check_id'] for r in checks]==[x['check_id'] for x in q['checks']],'CHECK_MEMBERSHIP_CHANGED')
    for index,row in enumerate(checks):
        ensure(row['definition']==q['checks'][index] and row['check_revision']==sha(canonical(row['definition'])),'CHECK_REVISION_CHANGED')
        ensure(row['actual_conclusion']=='BLOCKED','UNREVIEWED_CHECK_PROMOTION')
        ensure(row['applicability']['adoption_adjudication']=='BLOCKED','UNREVIEWED_APPLICABILITY')
        for src in row['implementation_sources']:source(src)
        for evidence in row['original_evidence']:
            value=registry
            for token in evidence['registry_pointer'].split('/')[1:]:
                token=token.replace('~1','/').replace('~0','~');value=value[int(token)] if isinstance(value,list) else value[token]
            ensure(value==evidence['record'] and sha(canonical(value))==evidence['record_sha256'],'REGISTRY_REFERENCE_CHANGED')
            ensure(evidence['original_artifact_bytes_verified'] is False,'ORIGINAL_ARTIFACT_NOT_VERIFIED')
    history=m['historical_52'];old=json.loads(checked(history['raw_path'],history['raw_sha256']))
    ensure(len(old['checks'])==52 and len(history['mapping'])==52,'HISTORICAL_SET_CHANGED')
    current={r['check_id']:r for r in checks}
    for row,definition in zip(history['mapping'],old['checks']):
        ensure(row['check_id']==definition['check_id'] and row['historical_definition']==definition,'HISTORICAL_DEFINITION_CHANGED')
        ensure(row['historical_revision']==sha(canonical(definition)) and row['current_revision']==current[row['check_id']]['check_revision'],'HISTORICAL_REVISION_CHANGED')
        ensure(row['equivalence_result']=='BLOCKED','UNREVIEWED_EQUIVALENCE')
    entry=m['entry_65'];b=source(entry['source']);ensure(len(entry['checks'])==65,'ENTRY_MEMBERSHIP_CHANGED')
    ensure(len({x['check_id'] for x in entry['checks']})==65,'ENTRY_DUPLICATE')
    lines=b.decode().splitlines()
    for row in entry['checks']:
        ensure(row['check_revision']==sha(b) and row['source_anchor'] in lines[row['source_line']-1],'ENTRY_SOURCE_CHANGED')
        ensure(row['actual_conclusion']=='BLOCKED' and row['original_evidence'] is None,'ENTRY_UNREVIEWED_PROMOTION')
    frozen=m['frozen_108'];ensure(len(frozen)==108 and len({x['path'] for x in frozen})==108,'FROZEN_SET_CHANGED')
    for row in frozen:
        b=checked('payload/'+row['path'],row['sha256']);oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        ensure(oid==row['git_blob_sha'],'FROZEN_BYTES_CHANGED')
        same=oid==row['frozen_git_blob_sha'];ensure(row['bytes_unchanged']==same and row['actual_conclusion']==('PASS' if same else 'FAIL'),'FROZEN_RESULT_CHANGED')
    chain=m['first_parent']['commits'];ensure(chain and chain[0]['commit_sha']==m['subject_commit_sha'],'CHAIN_SUBJECT_CHANGED')
    for i,row in enumerate(chain):
        b=checked(row['raw_path'],row['raw_sha256']);oid=hashlib.sha1(b'commit '+str(len(b)).encode()+b'\0'+b).hexdigest()
        ensure(oid==row['commit_sha'],'COMMIT_OBJECT_CHANGED')
        headers=b.split(b'\n\n',1)[0].decode().splitlines();parents=[x[7:] for x in headers if x.startswith('parent ')]
        ensure(parents==row['parents'] and row['tree']==next(x[5:] for x in headers if x.startswith('tree ')),'COMMIT_HEADERS_CHANGED')
        if i+1<len(chain):ensure(parents[0]==chain[i+1]['commit_sha'],'FIRST_PARENT_DISCONTINUITY')
    ensure(chain[-1]['commit_sha']==history['subject_commit_sha'],'HISTORY_ENDPOINT_CHANGED')
    second=m['first_parent']['historical_second_parent'];b=checked(second['raw_path'],second['raw_sha256'])
    ensure(hashlib.sha1(b'commit '+str(len(b)).encode()+b'\0'+b).hexdigest()==second['commit_sha'],'SECOND_PARENT_OBJECT_CHANGED')
    second_tree=next(x[5:] for x in b.split(b'\n\n',1)[0].decode().splitlines() if x.startswith('tree '))
    ensure(chain[-1]['parents']==['c9e027b832d1e25a20384d4853ed5564ed405fd4',second['commit_sha']],'HISTORICAL_PARENTS_CHANGED')
    ensure(chain[-1]['tree']==second_tree==second['tree'],'MERGE_TREE_CHANGED')
    ensure(m['first_parent']['full_historical_assertions_result']=='BLOCKED','UNREVIEWED_HISTORY_PROMOTION')
    for row in m['ci_raw_and_derived_evidence']:checked(row['path'],row['sha256'])
    return {'status':'EVIDENCE_MAPPING_BYTES_VERIFIED_ADOPTION_BLOCKED','qcp_checks':54,'historical_checks':52,'entry_checks':65,
        'frozen_paths':108,'first_parent_commits':len(chain),'execution_authorized':False,'production_authorized':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);parser.add_argument('--trusted-sha256',required=True);a=parser.parse_args()
    try:print(json.dumps(review(a.root,a.trusted_sha256)))
    except Exception as e:
        print(json.dumps({'status':'EVIDENCE_REVIEW_FAIL_EXECUTE_HOLD','reason_code':str(e).split(':')[0] if isinstance(e,ValueError) else type(e).__name__,'execution_authorized':False}));raise SystemExit(1)
