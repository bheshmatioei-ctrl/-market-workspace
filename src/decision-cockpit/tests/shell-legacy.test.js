import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("mock cockpit shell contains required navigation and panels without network data", async () => {
  const html = await readFile(path.join(repositoryRoot, "decision-cockpit.html"), "utf8");
  const renderer = await readFile(path.join(repositoryRoot, "src/decision-cockpit/ui/render-shell.js"), "utf8");
  const fixtures = await readFile(path.join(repositoryRoot, "src/decision-cockpit/mocks/fixtures.js"), "utf8");
  const shellSource = html + renderer + fixtures;
  for (const label of ["LIVE MARKET", "PREMARKET", "GLOBAL FLOW", "MODEL TEST"]) assert.match(html, new RegExp(label));
  for (const panel of ["Market State", "Market Direction", "US Asset Flow", "Global Capital Rotation summary", "Money Flow", "Live Alerts", "My Focus", "AI Discovered", "Market Internals", "Macro / Risk", "Decision Timeline"]) assert.ok(shellSource.includes(panel), `missing ${panel}`);
  assert.match(shellSource, /MOCK/);
  assert.doesNotMatch(shellSource, /https?:\/\//i);
  assert.doesNotMatch(renderer, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
});

test("legacy V5 static entry remains intact and independent", async () => {
  const legacy = await readFile(path.join(repositoryRoot, "index.html"), "utf8");
  assert.match(legacy, /Market Research Workspace — V5\.1/);
  assert.match(legacy, /id="ws"/);
  assert.match(legacy, /mw-v51/);
  assert.doesNotMatch(legacy, /decision-cockpit/i);
});
