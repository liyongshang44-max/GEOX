import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve('apps/web/src/features/operations/pages/OperationDetailPage.tsx');
const source = readFileSync(sourcePath, 'utf8');

function indexOfOrThrow(pattern: string): number {
  const idx = source.indexOf(pattern);
  assert.notEqual(idx, -1, `expected to find pattern: ${pattern}`);
  return idx;
}

test('useOperationDetail two-phase path keeps hooks before loading guard', () => {
  const hookUseState = indexOfOrThrow('const [isExecuting, setIsExecuting] = React.useState(false);');
  const hookUseEffect = indexOfOrThrow('React.useEffect(() => {');
  const loadingGuard = indexOfOrThrow('if (loading) return <SectionSkeleton kind="detail" />;');

  assert.ok(hookUseState < loadingGuard, 'useState must execute before loading short-circuit');
  assert.ok(hookUseEffect < loadingGuard, 'useEffect must execute before loading short-circuit');
});

test('error=true path is also guarded after hook declarations', () => {
  const hookUseState = indexOfOrThrow('const [manualHandoffItems, setManualHandoffItems] = React.useState<OperationHandoffItem[]>([]);');
  const errorGuard = indexOfOrThrow('if (error || !detail) {');

  assert.ok(hookUseState < errorGuard, 'all hooks must be declared before error guard');
});

test('no hook declarations appear after first early return guard', () => {
  const loadingGuard = indexOfOrThrow('if (loading) return <SectionSkeleton kind="detail" />;');
  const tail = source.slice(loadingGuard);

  assert.equal(tail.includes('React.useState('), false, 'no useState after loading guard');
  assert.equal(tail.includes('React.useEffect('), false, 'no useEffect after loading guard');
  assert.equal(tail.includes('React.useMemo('), false, 'no useMemo after loading guard');
});
