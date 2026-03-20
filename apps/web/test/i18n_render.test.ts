import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStatusToText, t } from '../src/lib/i18n.ts';

test('zh locale should return chinese status text', () => {
  const tt = (key: string) => t('zh', key);
  assert.equal(mapStatusToText('SUCCEEDED', tt), '成功');
  assert.equal(mapStatusToText('FAILED', tt), '失败');
  assert.equal(mapStatusToText('RUNNING', tt), '执行中');
  assert.equal(mapStatusToText('PENDING', tt), '待执行');
});

test('zh operation labels should not leak english words', () => {
  const keys = [
    'operation.title',
    'operation.list',
    'operation.detail',
    'operation.timeline',
    'field.currentOperation',
    'field.recentTimeline',
  ];
  for (const k of keys) {
    const v = t('zh', k);
    assert.equal(/[A-Za-z]/.test(v), false);
  }
});

test('gis and acceptance layer labels exist in both locales', () => {
  const keys = [
    'field.layerControl',
    'field.layerTrajectory',
    'field.layerAlerts',
    'field.layerAcceptance',
    'field.acceptanceSummary',
    'operation.gis.trajectory_summary',
    'operation.gis.spatial_summary',
    'program.spatialSummary',
    'program.trajectorySummary',
  ];
  for (const k of keys) {
    const zh = t('zh', k);
    const en = t('en', k);
    assert.notEqual(zh, k);
    assert.notEqual(en, k);
    assert.ok(String(zh).length > 0);
    assert.ok(String(en).length > 0);
  }
});
