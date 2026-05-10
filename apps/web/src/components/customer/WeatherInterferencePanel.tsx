import React from "react";
import type { OperationEnvironmentContext, WeatherEvent, WeatherResult } from "../../api/weather";
import "../../styles/weatherInterference.css";

type WeatherInterferencePanelProps = {
  context: OperationEnvironmentContext | null;
  loading?: boolean;
  className?: string;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "暂无记录";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无记录";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function formatRainfall(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "暂无降雨量";
  return `${Number(value).toFixed(2)} mm`;
}

function statusText(context: OperationEnvironmentContext | null): string {
  if (!context) return "天气源不可用";
  if (context.status === "ok") return "天气源已接入";
  if (context.unavailableReason === "location_unavailable") return "当前位置不可用";
  if (context.unavailableReason === "provider_error") return "天气服务不可用";
  if (context.unavailableReason === "not_ready") return "天气环境上下文未接入";
  if (context.unavailableReason === "bad_request") return "天气查询参数无效";
  return "天气源不可用";
}

function primaryWeather(context: OperationEnvironmentContext | null): WeatherResult | null {
  if (!context) return null;
  return context.history ?? context.forecast ?? null;
}

function allEvents(context: OperationEnvironmentContext | null): WeatherEvent[] {
  if (!context) return [];
  return [
    ...(context.history?.events ?? []),
    ...(context.forecast?.events ?? []),
  ];
}

function totalRainfall(context: OperationEnvironmentContext | null): number | null {
  if (!context) return null;
  const values = [context.history?.rainfallMm, context.forecast?.rainfallMm]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function weatherSource(context: OperationEnvironmentContext | null): string {
  const primary = primaryWeather(context);
  return primary?.source || (context?.status === "unavailable" ? `weather_unavailable:${context.unavailableReason ?? "unknown"}` : "暂无数据来源");
}

function impactWindow(context: OperationEnvironmentContext | null): string {
  const primary = primaryWeather(context);
  if (!primary?.from && !primary?.to) return "暂无影响窗口";
  return `${formatDateTime(primary.from)} 至 ${formatDateTime(primary.to)}`;
}

function acceptanceBoundaryText(context: OperationEnvironmentContext | null): string {
  if (!context || context.status === "unavailable") return "不参与验收判断；仅显示天气空态。";
  const rainfall = Number(totalRainfall(context) ?? 0);
  if (rainfall > 0 || context.rainfallMayExplainSoilMoistureChange === true) return "仅辅助验收复核，不直接替代通过/失败结论。";
  return "仅作为验收背景参考，不直接改变验收结论。";
}

function learningExclusionText(context: OperationEnvironmentContext | null): string {
  if (!context || context.status === "unavailable") return "学习排除状态待补充";
  if (context.learningWeatherInterferenceExcluded === true) return "已排除或降低置信度";
  if (context.learningWeatherInterferenceExcluded === false) return "未排除天气干扰";
  const rainfall = Number(totalRainfall(context) ?? 0);
  return rainfall > 0 ? "建议排除或降低置信度" : "暂无需排除";
}

function conclusionText(context: OperationEnvironmentContext | null): string {
  if (!context || context.status === "unavailable") return "天气源未接入或当前位置不可用，当前不参与验收判断。";
  const rainfall = Number(totalRainfall(context) ?? 0);
  if (rainfall > 0 || allEvents(context).length > 0) {
    return "检测到降雨事件，本次土壤湿度变化可能受天气影响；相关学习结论需排除或降低置信度。天气仅用于辅助解释和学习排除，不直接替代验收结论。";
  }
  return "当前天气窗口未发现明显降雨事件。天气仅作为辅助解释，不直接改变验收结论。";
}

function eventText(event: WeatherEvent, index: number): string {
  const type = event.eventType === "FORECAST_RAIN" ? "预报降雨" : event.eventType === "RAIN" ? "历史降雨" : "天气事件";
  return `${type} ${index + 1}：${formatDateTime(event.startedAt)} 至 ${formatDateTime(event.endedAt)}，降雨 ${formatRainfall(event.rainfallMm)}`;
}

export default function WeatherInterferencePanel({ context, loading = false, className = "" }: WeatherInterferencePanelProps): React.ReactElement {
  const rainfall = totalRainfall(context);
  const events = allEvents(context);
  const updatedAt = new Date().toISOString();
  return (
    <section className={`weatherInterferencePanel ${className}`.trim()} aria-label="天气干扰说明">
      <div className="weatherInterferenceHead">
        <div>
          <h3>天气干扰说明</h3>
          <p>{loading ? "正在读取天气环境上下文..." : conclusionText(context)}</p>
        </div>
        <span className={`weatherInterferenceBadge ${context?.status === "ok" ? "ok" : "unavailable"}`}>{loading ? "加载中" : statusText(context)}</span>
      </div>

      <div className="weatherInterferenceGrid">
        <div><strong>天气源状态</strong><span>{loading ? "加载中" : statusText(context)}</span></div>
        <div><strong>降雨量</strong><span>{formatRainfall(rainfall)}</span></div>
        <div><strong>降雨事件</strong><span>{events.length ? `${events.length} 个事件` : "暂无降雨事件"}</span></div>
        <div><strong>影响窗口</strong><span>{impactWindow(context)}</span></div>
        <div><strong>验收使用边界</strong><span>{acceptanceBoundaryText(context)}</span></div>
        <div><strong>是否排除学习</strong><span>{learningExclusionText(context)}</span></div>
        <div><strong>数据来源</strong><span>{weatherSource(context)}</span></div>
        <div><strong>更新时间</strong><span>{formatDateTime(updatedAt)}</span></div>
      </div>

      {events.length ? (
        <div className="weatherInterferenceEvents">
          {events.slice(0, 6).map((event, index) => <div key={`${event.startedAt ?? "event"}-${index}`}>{eventText(event, index)}</div>)}
        </div>
      ) : null}

      <div className="weatherInterferenceBoundaryNote">天气用于辅助解释和学习排除，不直接替代验收结论，也不单独构成验收通过或失败原因。</div>
    </section>
  );
}
