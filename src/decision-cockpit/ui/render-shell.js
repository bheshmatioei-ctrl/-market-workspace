import { buildCockpitProjection, COCKPIT_PROJECTION_FEATURE } from "../projection/cockpit-projector.js";
import { COCKPIT_PROJECTION_SCENARIOS } from "../mocks/cockpit-projection-scenarios.js";
import { renderCockpitProjection } from "./render-projection.js";

const root = document.querySelector("#cockpit-root");
const modeBanner = document.querySelector("#mode-banner");
const projection = buildCockpitProjection(COCKPIT_PROJECTION_SCENARIOS.CONSTRUCTIVE_MARKET.input);

modeBanner.innerHTML = ["VALIDATION MODE", "SHADOW DATA", "NOT LIVE", "NOT PRODUCTION DECISION"]
  .map((label) => `<strong>${label}</strong>`).join("");
modeBanner.dataset.lifecycle = COCKPIT_PROJECTION_FEATURE.featureLifecycle;
root.innerHTML = renderCockpitProjection(projection);

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== button.dataset.view;
    });
  });
});
