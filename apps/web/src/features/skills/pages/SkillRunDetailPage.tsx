import React from "react";
import { Link, useParams } from "react-router-dom";
import { getSkillRunDetail, listSkillRuns, type SkillRunDetail, type SkillRunSummary } from "../../../api/skills";
import ErrorState from "../../../components/common/ErrorState";

function fmtTs(ts?: number | null): string {
  const n = Number(ts ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString("zh-CN", { hour12: false });
}

function jsonBlock(data: unknown): string {
  if (data == null) return "-";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default function SkillRunDetailPage(): React.ReactElement {
  const { runId } = useParams();
  const [item, setItem] = React.useState<SkillRunDetail | null>(null);
  const [recentRuns, setRecentRuns] = React.useState<SkillRunSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const detail = runId ? await getSkillRunDetail(runId) : null;
        if (!mounted) return;
        setItem(detail);
        const runs = await listSkillRuns({ skill_id: detail?.skill_id || undefined, limit: 10 });
        if (mounted) setRecentRuns(runs);
        setError(null);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "读取失败");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [runId]);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Skill Runs</div>
          <h2 className="heroTitle">技能运行详情</h2>
          <p className="heroText">追踪单次运行的版本、状态、范围、输入输出和最近运行轨迹。</p>
        </div>
      </section>

      {error ? <ErrorState title="技能运行详情加载失败" message={error} onRetry={() => window.location.reload()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">运行主记录</div>
            <div className="sectionDesc">展示状态、版本、执行时长、触发源和错误诊断。</div>
          </div>
        </div>

        {loading ? <div className="emptyState">加载中...</div> : null}
        {!loading && !item ? <div className="emptyState">未找到运行记录。</div> : null}
        {item ? (
          <div className="infoCard">
            <div className="jobTitleRow">
              <div>
                <div className="title">{item.skill_id}</div>
                <div className="metaText">run_id: {item.run_id}</div>
              </div>
              <div className={`pill tone-${String(item.status).toUpperCase() === "SUCCESS" ? "ok" : String(item.status).toUpperCase() === "RUNNING" ? "warn" : "bad"}`}>{item.status}</div>
            </div>
            <div className="meta wrapMeta">
              <span>版本：{item.version || "-"}</span>
              <span>绑定范围：{item.scope || "-"}</span>
              <span>触发来源：{item.trigger_source || "-"}</span>
              <span>开始：{fmtTs(item.started_ts_ms)}</span>
              <span>结束：{fmtTs(item.finished_ts_ms)}</span>
              <span>耗时：{item.duration_ms ?? "-"} ms</span>
              <span>错误码：{item.error_code || "-"}</span>
              <span>错误信息：{item.error_message || "-"}</span>
            </div>
            <div className="inlineActions">
              <Link className="btn" to="/skills/registry">注册中心</Link>
              <Link className="btn" to={`/skills/bindings?skill_id=${encodeURIComponent(item.skill_id)}`}>绑定关系</Link>
            </div>
            <div className="contentGridTwo alignStart" style={{ marginTop: 12 }}>
              <div>
                <div className="sectionTitle" style={{ fontSize: 14 }}>输入</div>
                <pre className="devBanner" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{jsonBlock(item.input)}</pre>
              </div>
              <div>
                <div className="sectionTitle" style={{ fontSize: 14 }}>输出</div>
                <pre className="devBanner" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{jsonBlock(item.output)}</pre>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">最近运行</div><div className="sectionDesc">同技能最近 10 次运行。</div></div></div>
        <div className="list modernList">
          {recentRuns.map((run) => (
            <div key={run.run_id} className="infoCard">
              <div className="jobTitleRow"><div className="title">{run.run_id}</div><div className={`pill tone-${String(run.status).toUpperCase() === "SUCCESS" ? "ok" : "warn"}`}>{run.status}</div></div>
              <div className="meta wrapMeta"><span>版本：{run.version || "-"}</span><span>范围：{run.scope || "-"}</span><span>开始：{fmtTs(run.started_ts_ms)}</span><span>耗时：{run.duration_ms ?? "-"} ms</span></div>
              <div className="inlineActions"><Link className="btn" to={`/skills/runs/${encodeURIComponent(run.run_id)}`}>查看详情</Link></div>
            </div>
          ))}
          {!recentRuns.length ? <div className="emptyState">暂无最近运行记录。</div> : null}
        </div>
      </section>
    </div>
  );
}
