import React from "react";
import {
  createEvidenceExportJob,
  fetchEvidenceExportJob,
  fetchEvidenceExportJobs,
  type EvidenceExportJob,
  type EvidenceExportScopeType,
  fetchAuthMe,
} from "../lib/api";

type StatusTone = "default" | "ok" | "warn" | "bad";

function statusTone(status: string): StatusTone {
  if (status === "DONE") return "ok";
  if (status === "ERROR") return "bad";
  if (status === "RUNNING") return "warn";
  return "default";
}

function fmtTs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString();
}

function defaultWindowStart(): string {
  return String(Date.now() - 24 * 60 * 60 * 1000);
}

function defaultWindowEnd(): string {
  return String(Date.now() + 60 * 1000);
}

export default function ExportJobsPage(): React.ReactElement {
  const [token, setToken] = React.useState<string>(() => {
    try {
      return localStorage.getItem("geox_ao_act_token") || "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
    } catch {
      return "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
    }
  });
  const [scopeType, setScopeType] = React.useState<EvidenceExportScopeType>("FIELD");
  const [scopeId, setScopeId] = React.useState<string>("field_demo_001");
  const [fromTs, setFromTs] = React.useState<string>(defaultWindowStart());
  const [toTs, setToTs] = React.useState<string>(defaultWindowEnd());
  const [jobs, setJobs] = React.useState<EvidenceExportJob[]>([]);
  const [exportFormat, setExportFormat] = React.useState<"JSON" | "CSV" | "PDF">("PDF");
  const [exportLanguage, setExportLanguage] = React.useState<"zh-CN" | "en-US">("zh-CN");
  const [role, setRole] = React.useState<string>("admin");
  const [selectedJobId, setSelectedJobId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<EvidenceExportJob | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

  function persistToken(next: string): void {
    setToken(next);
    try {
      localStorage.setItem("geox_ao_act_token", next);
    } catch {
      // ignore
    }
  }

  async function refresh(selectLatest?: boolean): Promise<void> {
    setBusy(true);
    setStatus("正在同步导出任务列表...");
    try {
      const nextJobs = await fetchEvidenceExportJobs(token);
      setJobs(nextJobs);
      const nextSelected = selectLatest && nextJobs.length ? nextJobs[0].job_id : selectedJobId;
      if (nextSelected) {
        setSelectedJobId(nextSelected);
        const nextDetail = await fetchEvidenceExportJob(token, nextSelected);
        setDetail(nextDetail);
      } else {
        setDetail(null);
      }
      setStatus(`已加载 ${nextJobs.length} 个导出任务。`);
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(jobId: string): Promise<void> {
    setSelectedJobId(jobId);
    setStatus(`正在读取任务 ${jobId} ...`);
    try {
      const nextDetail = await fetchEvidenceExportJob(token, jobId);
      setDetail(nextDetail);
      setStatus(`任务 ${jobId} 已加载。`);
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    }
  }

  async function createJob(): Promise<void> {
    if (role === "operator" && scopeType === "TENANT") {
      setStatus("当前操作员角色不能生成全租户证据包，请改用 FIELD 或 DEVICE 范围。");
      return;
    }
    setBusy(true);
    setStatus("正在创建导出任务...");
    try {
      const from_ts_ms = Number(fromTs);
      const to_ts_ms = Number(toTs);
      if (!Number.isFinite(from_ts_ms) || !Number.isFinite(to_ts_ms) || to_ts_ms <= from_ts_ms) {
        throw new Error("时间窗口不合法");
      }
      const jobId = await createEvidenceExportJob(token, {
        scope_type: scopeType,
        scope_id: scopeType === "TENANT" ? null : scopeId,
        from_ts_ms,
        to_ts_ms,
        export_format: exportFormat,
        export_language: exportLanguage,
      });
      setStatus(`已创建导出任务 ${jobId}。`);
      await refresh(true);
    } catch (e: any) {
      setStatus(`创建失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    fetchAuthMe(token).then((me) => setRole(me.role)).catch(() => setRole("admin"));
    void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Audit & Export</div>
          <h2 className="heroTitle">证据导出</h2>
          <p className="heroText">
            当前已支持 evidence-export job 的创建、列表、详情查看，以及 JSON / CSV / PDF 主产物与 manifest / sha256 下载入口。
          </p>
        </div>
        <div className="heroActions">
          <button className="btn" onClick={() => void refresh(false)} disabled={busy}>刷新列表</button>
        </div>
      </section>

      <div className="contentGridTwo">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">创建导出任务</div>
              <div className="sectionDesc">建议先用 FIELD 范围做演示；TENANT 范围仅管理员可用。当前角色：{role === "operator" ? "操作员" : "管理员"}</div>
            </div>
          </div>
          <div className="formGrid fourCols">
            <label className="field">
              访问令牌
              <input className="input" value={token} onChange={(e) => persistToken(e.target.value)} />
            </label>
            <label className="field">
              导出范围
              <select className="select" value={scopeType} onChange={(e) => setScopeType(e.target.value as EvidenceExportScopeType)}>
                <option value="TENANT" disabled={role === "operator"}>TENANT（全租户，仅管理员）</option>
                <option value="FIELD">FIELD（田块）</option>
                <option value="DEVICE">DEVICE（设备）</option>
              </select>
            </label>
            <label className="field">
              范围对象 ID
              <input
                className="input"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                disabled={scopeType === "TENANT"}
                placeholder={scopeType === "DEVICE" ? "dev_001" : scopeType === "FIELD" ? "field_demo_001" : "TENANT 无需填写"}
              />
            </label>
            <div className="field fieldAction">
              执行
              <button className="btn primary" onClick={() => void createJob()} disabled={busy}>创建导出任务</button>
            </div>
          </div>
          <div className="formGrid twoCols" style={{ marginTop: 12 }}>
            <label className="field">
              导出格式
              <select className="select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "JSON" | "CSV" | "PDF")}>
                <option value="PDF">PDF（最小摘要报告）</option>
                <option value="CSV">CSV（事实清单）</option>
                <option value="JSON">JSON（完整证据包）</option>
              </select>
            </label>
            <label className="field">
              导出语言
              <select className="select" value={exportLanguage} onChange={(e) => setExportLanguage(e.target.value as "zh-CN" | "en-US")}>
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
          </div>
          <div className="formGrid twoCols" style={{ marginTop: 12 }}>
            <label className="field">
              起始时间（ms）
              <input className="input" value={fromTs} onChange={(e) => setFromTs(e.target.value)} />
            </label>
            <label className="field">
              结束时间（ms）
              <input className="input" value={toTs} onChange={(e) => setToTs(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card sectionBlock statusPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">运行状态</div>
              <div className="sectionDesc">当前页聚焦“创建、查看、下载”主路径，保持演示链路清晰。</div>
            </div>
          </div>
          <div className="kv"><span className="k">状态消息</span><span className="v statusText">{status || "-"}</span></div>
          <div className="kv"><span className="k">当前任务</span><span className="v">{selectedJobId || "-"}</span></div>
          <div className="kv"><span className="k">任务数量</span><span className="v">{String(jobs.length)}</span></div>
          <div className="kv"><span className="k">详情状态</span><span className="v">{detail?.status || "-"}</span></div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">导出任务列表</div>
              <div className="sectionDesc">按最近更新时间排序，点击右侧可查看详情。</div>
            </div>
          </div>
          <div className="list modernList">
            {jobs.map((job) => (
              <button
                key={job.job_id}
                className={`jobListItem ${selectedJobId === job.job_id ? "selected" : ""}`}
                onClick={() => void loadDetail(job.job_id)}
              >
                <div className="jobListMain">
                  <div className="jobTitleRow">
                    <div className="title">{job.job_id}</div>
                    <div className={`pill tone-${statusTone(job.status)}`}>{job.status}</div>
                  </div>
                  <div className="meta">
                    <span>{job.scope_type}</span>
                    <span>{job.scope_id || "-"}</span>
                    <span>创建：{fmtTs(job.created_ts_ms)}</span>
                    <span>更新：{fmtTs(job.updated_ts_ms)}</span>
                  </div>
                </div>
                <div className="jobListAction">查看详情</div>
              </button>
            ))}
            {!jobs.length ? <div className="emptyState">当前还没有导出任务。先创建一个 FIELD 范围任务即可。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock detailPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">任务详情</div>
              <div className="sectionDesc">展示任务范围、时间窗口与 evidence pack 文件摘要。</div>
            </div>
          </div>
          {detail ? (
            <>
              <div className="kv"><span className="k">任务 ID</span><span className="v">{detail.job_id}</span></div>
              <div className="kv"><span className="k">导出范围</span><span className="v">{detail.scope_type}:{detail.scope_id || "-"}</span></div>
              <div className="kv"><span className="k">时间窗口</span><span className="v">{fmtTs(detail.from_ts_ms)} → {fmtTs(detail.to_ts_ms)}</span></div>
              <div className="kv"><span className="k">导出格式</span><span className="v">{detail.evidence_pack?.export_format || "-"}</span></div>
              <div className="kv"><span className="k">导出语言</span><span className="v">{detail.evidence_pack?.export_language || "-"}</span></div>
              <div className="kv"><span className="k">存储模式</span><span className="v">{detail.evidence_pack?.delivery?.storage_mode || "-"}</span></div>
              <div className="kv"><span className="k">对象键</span><span className="v mono">{detail.evidence_pack?.delivery?.object_store_key || "-"}</span></div>
              <div className="kv"><span className="k">镜像下载</span><span className="v">{detail.evidence_pack?.delivery?.object_store_download_url ? <a href={detail.evidence_pack.delivery.object_store_download_url} target="_blank" rel="noreferrer">打开镜像下载</a> : "-"}</span></div>
              <div className="kv"><span className="k">产物摘要</span><span className="v">{detail.artifact_sha256 || "-"}</span></div>
              <div className="kv"><span className="k">错误信息</span><span className="v">{detail.error || "-"}</span></div>
              <div style={{ marginTop: 14 }}>
                <div className="sectionSubTitle">证据包文件</div>
                <div className="fileList">
                  {(detail.evidence_pack?.files || []).map((file) => (
                    <div key={file.name} className="fileCard">
                      <div className="fileCardHead">
                        <strong>{file.name}</strong>
                        <a className="btn" href={file.download_path} target="_blank" rel="noreferrer">下载</a>
                      </div>
                      <div className="fileMeta">{file.content_type} · {file.size_bytes ?? "?"} bytes</div>
                      <div className="mono hashText">{file.sha256 || "-"}</div>
                    </div>
                  ))}
                  {!detail.evidence_pack?.files?.length ? <div className="emptyState">当前任务还没有可展示的证据包摘要。</div> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="emptyState">从左侧列表中选择一个任务，即可查看证据包与下载入口。</div>
          )}
        </section>
      </div>
    </div>
  );
}
