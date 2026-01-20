import React from 'react';
import { fetchJudgeAoSense, fetchJudgeProblemStates, fetchJudgeReferenceViews } from '../lib/api';
import JudgeProblemCard from '../components/JudgeProblemCard';
import { fmtIso, fmtWindow } from '../lib/judge_humanize';

function JsonBlock({ value }: { value: any }): React.ReactElement {
  return (
    <pre
      className="card"
      style={{ padding: 12, overflow: 'auto', maxHeight: 520, fontFamily: 'var(--mono)', fontSize: 12 }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

type Tab = 'problem_states' | 'reference_views' | 'ao_sense';

export default function JudgeRecordsPage(): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>('problem_states');
  const [limit, setLimit] = React.useState(50);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<any>(null);

  const [showAudit, setShowAudit] = React.useState(false);

  async function reload(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      if (tab === 'problem_states') {
        setData(await fetchJudgeProblemStates(limit));
      } else if (tab === 'reference_views') {
        setData(await fetchJudgeReferenceViews(limit));
      } else {
        setData(await fetchJudgeAoSense(limit));
      }
    } catch (e: any) {
      setErr(e?.bodyText ? String(e.bodyText) : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, limit]);

  // accept either {items:[...]} or {...} raw array
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
      ? data
      : Array.isArray(data?.problem_states)
        ? data.problem_states
        : Array.isArray(data?.reference_views)
          ? data.reference_views
          : Array.isArray(data?.ao_sense)
            ? data.ao_sense
            : [];

  return (
    <div className="grid">
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Apple II · Judge Records</h2>
            <div className="sub" style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>
              这是审计/回放用的记录页。默认只显示“人类可读摘要”，audit 模式才显示原始字段。
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <label className="pill" title="Show raw machine fields">
              audit
              <input type="checkbox" checked={showAudit} onChange={(e) => setShowAudit(e.target.checked)} />
            </label>
            <button className="btn" onClick={reload} disabled={busy}>
              {busy ? 'Loading…' : 'Reload'}
            </button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className={'btn' + (tab === 'problem_states' ? ' primary' : '')} onClick={() => setTab('problem_states')}>
            ProblemStates
          </button>
          <button className={'btn' + (tab === 'reference_views' ? ' primary' : '')} onClick={() => setTab('reference_views')}>
            ReferenceViews
          </button>
          <button className={'btn' + (tab === 'ao_sense' ? ' primary' : '')} onClick={() => setTab('ao_sense')}>
            AO-SENSE
          </button>

          <div className="pill">
            limit
            <input
              className="input"
              style={{ width: 90 }}
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
        </div>

        {err ? (
          <div className="card" style={{ padding: 12, marginTop: 12, borderColor: 'rgba(255,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{err}</div>
          </div>
        ) : null}
      </div>

      {/* Human summaries */}
      {tab === 'problem_states' && items.length ? (
        <div className="list">
          {items.map((x: any, idx: number) => {
            const w = x?.window;
            const subject = x?.subjectRef;
            const title = subject
              ? `${String(subject.projectId ?? subject.project_id ?? 'P_DEFAULT')}${subject.groupId ? ` · ${subject.groupId}` : subject.group_id ? ` · ${subject.group_id}` : ''}`
              : '—';
            const created = typeof x?.created_at_ts === 'number' ? fmtIso(x.created_at_ts) : '';
            return (
              <div key={String(x?.problem_state_id ?? x?.problemStateId ?? idx)} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="mono" style={{ fontSize: 12 }}>{title}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{w ? fmtWindow(w) : '—'}{created ? ` · created ${created}` : ''}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <JudgeProblemCard problemState={x} aoSense={[]} showAudit={showAudit} />
                </div>

                {showAudit ? (
                  <details className="judgeDetails" style={{ marginTop: 10 }}>
                    <summary className="judgeSummary">Raw (audit)</summary>
                    <div style={{ marginTop: 10 }}>
                      <JsonBlock value={x} />
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab !== 'problem_states' && items.length ? (
        <div className="list">
          {items.map((x: any, idx: number) => {
            const id = x?.reference_view_id ?? x?.ao_sense_id ?? x?.id ?? idx;
            const w = x?.window;
            const k = x?.kind ? String(x.kind) : tab;
            return (
              <div key={String(id)} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{k}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{w ? fmtWindow(w) : '—'}</div>
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 10 }}>
                  该对象用于证据组织/回放（不是状态、不是结论）。
                </div>

                <details className="judgeDetails" style={{ marginTop: 10 }}>
                  <summary className="judgeSummary">Details{showAudit ? '' : ' (audit)'} </summary>
                  <div style={{ marginTop: 10 }}>
                    <JsonBlock value={x} />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      ) : null}

      {!items.length && !busy && !err ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="muted">No records.</div>
        </div>
      ) : null}
    </div>
  );
}
