// Purpose: productize existing canonical State and Forecast GET responses without introducing new data fields.
// Boundary: render only typed values already returned by the canonical client; no payload parsing, status inference, browser clock, or synthetic values.

import React from "react";
import type {
  McftAttachmentV1,
  McftCanonicalRefV1,
  McftCollectionItemV1,
  McftCollectionPageV1,
  McftRuntimeReadModelV1,
} from "../../../api/mcftFieldTwinRuntime";
import { useLocale } from "../../../lib/locale";
import "../../../styles/pfe14StateForecastProductization.css";

type StateProps = { page: McftCollectionPageV1 | undefined };
type ForecastProps = { runtime: McftRuntimeReadModelV1; page: McftCollectionPageV1 | undefined };

function exact(value: string | null | undefined, empty: string): string {
  return value === null || value === undefined || value === "" ? empty : value;
}

function TechnicalIdentity({ item, english }: { item: McftCollectionItemV1; english: boolean }): React.ReactElement {
  return (
    <details className="pfe14StateForecast__technical">
      <summary>{english ? "Technical identity" : "技术身份"}</summary>
      <dl>
        <div><dt>object_ref</dt><dd>{item.object_ref}</dd></div>
        <div><dt>object_hash</dt><dd>{item.object_hash}</dd></div>
      </dl>
    </details>
  );
}

function RefIdentity({ value, english }: { value: McftCanonicalRefV1 | null | undefined; english: boolean }): React.ReactElement | null {
  if (!value) return null;
  return (
    <details className="pfe14StateForecast__technical">
      <summary>{english ? "Technical identity" : "技术身份"}</summary>
      <dl>
        <div><dt>object_ref</dt><dd>{value.object_ref}</dd></div>
        <div><dt>object_type</dt><dd>{value.object_type}</dd></div>
        <div><dt>object_hash</dt><dd>{value.object_hash}</dd></div>
        <div><dt>source_fact_ref</dt><dd>{value.source_fact_ref || "—"}</dd></div>
      </dl>
    </details>
  );
}

function AttachmentIdentity({ attachment, english }: { attachment: McftAttachmentV1; english: boolean }): React.ReactElement | null {
  if (!attachment.item) return null;
  return <RefIdentity value={attachment.item} english={english} />;
}

function CanonicalRecordList({ page, english, kind }: { page: McftCollectionPageV1; english: boolean; kind: "state" | "forecast" }): React.ReactElement {
  if (page.items.length === 0) {
    return <p className="pfe14StateForecast__empty">{english ? `No visible canonical ${kind} records were returned for this exact scope.` : `当前精确 Scope 未返回可见的规范${kind === "state" ? "状态" : "预测"}记录。`}</p>;
  }
  return (
    <div className="pfe14StateForecast__records">
      {page.items.map((item) => (
        <article className="pfe14StateForecast__record" key={`${item.object_ref}:${item.object_hash}`}>
          <div className="pfe14StateForecast__recordMain">
            <span className="pfe14StateForecast__recordType">{item.object_type}</span>
            <strong>{item.logical_time}</strong>
            <span>{english ? "Attachment" : "挂接状态"}: {item.attachment_status}</span>
          </div>
          <TechnicalIdentity item={item} english={english} />
        </article>
      ))}
    </div>
  );
}

