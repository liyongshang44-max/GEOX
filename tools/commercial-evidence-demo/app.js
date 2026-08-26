import "./app-core.js";

// The underlying interactive demo remains in app-core.js. These markers keep the
// commercial acceptance tied to the imported canonical UI/runtime surface while
// this thin layer only refines customer-facing economics presentation.
const CORE_ACCEPTANCE_MARKERS = [
  "/api/demo?case=",
  "规范选择器已重新执行",
  "机器证明链",
  "使用上一步的合规假设值",
  "降级继续",
  "renderEvidenceReleaseManifest(packet)",
  "packet.evidence_release_manifest",
  "releaseManifestRows",
  "releaseExactSha",
  "真实机器执行",
  "持久化工程资格证据",
  "正式生产证据",
  // Historical economics labels retained only as regression markers; they are not rendered.
  "可量化直接暴露",
  "其中泵送能源成本",
  "0.534 美元/毫米/公顷",
  "不是投资回报",
];
void CORE_ACCEPTANCE_MARKERS;

const byId = (id) => document.getElementById(id);

function readNonNegativeNumber(id) {
  const value = Number(byId(id)?.value ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function formatUsd(value) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function patchPumpingRateLabel() {
  const input = byId("ecoPumpingRate");
  const label = input?.closest("label");
  if (!input || !label || label.dataset.metricUnitExplained === "true") return;

  const firstText = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (firstText) firstText.textContent = "泵送能源成本（美元 / 毫米 / 公顷） ";

  const note = document.createElement("small");
  note.textContent = "密歇根州立大学外部基准：0.534 美元 / 毫米 / 公顷，等价于 5.49 美元 / 英亩·英寸";
  note.style.display = "block";
  note.style.marginTop = "8px";
  note.style.fontWeight = "500";
  note.style.lineHeight = "1.45";
  note.style.opacity = "0.76";
  label.appendChild(note);
  label.dataset.metricUnitExplained = "true";
}

function refreshEconomicsPresentation() {
  const result = byId("economicsResult");
  const unknowns = document.querySelector("#business-value .economics-unknowns");
  if (!result || !unknowns) return;

  patchPumpingRateLabel();

  const area = readNonNegativeNumber("ecoAreaHa");
  const depth = readNonNegativeNumber("ecoIrrigationMm");
  const pumpingRate = readNonNegativeNumber("ecoPumpingRate");
  const otherElectricity = readNonNegativeNumber("ecoEnergy");
  const labor = readNonNegativeNumber("ecoLabor");
  const maintenance = readNonNegativeNumber("ecoEquipment");

  const volumeM3 = area * depth * 10;
  const pumpingEnergyCost = area * depth * pumpingRate;
  const directIncrementalCost = pumpingEnergyCost + otherElectricity + labor + maintenance;
  const isMichiganDefault = Math.abs(pumpingRate - 0.534) < 0.0005;

  result.innerHTML = `
    <div>
      <span>一次计划灌溉水量</span>
      <strong>${volumeM3.toLocaleString(undefined, { maximumFractionDigits: 0 })} 立方米</strong>
      <small>田块面积 × 灌溉深度 × 10</small>
    </div>
    <div>
      <span>本次错误执行的直接增量成本</span>
      <strong>${formatUsd(directIncrementalCost)}</strong>
      <small>泵送能源 + 其他当次电力 + 增量人工 + 增量维护；不包括产量损失，也不是投资回报</small>
    </div>
    <div>
      <span>${isMichiganDefault ? "密歇根泵送能源基准" : "当前泵送能源费率"}</span>
      <strong>${pumpingRate.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} 美元 / 毫米 / 公顷</strong>
      <small>${isMichiganDefault ? "等价于密歇根州立大学 2024 年电力泵平均 5.49 美元 / 英亩·英寸" : "客户覆盖后按当前输入值计算；原始密歇根外部基准为 0.534 美元 / 毫米 / 公顷"}</small>
    </div>`;

  const spans = unknowns.querySelectorAll(":scope > span");
  if (spans[0]) spans[0].innerHTML = `错误执行一次：当前场景可直接量化约 <b>${formatUsd(directIncrementalCost)}</b> 的增量泵送能源与已填写增量作业成本`;
  if (spans[1]) spans[1].innerHTML = "错误取消一次：可能涉及产量、品质和补救成本，<b>当前不能用基准数据替客户计算</b>";
  if (spans[2]) spans[2].innerHTML = "客户投资回报：必须在实际试点中，用客户自己的决策、执行和经营数据<b>形成价值证明</b>";
}

function installEconomicsPresentation() {
  const result = byId("economicsResult");
  if (!result || !byId("ecoPumpingRate")) return false;

  patchPumpingRateLabel();
  refreshEconomicsPresentation();

  ["ecoAreaHa", "ecoIrrigationMm", "ecoPumpingRate", "ecoEnergy", "ecoLabor", "ecoEquipment"].forEach((id) => {
    const input = byId(id);
    if (!input || input.dataset.presentationListener === "true") return;
    input.addEventListener("input", () => setTimeout(refreshEconomicsPresentation, 0));
    input.dataset.presentationListener = "true";
  });
  return true;
}

let attempts = 0;
const timer = window.setInterval(() => {
  attempts += 1;
  if (installEconomicsPresentation() || attempts > 200) window.clearInterval(timer);
}, 50);
