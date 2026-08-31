import { mockCockpitState, predictionRecordFixture } from "../mocks/fixtures.js";
import { DEFAULT_FEATURE_FLAGS } from "../state/feature-flags.js";

const root = document.querySelector("#cockpit-root");
const modeBanner = document.querySelector("#mode-banner");

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const stateClass = (state) => `state-${String(state).toLowerCase().replaceAll("_", "-")}`;
const status = (state, label = state) => `<span class="status ${stateClass(state)}">${escapeHtml(label)}</span>`;
const percent = (score) => `${Math.round(score * 100)}%`;
const measurement = (item) => item?.value === null || item == null
  ? `Unavailable${item?.missingReason ? ` — ${escapeHtml(item.missingReason)}` : ""}`
  : `${Number(item.value).toLocaleString("en-US")} ${escapeHtml(item.unit)}`;

function evidenceDetails(label, value) {
  return `<details><summary>${escapeHtml(label)}</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details>`;
}

function panel(title, content, size = "") {
  return `<section class="panel ${size}"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function tableForStocks(stocks) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Symbol</th><th>Status</th><th>Price</th><th>Change</th><th>RVOL</th><th>Freshness</th></tr></thead>
    <tbody>${stocks.map((stock) => `<tr>
      <td><strong>${escapeHtml(stock.symbol)}</strong></td>
      <td>${status(stock.mockPresentationState)}</td>
      <td>${measurement(stock.price)}</td>
      <td>${measurement(stock.changePct)}</td>
      <td>${measurement(stock.relativeVolume)}</td>
      <td>${status(stock.freshness.status)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderLiveMarket(state) {
  const market = state.selectedMarket;
  const decision = state.marketDecision;
  const directionMetrics = Object.entries(state.directions).map(([horizon, direction]) => `
    <div class="metric"><span>${escapeHtml(horizon)}</span><strong class="${stateClass(direction)}">${escapeHtml(direction)}</strong></div>`).join("");
  const assetFlows = state.assetFlows.map((flow) => `
    <div class="flow-row">
      <span class="flow-kind ${flow.flowType.toLowerCase()}">${escapeHtml(flow.flowType)}</span>
      <span>${flow.flowValue ? measurement(flow.flowValue) : status(flow.proxyState)}</span>
      <span>${escapeHtml(flow.flowPeriod)} · ${percent(flow.confidence.score)} confidence</span>
    </div>`).join("");
  const globalRows = state.globalCapital.map((country) => `
    <div class="flow-row">
      <strong>${escapeHtml(country.countryOrRegion)}</strong>
      <span>${status(country.compositeState)}</span>
      <span>${country.directFlowAvailable ? `DIRECT ${measurement(country.equityFlowValue)}` : `PROXY ONLY · ${percent(country.confidence.score)}`}</span>
    </div>`).join("");
  const placeholders = state.placeholders.map((name) => `<div class="placeholder"><strong>${escapeHtml(name)}</strong><span>Foundation placeholder — no analytical engine connected.</span></div>`).join("");

  return `<section class="view" data-view-panel="live-market">
    <div class="view-heading"><h2>Live Market — Static normalized-state shell</h2><span class="timestamp">Fixture timestamp: ${escapeHtml(market.timestamp)}</span></div>
    <div class="grid">
      ${panel("Market State", `
        <div class="primary-state">${status(decision.trafficLight)}<strong>${escapeHtml(decision.state)}</strong></div>
        <p class="explain">${escapeHtml(decision.confidence.reasons[0])}</p>
        <p class="explain">Confidence: <strong class="confidence">${percent(decision.confidence.score)}</strong> · Freshness: ${escapeHtml(decision.freshness.status)}</p>
        ${evidenceDetails("Inspect supporting and opposing evidence", { supporting: decision.supportingEvidence, opposing: decision.opposingEvidence })}
      `)}
      ${panel("Market Direction", `<div class="metric-grid">${directionMetrics}</div><p class="explain">Horizons remain independent; UNKNOWN is not coerced to neutral.</p>`)}
      ${panel("Raw Market Values", `<div class="metric-grid">
        <div class="metric"><span>SPY</span><strong>${measurement(market.spy)}</strong></div>
        <div class="metric"><span>QQQ</span><strong>${measurement(market.qqq)}</strong></div>
        <div class="metric"><span>VIX</span><strong>${measurement(market.vix)}</strong></div>
        <div class="metric"><span>UST 10Y</span><strong>${measurement(market.ust10y)}</strong></div>
      </div>${evidenceDetails("Inspect normalized MarketSnapshot", market)}`)}
      ${panel("US Asset Flow", `<div class="notice">DIRECT measured flow and PROXY participation evidence are displayed separately. Proxy evidence is never converted into a cash-flow number.</div><div class="flow-stack">${assetFlows}</div>${evidenceDetails("Inspect flow provenance", state.assetFlows)}`, "wide")}
      ${panel("Global Capital Rotation summary", `<div class="flow-stack">${globalRows}</div>${evidenceDetails("Inspect country evidence", state.globalCapital)}`)}
      ${panel("My Focus", `${tableForStocks(state.focusStocks)}${evidenceDetails("Inspect My Focus normalized snapshots", state.focusStocks)}`, "wide")}
      ${panel("AI Discovered", `${tableForStocks(state.discoveredStocks)}${evidenceDetails("Inspect AI Discovered normalized snapshots", state.discoveredStocks)}`, "full")}
      ${panel("Architecture placeholders", `<div class="placeholder-list">${placeholders}</div>`, "full")}
    </div>
  </section>`;
}

function renderPremarket(state) {
  const item = state.premarket;
  return `<section class="view" data-view-panel="premarket" hidden>
    <div class="view-heading"><h2>Premarket</h2><span class="timestamp">Frozen mock sub-window: ${escapeHtml(item.timestamp)}</span></div>
    <div class="grid">
      ${panel("Premarket State", `<div class="primary-state">${status(item.compositeState)}<strong>${escapeHtml(item.directionState)}</strong></div><p class="explain">Confidence: <strong class="confidence">${percent(item.confidence.score)}</strong></p>${evidenceDetails("Inspect PremarketSnapshot", item)}`)}
      ${panel("Sub-state evidence", `<div class="metric-grid">
        <div class="metric"><span>Futures</span><strong>${status(item.futuresState)}</strong></div>
        <div class="metric"><span>Macro risk</span><strong>${status(item.macroRiskState)}</strong></div>
        <div class="metric"><span>Global market</span><strong>${status(item.globalMarketState)}</strong></div>
        <div class="metric"><span>Participation</span><strong>${status(item.participationState)}</strong></div>
      </div>`)}
      ${panel("Scheduled risk", `<div class="notice">Mock event remains unreleased; confidence is reduced. No opening scenario or prediction algorithm is implemented in Package 001.</div>`)}
      ${panel("My Focus — Premarket", tableForStocks(item.focusStocks), "wide")}
      ${panel("AI Discovered — Premarket", tableForStocks(item.discoveredStocks), "full")}
    </div>
  </section>`;
}

function renderGlobalFlow(state) {
  const rows = state.globalCapital.map((country) => `<tr>
    <td><strong>${escapeHtml(country.countryOrRegion)}</strong></td>
    <td>${country.directFlowAvailable ? measurement(country.equityFlowValue) : "UNAVAILABLE"}</td>
    <td>${status(country.proxyRotationState)}</td>
    <td>${status(country.fxState)}</td>
    <td>${status(country.sovereignBondState)}</td>
    <td>${status(country.compositeState)}</td>
    <td>${percent(country.confidence.score)}</td>
    <td>${escapeHtml(country.horizon)}</td>
  </tr>`).join("");
  return `<section class="view" data-view-panel="global-flow" hidden>
    <div class="view-heading"><h2>Global Capital Rotation</h2><span class="timestamp">Mixed-quality mock evidence</span></div>
    <div class="grid">${panel("Direct vs proxy country evidence", `<div class="notice">Structural/direct measurements and market-derived proxies remain distinct and frequency-labelled.</div><div class="table-wrap"><table>
      <thead><tr><th>Country / Region</th><th>Direct equity flow</th><th>Proxy rotation</th><th>FX</th><th>Bonds</th><th>Composite</th><th>Confidence</th><th>Horizon</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${evidenceDetails("Inspect all CountryFlowSnapshots", state.globalCapital)}`, "full")}</div>
  </section>`;
}

function renderModelTest() {
  const flags = Object.entries(DEFAULT_FEATURE_FLAGS).map(([name, lifecycle]) => `<tr><td>${escapeHtml(name)}</td><td>${status(lifecycle, lifecycle)}</td><td>${lifecycle === "ACTIVE" ? "May influence composite" : "Cannot influence composite"}</td></tr>`).join("");
  return `<section class="view" data-view-panel="model-test" hidden>
    <div class="view-heading"><h2>Model Test Foundation</h2><span class="timestamp">Storage interfaces only</span></div>
    <div class="grid">
      ${panel("Immutable PredictionRecord", `<div class="notice">No prediction algorithm is active. This record exists only to validate immutable storage and schema boundaries.</div>${evidenceDetails("Inspect storage-only fixture", predictionRecordFixture)}`, "wide")}
      ${panel("Outcomes", `<div class="empty-state"><div><strong>No evaluated outcomes</strong><br><span>Failed outcomes cannot be deleted through the normal store API.</span></div></div>`)}
      ${panel("Feature lifecycle", `<div class="table-wrap"><table><thead><tr><th>Feature</th><th>State</th><th>Composite effect</th></tr></thead><tbody>${flags}</tbody></table></div>`, "full")}
    </div>
  </section>`;
}

function render() {
  modeBanner.textContent = mockCockpitState.modeLabel;
  root.innerHTML = [
    renderLiveMarket(mockCockpitState),
    renderPremarket(mockCockpitState),
    renderGlobalFlow(mockCockpitState),
    renderModelTest(),
  ].join("");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-view-panel]").forEach((panelElement) => {
      panelElement.hidden = panelElement.dataset.viewPanel !== button.dataset.view;
    });
  });
});

render();