function ContractUnavailable({ title, detail }: { title: string; detail: string }): React.ReactElement {
  return (
    <div className="pfe14StateForecast__unavailable">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function Pfe14StateProductPanel({ page }: StateProps): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  const first = page?.items[0] ?? null;
  return (
    <section className="operatorFieldRuntime__panel pfe14StateForecast" data-pfe14-state-product="canonical-get-only">
      <header className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="pfe14StateForecast__eyebrow">{english ? "Canonical State" : "规范状态"}</p>
          <h2 className="operatorFieldRuntime__panelTitle">{english ? "State records" : "状态记录"}</h2>
          <p className="operatorFieldRuntime__panelMeta">{english ? "Canonical State objects visible in the current exact-scope GET response. State is not a sensor reading." : "当前精确 Scope GET 响应中可见的规范 State 对象。State 不是传感器读数。"}</p>
        </div>
        <span className="pfe14StateForecast__boundaryBadge">State ≠ Sensor Reading</span>
      </header>

      <div className="pfe14StateForecast__summaryGrid">
        <div><span>{english ? "Visible records on this page" : "本页可见记录"}</span><strong>{page ? page.items.length : "—"}</strong></div>
        <div><span>{english ? "Most recent returned logical time" : "最近返回的逻辑时间"}</span><strong>{first?.logical_time || "—"}</strong></div>
        <div><span>{english ? "Attachment status" : "挂接状态"}</span><strong>{first?.attachment_status || "—"}</strong></div>
      </div>

      <div className="pfe14StateForecast__contractGrid">
        <ContractUnavailable title={english ? "State value / unit" : "状态值 / 单位"} detail={english ? "Not exposed by the current product read contract; no value is synthesized." : "当前产品读合同未暴露；不补写任何样例值。"} />
        <ContractUnavailable title={english ? "Confidence" : "置信信息"} detail={english ? "Not exposed by the current product read contract." : "当前产品读合同未暴露。"} />
        <ContractUnavailable title={english ? "Normalized state status" : "归一化状态状态"} detail={english ? "Not established by the current product read contract." : "当前产品读合同尚未建立该字段。"} />
      </div>

      {page ? <CanonicalRecordList page={page} english={english} kind="state" /> : <p className="pfe14StateForecast__empty">{english ? "State collection was not returned for this tab." : "当前标签未返回 State collection。"}</p>}

      {page ? (
        <details className="pfe14StateForecast__pageDetails">
          <summary>{english ? "Collection technical details" : "Collection 技术详情"}</summary>
          <dl>
            <div><dt>collection_kind</dt><dd>{page.collection_kind}</dd></div>
            <div><dt>fixed_root_ref</dt><dd>{page.fixed_root_ref}</dd></div>
            <div><dt>has_more</dt><dd>{String(page.has_more)}</dd></div>
            <div><dt>response_started_at</dt><dd>{page.response_started_at}</dd></div>
            <div><dt>collection_page_content_hash</dt><dd>{page.collection_page_content_hash}</dd></div>
          </dl>
        </details>
      ) : null}
    </section>
  );
}

function ForecastAttachment({ label, attachment, english }: { label: string; attachment: McftAttachmentV1; english: boolean }): React.ReactElement {
  return (
    <article className="pfe14StateForecast__attachment">
      <span>{label}</span>
      <strong>{attachment.attachment_status}</strong>
      <small>reason_code: {exact(attachment.reason_code, "—")}</small>
      <AttachmentIdentity attachment={attachment} english={english} />
    </article>
  );
}

export function Pfe14ForecastProductPanel({ runtime, page }: ForecastProps): React.ReactElement {
  const { locale } = useLocale();
  const english = locale === "en-US";
  return (
    <div className="operatorFieldRuntime__contentGrid" data-pfe14-forecast-product="canonical-get-only">
      <section className="operatorFieldRuntime__panel pfe14StateForecast">
        <header className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="pfe14StateForecast__eyebrow">{english ? "Canonical Forecast" : "规范预测"}</p>
            <h2 className="operatorFieldRuntime__panelTitle">{english ? "Forecast context" : "预测上下文"}</h2>
            <p className="operatorFieldRuntime__panelMeta">{english ? "Exact attachments already returned by the canonical Runtime root. Attachment presence is not converted into a new forecast or scenario verdict." : "仅展示规范 Runtime root 已返回的精确挂接关系；不会把对象存在转换成新的 Forecast 或 Scenario verdict。"}</p>
          </div>
        </header>

        <div className="pfe14StateForecast__forecastGrid">
          <article className="pfe14StateForecast__attachment">
            <span>{english ? "Current tick forecast object" : "当前 Tick Forecast 对象"}</span>
            <strong>{runtime.current_tick_forecast_result ? english ? "Canonical object returned" : "已返回规范对象" : english ? "No object returned" : "未返回对象"}</strong>
            <small>{runtime.current_tick_forecast_result?.object_type || "—"}</small>
            <RefIdentity value={runtime.current_tick_forecast_result} english={english} />
          </article>
          <ForecastAttachment label={english ? "Latest successful forecast attachment" : "最近成功 Forecast 挂接"} attachment={runtime.latest_successful_forecast} english={english} />
          <ForecastAttachment label={english ? "Scenario-source forecast attachment" : "Scenario source Forecast 挂接"} attachment={runtime.scenario_source_forecast} english={english} />
        </div>

        <div className="pfe14StateForecast__contractGrid">
          <ContractUnavailable title={english ? "Normalized forecast status" : "归一化 Forecast 状态"} detail={english ? "The current product read contract does not expose this field." : "当前产品读合同未暴露该字段。"} />
          <ContractUnavailable title={english ? "Forecast horizon" : "Forecast horizon"} detail={english ? "Not exposed by the current product read contract; the browser does not parse hidden payloads." : "当前产品读合同未暴露；浏览器不解析隐藏 payload。"} />
          <ContractUnavailable title={english ? "Scenario eligibility" : "Scenario eligibility"} detail={english ? "Not established by the current product read contract; attachment presence is not used as a substitute." : "当前产品读合同尚未建立；不会以挂接对象存在替代权威 verdict。"} />
        </div>

        <div className="pfe14StateForecast__nonclaims">
          <strong>Forecast is not Fact.</strong>
          <strong>Forecast is not Recommendation.</strong>
          <strong>Forecast is not Action.</strong>
        </div>
      </section>

      <section className="operatorFieldRuntime__panel pfe14StateForecast">
        <header className="operatorFieldRuntime__panelHeader">
          <div>
            <h2 className="operatorFieldRuntime__panelTitle">{english ? "Forecast records" : "Forecast 记录"}</h2>
            <p className="operatorFieldRuntime__panelMeta">{english ? "Bounded canonical collection returned for this exact scope." : "当前精确 Scope 返回的有界规范 collection。"}</p>
          </div>
        </header>
        {page ? <CanonicalRecordList page={page} english={english} kind="forecast" /> : <p className="pfe14StateForecast__empty">{english ? "Forecast collection was not returned for this tab." : "当前标签未返回 Forecast collection。"}</p>}
        {page ? (
          <details className="pfe14StateForecast__pageDetails">
            <summary>{english ? "Collection technical details" : "Collection 技术详情"}</summary>
            <dl>
              <div><dt>collection_kind</dt><dd>{page.collection_kind}</dd></div>
              <div><dt>fixed_root_ref</dt><dd>{page.fixed_root_ref}</dd></div>
              <div><dt>visible_items_on_page</dt><dd>{page.items.length}</dd></div>
              <div><dt>has_more</dt><dd>{String(page.has_more)}</dd></div>
              <div><dt>response_started_at</dt><dd>{page.response_started_at}</dd></div>
              <div><dt>collection_page_content_hash</dt><dd>{page.collection_page_content_hash}</dd></div>
            </dl>
          </details>
        ) : null}
      </section>
    </div>
  );
}
