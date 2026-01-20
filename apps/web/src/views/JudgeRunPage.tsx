import React from 'react';
import { postJudgeRun } from '../lib/api';

type JudgeRunResponse = any;

function nowMs(): number {
  return Date.now();
}

export default function JudgeRunPage(): React.ReactElement {
  const [projectId, setProjectId] = React.useState<string>('P_DEFAULT');
  const [groupId, setGroupId] = React.useState<string>('G_CAF');
  const [windowDays, setWindowDays] = React.useState<number>(1);
  const [dryRun, setDryRun] = React.useState<boolean>(false);

  const [busy, setBusy] = React.useState<boolean>(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [resp, setResp] = React.useState<JudgeRunResponse | null>(null);

  const scale = 'group';

  const endTs = React.useMemo(() => nowMs(), [busy]); // refresh on run
  const startTs = React.useMemo(() => endTs - Math.max(1, windowDays) * 24 * 60 * 60 * 1000, [endTs, windowDays]);

  async function run(): Promise<void> {
    setBusy(true);
    setErr(null);
    setResp(null);
    try {
      const end = nowMs();
      const start = end - Math.max(1, windowDays) * 24 * 60 * 60 * 1000;

      const body: any = {
        subjectRef: { projectId, groupId },
        scale,
        window: { startTs: start, endTs: end },
        dryRun: dryRun || undefined,
      };

      const out = await postJudgeRun(body);
      setResp(out);
    } catch (e: any) {
      setErr(e?.bodyText ? String(e.bodyText) : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const problemStates = Array.isArray((resp as any)?.problem_states)
    ? (resp as any).problem_states
    : Array.isArray((resp as any)?.problemStates)
      ? (resp as any).problemStates
      : [];

  const aoSense = Array.isArray((resp as any)?.ao_sense)
    ? (resp as any).ao_sense
    : Array.isArray((resp as any)?.aoSense)
      ? (resp as any).aoSense
      : [];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <h2>Judge Run</h2>

      <p style={{ marginTop: 8, color: '#444' }}>
        本页面仅作为“运行参数输入器”。它不会修改 Judge 配置，也不会写入 SSOT。所有输入仅映射为一次
        <code style={{ marginLeft: 6 }}>POST /api/judge/run</code>
        的请求体。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <label>
          <div>projectId</div>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            placeholder="P_DEFAULT"
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            映射到 <code>subjectRef.projectId</code>
          </div>
        </label>

        <label>
          <div>groupId</div>
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            placeholder="G_CAF"
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            映射到 <code>subjectRef.groupId</code>
          </div>
        </label>

        <label>
          <div>window_days</div>
          <input
            type="number"
            min={1}
            max={30}
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={{ width: '100%', padding: 8 }}
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            映射为“从当前时间回溯 N 天”的窗口：<code>window.startTs</code> 与 <code>window.endTs</code> 由前端计算
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <div>
            dryRun
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              映射到请求体 <code>dryRun</code>（后端若忽略亦可）
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        固定：<code>scale = {scale}</code>。预览窗口（本地计算）：<code>{startTs}</code> → <code>{endTs}</code>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={run} disabled={busy} style={{ padding: '10px 14px' }}>
          {busy ? 'Running...' : 'Run Judge'}
        </button>
      </div>

      {err ? (
        <pre style={{ marginTop: 16, padding: 12, background: '#fff2f2', border: '1px solid #ffd0d0', overflowX: 'auto' }}>
          {err}
        </pre>
      ) : null}

      {resp ? (
        <>
          <h3 style={{ marginTop: 24 }}>Response</h3>
          <pre style={{ padding: 12, background: '#f6f6f6', border: '1px solid #eee', overflowX: 'auto' }}>
            {JSON.stringify(resp, null, 2)}
          </pre>

          <h3 style={{ marginTop: 24 }}>Problem States (summary)</h3>
          <pre style={{ padding: 12, background: '#f6f6f6', border: '1px solid #eee', overflowX: 'auto' }}>
            {JSON.stringify(problemStates, null, 2)}
          </pre>

          <h3 style={{ marginTop: 24 }}>AO-SENSE (summary)</h3>
          <pre style={{ padding: 12, background: '#f6f6f6', border: '1px solid #eee', overflowX: 'auto' }}>
            {JSON.stringify(aoSense, null, 2)}
          </pre>
        </>
      ) : null}
    </div>
  );
}
