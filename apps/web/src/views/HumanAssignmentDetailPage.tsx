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

function getAssignmentFriendlyError(error: unknown, fallback: string): string {
  const errorCode = parseApiErrorCode(error);
  if (errorCode === "INVALID_STATUS_TRANSITION") {
    return "当前任务状态已变化，请刷新后重试。";
  }
  if (errorCode === "CONFLICT") {
    return "任务状态刚刚被其他人更新（例如已被他人接单），请刷新查看最新状态。";
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
      setError(getAssignmentFriendlyError(err, String(err?.message ?? "接单失败")));
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
      setError(getAssignmentFriendlyError(err, String(err?.message ?? "更新状态失败")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!item) return;
    setSubmitting(true);
    setNotice("");
    setError("");
    const now = Date.now();
    try {
      await submitWorkAssignment(item.assignment_id, {
        execution_time: {
          start_ts: Number(trajectory?.start_ts ?? now - 10 * 60 * 1000),
          end_ts: now,
        },
        observed_parameters: {
          remark,
          uploaded_images: files.map((f) => f.name),
        },
        logs_refs: files.map((f) => ({ kind: "image", ref: f.name })),
        status: "executed",
      });
      setNotice("提交成功");
      await reload();
    } catch (err: any) {
      setError(getAssignmentFriendlyError(err, String(err?.message ?? "提交失败")));
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
        <div className="kv" style={{ alignItems: "flex-start" }}>
          <span className="k">操作参数</span>
          <pre className="v" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{safeJsonText(parameterPayload)}</pre>
        </div>
      </section>

      <section className="card section" style={{ marginTop: 16 }}>
        <h3 className="h3">执行提交</h3>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ minWidth: 80 }}>图片上传</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          已选择：{files.length ? files.map((f) => f.name).join("，") : "未选择"}
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
          {(item.status === "ACCEPTED" || item.status === "ARRIVED") ? (
            <button className="btn primary" onClick={() => void handleSubmit()} disabled={submitting}>提交</button>
          ) : null}
          <span className="pill">当前状态：{item.status}</span>
        </div>
        {notice ? <div className="muted" style={{ marginTop: 8 }}>{notice}</div> : null}
        {error ? <div className="muted" style={{ marginTop: 8 }}>异常：{error}</div> : null}
      </section>
    </div>
  );
}
