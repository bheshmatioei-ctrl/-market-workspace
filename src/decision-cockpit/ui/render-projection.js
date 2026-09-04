import { validateContract } from "../contracts/validators.js";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const badge = (value) => `<span class="status">${escapeHtml(value ?? "UNAVAILABLE")}</span>`;
const list = (items, empty = "UNAVAILABLE") => items?.length
  ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
  : `<p class="empty-state">${escapeHtml(empty)}</p>`;

function evidenceInspector(title, value) {
  return `<details class="evidence-inspector"><summary>${escapeHtml(title)}</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details>`;
}
function panel(title, content, size = "") {
  return `<section class="panel ${size}"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}
function stateCard(label, item) {
  if (!item) return panel(label, `<p class="empty-state">UNAVAILABLE</p>`);
  const state = item.trafficLight ?? item.state ?? item.direction ?? item.compositeState ?? "UNAVAILABLE";
  return panel(label, `${badge(state)}${evidenceInspector("Inspect approved evidence", item)}`);
}

export function renderLiveMarket(projection) {
  const { market, discovery } = projection;
  return `<section class="view" data-view-panel="live-market">
    <div class="view-heading"><h2>LIVE MARKET</h2><span>${escapeHtml(projection.generatedAt)}</span></div><div class="grid">
      ${stateCard("Market Regime", market.regime)}
      ${panel("Market Direction", market.directions.map((item) => `<div class="metric"><span>${escapeHtml(item.horizon)}</span>${badge(item.trafficLight)}<strong>${escapeHtml(item.direction)}</strong>${evidenceInspector(`${item.horizon} evidence`, item)}</div>`).join("") || `<p class="empty-state">UNAVAILABLE</p>`, "wide")}
      ${panel("Money Flow", market.flow.map((item) => `${badge(item.state)}<strong>${escapeHtml(item.scopeId)}</strong>${evidenceInspector("Flow evidence", item)}`).join("") || `<p class="empty-state">UNAVAILABLE</p>`)}
      ${panel("Alerts", market.alerts.map((item) => `<div class="alert-row">${badge(item.severity)}<strong>${escapeHtml(item.symbol ?? "MARKET")}</strong><span>${escapeHtml(item.type)}</span>${evidenceInspector("Alert evidence", item)}</div>`).join("") || `<p class="empty-state">UNAVAILABLE</p>`)}
      ${panel("AI Discovered", discovery.candidates.map((item) => `<div class="candidate-row"><strong>${escapeHtml(item.symbol)}</strong>${list(item.anomalyTypes)}${evidenceInspector("Discovery evidence", item)}</div>`).join("") || `<p class="empty-state">UNAVAILABLE</p>`, "wide")}
      ${panel("MY FOCUS", `<p>Analysis engine not yet authorized</p>`, "wide")}
      ${panel("Market Internals", evidenceInspector("Display evidence only", projection.displayEvidence ?? {}), "full")}
      ${panel("Freshness", projection.freshnessSummary.map((item) => `<div class="flow-row"><strong>${escapeHtml(item.sourceObjectId)}</strong>${badge(item.status)}<span>${escapeHtml(item.reason)}</span></div>`).join("") || `<p class="empty-state">UNAVAILABLE</p>`, "full")}
      ${panel("Conflicts", projection.conflicts.map((item) => `<div class="conflict-label">CONFLICT</div>${evidenceInspector(item.description, item)}`).join("") || `<p class="empty-state">No explicit conflict supplied</p>`, "wide")}
      ${panel("Warnings", projection.warnings.map((item) => `<p>${escapeHtml(item.message)}</p>`).join("") || `<p class="empty-state">No explicit warning supplied</p>`)}
    </div></section>`;
}

export function renderPremarket(projection) {
  const { snapshot, windows } = projection.premarket;
  const frozen = snapshot?.freezeStatus === "FROZEN"
    ? `<div class="freeze-banner"><strong>FINAL PREMARKET SNAPSHOT</strong><span>FROZEN AT OPEN</span><span>${escapeHtml(snapshot.frozenAt)}</span></div>` : "";
  return `<section class="view" data-view-panel="premarket" hidden><div class="view-heading"><h2>PREMARKET</h2></div>${frozen}<div class="grid">
      ${stateCard("Premarket State", snapshot)}
      ${panel("Session Windows", windows.map((item) => `<div class="metric"><span>${escapeHtml(item.window)}</span>${badge(item.state)}<strong>${escapeHtml(item.direction)}</strong>${evidenceInspector("Window evidence", item)}</div>`).join("") || `<p class="empty-state">UNAVAILABLE</p>`, "wide")}
      ${panel("Futures State", snapshot ? badge(snapshot.futuresState) : `<p class="empty-state">UNAVAILABLE</p>`)}
      ${panel("Participation Proxy", snapshot ? badge(snapshot.participationState) : `<p class="empty-state">UNAVAILABLE</p>`)}
      ${panel("Global Context", snapshot ? badge(snapshot.globalMarketState) : `<p class="empty-state">UNAVAILABLE</p>`)}
      ${panel("Scheduled Event Risk", snapshot ? `${list(snapshot.scheduledEventIds, "UNKNOWN / UNAVAILABLE")}${evidenceInspector("Premarket provenance", snapshot)}` : `<p class="empty-state">UNAVAILABLE</p>`)}
    </div></section>`;
}

export function renderGlobalCapital(projection) {
  const cards = projection.globalCapital.assessments.map((item) => panel(`${item.countryOrRegion} — ${item.horizon}`, `${badge(item.trafficLight)}<p>${escapeHtml(item.state)}</p><p>Confidence: ${escapeHtml(item.confidence.score)}</p><p>Freshness: ${escapeHtml(item.freshness.status)}</p>${evidenceInspector("Direct, proxy and opposing evidence", item)}`)).join("");
  return `<section class="view" data-view-panel="global-capital" hidden><div class="view-heading"><h2>GLOBAL CAPITAL</h2></div><div class="grid">${cards || panel("Global Capital", `<p class="empty-state">UNAVAILABLE</p>`)}</div></section>`;
}

export function renderUsAssetFlows(projection) {
  const rows = projection.market.assetFlow.map((item) => {
    const direct = item.directFlowValue === null ? "Unavailable" : `${escapeHtml(item.directFlowValue)} ${escapeHtml(item.currency ?? "")}`;
    return `<article class="flow-card"><h4>${escapeHtml(item.scopeId)}</h4>
      <div class="flow-channel"><strong>DIRECT / MEASURED</strong><span>${direct}</span>${evidenceInspector("Direct evidence", item.directEvidence)}</div>
      <div class="flow-channel"><strong>PROXY / INFERRED</strong><span>${escapeHtml(item.proxyState ?? "Unavailable")}</span>${evidenceInspector("Proxy evidence", item.proxyEvidence)}</div>
      ${item.opposingEvidence?.length ? `<div class="conflict-label">CONFLICT</div>${evidenceInspector("Opposing evidence", item.opposingEvidence)}` : ""}</article>`;
  }).join("");
  return `<section class="view" data-view-panel="us-asset-flows" hidden><div class="view-heading"><h2>US ASSET FLOWS</h2></div><div class="grid">${rows || panel("US Asset Flows", `<p class="empty-state">UNAVAILABLE</p>`)}</div></section>`;
}

export function renderModelTestPlaceholder() {
  return `<section class="view" data-view-panel="model-test" hidden><div class="view-heading"><h2>MODEL TEST</h2></div><div class="empty-state">Functionality not authorized in Package 005.</div></section>`;
}

export function renderCockpitProjection(projection) {
  validateContract("CockpitProjection", projection);
  return [renderLiveMarket(projection), renderPremarket(projection), renderGlobalCapital(projection), renderUsAssetFlows(projection), renderModelTestPlaceholder()].join("");
}
