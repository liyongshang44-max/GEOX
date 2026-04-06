import React from "react";
import { Link, useParams } from "react-router-dom";
import ErrorState from "../components/common/ErrorState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import {
  acceptWorkAssignment,
  arriveWorkAssignment,
  fetchWorkAssignmentDetail,
  submitWorkAssignment,
  type WorkAssignmentItem,
} from "../api/humanAssignments";
import { ApiError } from "../api/client";
import { fetchTaskTrajectory, fetchOperationDetail, type OperationDetailResponse } from "../api/operations";
const ALLOW_SUBMIT_FROM_ACCEPTED = /^(1|true|yes|on)$/i.test(String((globalThis as any)?.__GEOX_CONFIG__?.WORK_ASSIGNMENT_ALLOW_SUBMIT_FROM_ACCEPTED ?? ""));

function formatWindow(startTs?: number, endTs?: number): string {
  if (!startTs || !endTs) return "-";
  const start = new Date(startTs).toLocaleString("zh-CN", { hour12: false });
  const end = new Date(endTs).toLocaleString("zh-CN", { hour12: false });
  return `${start} ~ ${end}`;
}

function safeJsonText(data: unknown): string {
  if (!data) return "{}";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "{}";
  }
}


function parseApiErrorCode(error: unknown): string {
  if (!(error instanceof ApiError) || !error.bodyText) return "";
  try {
    const payload = JSON.parse(error.bodyText);
    return String(payload?.error ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

function parseApiFieldErrors(error: unknown): Array<{ field: string; code: string; message: string }> {
  if (!(error instanceof ApiError) || !error.bodyText) return [];
  try {
    const payload = JSON.parse(error.bodyText);
    return Array.isArray(payload?.field_errors) ? payload.field_errors : [];
  } catch {
    return [];
  }
}

function getAssignmentFriendlyError(error: unknown, fallback: string): string {
  const errorCode = parseApiErrorCode(error);
  if (errorCode === "INVALID_STATUS_TRANSITION") {
    return "任务状态已变化，正在刷新最新状态";
  }
  if (errorCode === "CONFLICT") {
    return "任务状态已变化，正在刷新最新状态";
  }
  if (errorCode === "ASSIGNMENT_EXPIRED") {
    return "任务已超时，无法继续该动作";
  }
  return fallback;
}

export default function HumanAssignmentDetailPage(): React.ReactElement {
  const { assignmentId = "" } = useParams();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [notice, setNotice] = React.useState<string>("");
  const [item, setItem] = React.useState<WorkAssignmentItem | null>(null);
  const [trajectory, setTrajectory] = React.useState<any | null>(null);
  const [operation, setOperation] = React.useState<OperationDetailResponse | null>(null);
  const [remark, setRemark] = React.useState<string>("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [photoCategoryByName, setPhotoCategoryByName] = React.useState<Record<string, "before" | "during" | "after" | "anomaly" | "other">>({});
  const [exceptionType, setExceptionType] = React.useState<string>("NONE");
  const [exceptionCode, setExceptionCode] = React.useState<string>("");
  const [workerCount, setWorkerCount] = React.useState<number>(1);
  const [fuelLiters, setFuelLiters] = React.useState<string>("");
  const [electricKwh, setElectricKwh] = React.useState<string>("");
  const [waterLiters, setWaterLiters] = React.useState<string>("");
  const [chemicalMl, setChemicalMl] = React.useState<string>("");
  const [fieldErrors, setFieldErrors] = React.useState<Array<{ field: string; code: string; message: string }>>([]);

  const reload = React.useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const assignment = await fetchWorkAssignmentDetail(assignmentId);
      setItem(assignment);
      if (assignment?.act_task_id) {
        const trajRes = await fetchTaskTrajectory(assignment.act_task_id);
        setTrajectory(trajRes?.payload ?? null);
        const operationPlanId = String(trajRes?.payload?.operation_plan_id ?? "");
        if (operationPlanId) {
          const op = await fetchOperationDetail(operationPlanId);
          setOperation(op);
        } else {
          setOperation(null);
        }
      }
    } catch (err: any) {
      setError(String(err?.message ?? "加载失败"));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  const shouldForceRefreshForError = React.useCallback((err: unknown): boolean => {
    const code = parseApiErrorCode(err);
    return code === "INVALID_STATUS_TRANSITION" || code === "CONFLICT";
  }, []);

  const applyActionError = React.useCallback(async (err: unknown, fallback: string): Promise<void> => {
    setError(getAssignmentFriendlyError(err, fallback));
    if (shouldForceRefreshForError(err)) {
      await reload();
    }
  }, [reload, shouldForceRefreshForError]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleAccept = async (): Promise<void> => {
    if (!item) return;
    setSubmitting(true);
    setNotice("");
    try {
      await acceptWorkAssignment(item.assignment_id);
      setNotice("已接单");
      await reload();
    } catch (err: any) {
      await applyActionError(err, String(err?.message ?? "接单失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArrive = async (): Promise<void> => {
    if (!item) return;
    setSubmitting(true);
    setNotice("");
    try {
      await arriveWorkAssignment(item.assignment_id);
      setNotice("已更新为执行中");
      await reload();
    } catch (err: any) {
      await applyActionError(err, String(err?.message ?? "更新状态失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!item) return;
    setSubmitting(true);
    setNotice("");
    setError("");
    setFieldErrors([]);
    const now = Date.now();
    try {
      const evidenceMeta = files.map((f, idx) => {
        const safeName = f.name.replace(/[^A-Za-z0-9._-]/g, "_");
        return {
          artifact_id: `artifact_${assignmentId}_${now}_${idx}`,
          object_key: `tenant/${item.assignment_id}/assignments/${item.assignment_id}/evidence/${now}_${idx}_${safeName}`,
          filename: f.name,
          category: photoCategoryByName[f.name] ?? "other",
          mime_type: f.type || undefined,
          size_bytes: Number(f.size ?? 0),
          captured_at_ts: now,
        };
      });
      const toMaybeNumber = (v: string): number | undefined => {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      await submitWorkAssignment(item.assignment_id, {
        execution_time: {
          start_ts: Number(trajectory?.start_ts ?? now - 10 * 60 * 1000),
          end_ts: now,
        },
        labor: {
          duration_minutes: Math.max(1, Math.round((now - Number(trajectory?.start_ts ?? now - 10 * 60 * 1000)) / 60000)),
          worker_count: workerCount,
        },
        resource_usage: {
          fuel_l: toMaybeNumber(fuelLiters),
          electric_kwh: toMaybeNumber(electricKwh),
          water_l: toMaybeNumber(waterLiters),
          chemical_ml: toMaybeNumber(chemicalMl),
        },
        exception: {
          type: exceptionType,
          code: exceptionCode.trim() || undefined,
          detail: remark.trim() || undefined,
        },
        location_summary: {
          geohash: String(trajectory?.geohash ?? ""),
          path_points: Array.isArray(trajectory?.points) ? trajectory.points.length : undefined,
          distance_m: Number(trajectory?.distance_m ?? 0) || undefined,
          remark: remark.trim() || undefined,
        },
        evidence_meta: evidenceMeta,
        observed_parameters: {
          remark,
          uploaded_images: evidenceMeta.map((x) => ({ filename: x.filename, object_key: x.object_key, artifact_id: x.artifact_id, category: x.category })),
        },
        logs_refs: evidenceMeta.map((x) => ({ kind: "artifact_object", ref: String(x.object_key) })),
        status: "executed",
      });
      setNotice("提交成功");
      await reload();
    } catch (err: any) {
      setFieldErrors(parseApiFieldErrors(err));
      await applyActionError(err, String(err?.message ?? "提交失败"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SectionSkeleton kind="detail" />;
  if (error && !item) return <ErrorState title="任务详情不可用" message={error} onRetry={() => void reload()} />;
  if (!item) return <ErrorState title="任务不存在" message="请返回列表重试" onRetry={() => void reload()} />;

  const taskTitle = operation?.program_name ? `${operation.program_name} / 人工执行` : `人工任务 ${item.assignment_id}`;
  const fieldLabel = operation?.field_name || operation?.field_id || trajectory?.field_id || "-";
  const actionType = String(operation?.task?.action_type ?? operation?.plan?.action_type ?? "未知动作");
  const parameterPayload = operation?.task?.parameters ?? operation?.task?.parameter_json ?? operation?.plan?.parameters ?? {};
  const windowLabel = formatWindow(Number(trajectory?.start_ts || 0), Number(trajectory?.end_ts || 0));
  const fallbackContext = item.fallback_context ?? null;

  return (
    <div className="productPage">
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">GEOX / 人工执行详情</div>
            <h1 className="pageTitle">{taskTitle}</h1>
            <div className="pageLead">按任务信息执行并提交回执。</div>
          </div>
          <div className="row">
            <Link className="btn" to="/human-assignments">返回列表</Link>
            <button className="btn" onClick={() => void reload()} disabled={submitting}>刷新</button>
          </div>
        </div>
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <div className="kv"><span className="k">任务标题</span><span className="v">{taskTitle}</span></div>
        <div className="kv"><span className="k">地块</span><span className="v">{fieldLabel}</span></div>
        <div className="kv"><span className="k">时间窗</span><span className="v">{windowLabel}</span></div>
        <div className="kv"><span className="k">动作类型</span><span className="v">{actionType}</span></div>
        <div className="kv"><span className="k">接单截止</span><span className="v">{item.accept_deadline_ts ? new Date(item.accept_deadline_ts).toLocaleString("zh-CN", { hour12: false }) : "-"}</span></div>
        <div className="kv"><span className="k">到场截止</span><span className="v">{item.arrive_deadline_ts ? new Date(item.arrive_deadline_ts).toLocaleString("zh-CN", { hour12: false }) : "-"}</span></div>
        <div className="kv"><span className="k">超时时间</span><span className="v">{item.expired_ts ? new Date(item.expired_ts).toLocaleString("zh-CN", { hour12: false }) : "-"}</span></div>
        <div className="kv"><span className="k">超时原因</span><span className="v">{item.expired_reason || "-"}</span></div>
        <div className="kv"><span className="k">来源</span><span className="v">{item.origin_type === "auto_fallback" ? "自动转人工" : "人工派发"}</span></div>
        <div className="kv"><span className="k">转人工原因</span><span className="v">{fallbackContext?.reason_message || fallbackContext?.reason_code || "-"}</span></div>
        <div className="kv"><span className="k">失败重试</span><span className="v">{fallbackContext?.retry_count != null || fallbackContext?.max_retries != null ? `${fallbackContext?.retry_count ?? "-"} / ${fallbackContext?.max_retries ?? "-"}` : "-"}</span></div>
        <div className="kv"><span className="k">触发条件</span><span className="v">{Array.isArray((fallbackContext as any)?.takeover_conditions) && (fallbackContext as any).takeover_conditions.length ? (fallbackContext as any).takeover_conditions.join(" / ") : "-"}</span></div>
        <div className="kv"><span className="k">设备状态</span><span className="v">{fallbackContext?.device?.status || "-"}</span></div>
        <div className="kv"><span className="k">设备标识</span><span className="v">{fallbackContext?.device?.device_name || fallbackContext?.device?.device_id || "-"}</span></div>
        <div className="kv" style={{ alignItems: "flex-start" }}>
          <span className="k">操作参数</span>
          <pre className="v" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{safeJsonText(parameterPayload)}</pre>
        </div>
        {fallbackContext ? (
          <div className="kv" style={{ alignItems: "flex-start" }}>
            <span className="k">失败上下文</span>
            <pre className="v" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{safeJsonText(fallbackContext)}</pre>
          </div>
        ) : null}
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <h3 className="h3">执行提交</h3>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ minWidth: 80 }}>图片上传</label>
          <input
            type="file"
            multiple
            onChange={(e) => {
              const next = Array.from(e.target.files || []);
              setFiles(next);
              setPhotoCategoryByName((prev) => {
                const merged: Record<string, "before" | "during" | "after" | "anomaly" | "other"> = {};
                for (const f of next) merged[f.name] = prev[f.name] ?? "other";
                return merged;
              });
            }}
          />
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          已选择：{files.length ? files.map((f) => f.name).join("，") : "未选择"}
        </div>
        {files.map((file) => (
          <div className="row" key={file.name} style={{ marginTop: 6 }}>
            <span style={{ minWidth: 180 }}>{file.name}</span>
            <select
              className="input"
              value={photoCategoryByName[file.name] ?? "other"}
              onChange={(e) => setPhotoCategoryByName((prev) => ({ ...prev, [file.name]: e.target.value as "before" | "during" | "after" | "anomaly" | "other" }))}
            >
              <option value="before">施工前</option>
              <option value="during">施工中</option>
              <option value="after">施工后</option>
              <option value="anomaly">异常照片</option>
              <option value="other">其他</option>
            </select>
          </div>
        ))}

        <div className="row" style={{ marginTop: 12 }}>
          <label style={{ minWidth: 80 }}>异常类型</label>
          <select className="input" value={exceptionType} onChange={(e) => setExceptionType(e.target.value)}>
            <option value="NONE">无异常</option>
            <option value="WEATHER">天气</option>
            <option value="MACHINE">设备异常</option>
            <option value="MATERIAL_SHORTAGE">耗材不足</option>
            <option value="SAFETY">安全风险</option>
            <option value="FIELD_BLOCKED">地块阻塞</option>
            <option value="OTHER">其他</option>
          </select>
          <input
            className="input"
            placeholder="异常码（可选）"
            value={exceptionCode}
            onChange={(e) => setExceptionCode(e.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <label style={{ minWidth: 80 }}>人力/耗材</label>
          <input className="input" type="number" min={1} value={workerCount} onChange={(e) => setWorkerCount(Math.max(1, Number(e.target.value || 1)))} placeholder="人数" />
          <input className="input" type="number" min={0} value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} placeholder="燃油(L)" />
          <input className="input" type="number" min={0} value={electricKwh} onChange={(e) => setElectricKwh(e.target.value)} placeholder="电耗(kWh)" />
          <input className="input" type="number" min={0} value={waterLiters} onChange={(e) => setWaterLiters(e.target.value)} placeholder="水耗(L)" />
          <input className="input" type="number" min={0} value={chemicalMl} onChange={(e) => setChemicalMl(e.target.value)} placeholder="药剂(ml)" />
        </div>

        <div className="row" style={{ marginTop: 12, alignItems: "flex-start" }}>
          <label style={{ minWidth: 80, marginTop: 8 }}>备注</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 96 }}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="填写执行过程、异常情况、补充说明"
          />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {item.status === "ASSIGNED" ? <button className="btn" onClick={() => void handleAccept()} disabled={submitting}>接单</button> : null}
          {item.status === "ACCEPTED" ? <button className="btn" onClick={() => void handleArrive()} disabled={submitting}>开始执行</button> : null}
          {(item.status === "ARRIVED" || (item.status === "ACCEPTED" && ALLOW_SUBMIT_FROM_ACCEPTED)) ? (
            <button className="btn primary" onClick={() => void handleSubmit()} disabled={submitting}>提交</button>
          ) : null}
          <span className="pill">当前状态：{item.status}</span>
        </div>
        {notice ? <div className="muted" style={{ marginTop: 8 }}>{notice}</div> : null}
        {error ? <div className="muted" style={{ marginTop: 8 }}>异常：{error}</div> : null}
        {fieldErrors.length ? (
          <div className="muted" style={{ marginTop: 8 }}>
            字段错误：{fieldErrors.map((x) => `${x.field}(${x.code})`).join("；")}
          </div>
        ) : null}
      </section>
    </div>
  );
}
