"""Offline content binding; no Git, network, subprocess or execution authority."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath

SCHEMA = 'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def ensure(condition, code):
    if not condition:
        raise ValueError(code)

def safe_relative(value):
    ensure(isinstance(value, str) and value and '\\' not in value and ':' not in value, 'UNSAFE_PATH')
    p = PurePosixPath(value)
    ensure(not p.is_absolute() and str(p) == value and all(x not in ('.', '..') for x in p.parts), 'UNSAFE_PATH')
    return p

def no_links(path):
    p = Path(path).absolute()
    for current in (p, *p.parents):
        ensure(not current.is_symlink(), 'LINK_FORBIDDEN')
        # On Python 3.12+ detect Windows junctions explicitly as well.
        ensure(not getattr(current, 'is_junction', lambda: False)(), 'JUNCTION_FORBIDDEN')
    return p

def read_bytes(path):
    p = no_links(path)
    ensure(p.is_file(), 'FILE_MISSING')
    return p.read_bytes()

def write_new(path, data):
    p = Path(path)
    no_links(p.parent)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open('xb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())

def category(rel):
    """Conservative, explicit scope; all files in executable roots are bound."""
    safe_relative(rel)
    name = PurePosixPath(rel).name
    if name in ('pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'):
        return 'dependency_lock'
    if name == 'package.json':
        return 'dependency_declaration'
    if rel.startswith('docs/'):
        return 'authority_and_evidence_json' if rel.endswith('.json') else None
    if rel.startswith(('.github/', 'acceptance-output/')):
        return None
    if rel.startswith(('apps/', 'packages/', 'scripts/', 'infra/', 'config/', 'schemas/', 'tools/')):
        if '/db/migrations/' in rel or rel.endswith('.sql'):
            return 'database_schema_source'
        if rel.endswith(('.json', '.yaml', '.yml', '.toml', '.ini')):
            return 'runtime_configuration_source'
        return 'executable_source_and_support'
    if '/' not in rel and (rel.endswith(('.json', '.yaml', '.yml', '.cjs', '.mjs', '.js', '.toml')) or name in ('.npmrc', '.nvmrc', '.node-version')):
        return 'root_toolchain_configuration'
    return None

def verify(root, manifest_path, trusted_digest, subject, loaded_paths=()):
    """trusted_digest must come from reviewed proof, never from this manifest."""
    raw = read_bytes(manifest_path)
    ensure(sha(raw) == trusted_digest, 'UNTRUSTED_OR_CHANGED_MANIFEST')
    m = json.loads(raw)
    ensure(m['schema_version'] == SCHEMA and m['subject_commit_sha'] == subject, 'SUBJECT_MISMATCH')
    ensure(m['scope_version'] == 'CONSERVATIVE_REPOSITORY_SOURCE_V1', 'SCOPE_MISMATCH')
    root = no_links(root).resolve()
    expected = {}
    folded = set()
    for row in m['files']:
        rel = row['path']; safe_relative(rel)
        ensure(rel not in expected and rel.casefold() not in folded, 'DUPLICATE_OR_CASE_COLLISION')
        ensure(row['category'] == category(rel) and row['category'] is not None, 'CATEGORY_MISMATCH')
        expected[rel] = row; folded.add(rel.casefold())
    ensure(expected and sha(canonical(m['files'])) == m['content_inventory_sha256'], 'INVENTORY_INVALID')
    actual = set()
    for directory, dirs, files in os.walk(root, followlinks=False):
        rel_dir = Path(directory).relative_to(root)
        for name in list(dirs):
            rel = (rel_dir / name).as_posix()
            if name in ('.git', 'node_modules'):
                dirs.remove(name)
                continue
            no_links(Path(directory) / name)
        for name in files:
            rel = (rel_dir / name).as_posix()
            if category(rel) is None:
                continue
            actual.add(rel)
            ensure(rel in expected, 'EXTRA_MATERIAL:' + rel)
            data = read_bytes(root / rel)
            row = expected[rel]
            ensure(len(data) == row['size_bytes'] and sha(data) == row['sha256'], 'CONTENT_DRIFT:' + rel)
    ensure(actual == set(expected), 'MISSING_MATERIAL')
    ensure(all(p in expected for p in m['execution_entrypoints']), 'ENTRYPOINT_MISSING')
    checked_loaded = []
    for loaded in loaded_paths:
        p = no_links(loaded).resolve()
        try:
            rel = p.relative_to(root).as_posix()
        except ValueError:
            raise ValueError('LOADED_PATH_OUTSIDE_RELEASE') from None
        ensure(rel in expected, 'LOADED_PATH_NOT_BOUND')
        ensure(sha(read_bytes(p)) == expected[rel]['sha256'], 'LOADED_BYTES_CHANGED')
        checked_loaded.append(rel)
    return {'status': 'RELEASE_SOURCE_BYTES_MATCH_EXECUTE_HOLD', 'subject_commit_sha': subject,
            'manifest_sha256': trusted_digest, 'files_verified': len(expected), 'loaded_paths_verified': checked_loaded,
            'installed_dependencies_verified': False, 'host_configuration_verified': False,
            'execution_authorized': False, 'production_authorized': False}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True); parser.add_argument('--manifest', required=True)
    parser.add_argument('--trusted-sha256', required=True); parser.add_argument('--subject', required=True)
    parser.add_argument('--loaded-path', action='append', default=[])
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.root, args.manifest, args.trusted_sha256, args.subject, args.loaded_path)))
    except (ValueError, KeyError, OSError, TypeError, json.JSONDecodeError) as e:
        # No input content or credential-bearing paths printed by the CLI.
        print(json.dumps({'status':'RELEASE_BINDING_FAIL_EXECUTE_HOLD','reason_code':str(e).split(':')[0] if isinstance(e,ValueError) else 'INVALID_INPUT','execution_authorized':False}))
        raise SystemExit(1)
