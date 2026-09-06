# Execution 006 Report — Deterministic Stock Decision Intelligence

Status: IMPLEMENTED_PENDING_INDEPENDENT_REVIEW

Branch: `decision-cockpit-v1`

## 1. Execution Identity

- Required starting remote HEAD: `0f760d233aa27ffe6d6ff379197df0082766672b`
- Verified starting remote HEAD: `0f760d233aa27ffe6d6ff379197df0082766672b`
- Package 006 architecture authority commit: `0f760d233aa27ffe6d6ff379197df0082766672b`
- Package 006 implementation commit: `8a70d4e877bcea32021fe86e6ff36dbb16083de5`
- Verified main HEAD: `f4483cb2ce7d0eec2f05337a1d0b566d0b778afa`
- Main modified: no
- V5 modified: no

## 2. Exact Implementation Files Changed

1. `src/decision-cockpit/contracts/stock-decision-intelligence.js`
2. `src/decision-cockpit/contracts/types.js`
3. `src/decision-cockpit/contracts/validators.js`
4. `src/decision-cockpit/domain/constants.js`
5. `src/decision-cockpit/engines/rules/profiles.js`
6. `src/decision-cockpit/engines/stock-decision-engine.js`
7. `src/decision-cockpit/mocks/stock-decision-scenarios.js`
8. `src/decision-cockpit/state/feature-flags.js`
9. `src/decision-cockpit/tests/market-context-engines.test.js`
10. `src/decision-cockpit/tests/stock-decision-engine.test.js`

The execution report is intentionally excluded from the implementation commit.

## 3. Additive Contract Results

- `StockAnalysisSubject`: implemented with runtime validation, deterministic identity de-duplication, exact `MY_FOCUS` / `AI_DISCOVERED_SELECTED` origin rules, and explicit selection time.
- `StockDecisionContext`: implemented with runtime validation and canonical context arrays.
- `DecisionState.stockDecisionContext?`: implemented additively; legacy DecisionState records remain valid, while Package 006 outputs require the context.
- `StockSnapshot.sessionIdentity?`: implemented additively; current-only legacy snapshots remain readable and historical comparison requires complete explicit identity.
- Deterministic stock decision identity includes engine version, rule profile ID, evaluated time, subject ID, and symbol.
- Package 006 `UNKNOWN` is enforced as `GREY` with `score=null`.

## 4. Engine and Rule Profile

- Engine ID: `stock-decision-engine`
- Engine version: `0.6-shadow`
- Rule profile ID: `stock-decision.experimental.v0.6`
- Rule profile version: `0.6.0`
- Status: `EXPERIMENTAL`
- Lifecycle: `SHADOW`
- Deterministic: true
- Calibration declaration: `SYNTHETIC`, `EXPERIMENTAL`, `NOT PRODUCTION-CALIBRATED`, `NOT EMPIRICALLY VALIDATED`

No production analytical weights or production calibration claims were introduced.

## 5. Selection Boundary

- Explicit `MY_FOCUS` subject: accepted.
- Explicit `AI_DISCOVERED_SELECTED` subject: accepted only with a supplied approved matching `DiscoveryCandidate`.
- Missing candidate: rejected.
- Candidate/subject symbol mismatch: rejected.
- Unselected DiscoveryCandidate: produces no stock decision.
- Automatic promotion: rejected/not implemented.
- Provider-created or implicit selection: not implemented.

## 6. State Classification Results

The deterministic engine emits only the authorized analytical classifications:

- `ACCUMULATION`: covered and passing.
- `BUY_PRESSURE`: covered and passing.
- `NEUTRAL`: covered and passing only with sufficient valid evidence.
- `CONFLICTED`: covered and passing with supporting and opposing evidence retained.
- `DISTRIBUTION`: covered and passing.
- `SELL_PRESSURE`: covered and passing.
- `WAIT_EVENT_RISK`: covered and passing for eligible HIGH/CRITICAL symbol events.
- `UNKNOWN`: covered and passing with `GREY` and `score=null`.

These states do not create or imply BUY/SELL orders, entries, exits, targets, stops, position sizing, broker actions, or Trade Decision Zones.

## 7. Evidence and Context Results

- Multiple evidence families are required; a single metric cannot produce ACCUMULATION/DISTRIBUTION.
- Supporting and opposing evidence are provenance-de-duplicated and ordered by `evidenceId`.
- Same identity plus conflicting canonical bytes fails closed.
- Approved MARKET DecisionState is consumed without mutation or regime recalculation.
- `30m`, `60m`, `120m`, and `SESSION` direction horizons remain separate and canonically ordered.
- Sector state is contextual only; it cannot dictate stock state by itself.
- DIRECT and PROXY FlowAssessment evidence remain provenance-distinct.
- Stock volume and dollar volume do not become measured net cash flow.
- Market, direction, sector, and flow contradictions remain visible.

## 8. Catalyst Event Risk

- Eligible HIGH event: may emit `WAIT_EVENT_RISK`.
- Eligible CRITICAL event: may emit `WAIT_EVENT_RISK`.
- LOW event alone: cannot force `WAIT_EVENT_RISK`.
- Unrelated-symbol event: ignored for the subject.
- Known future scheduled event: represented only as pending-risk evidence.
- Known future scheduled event is not treated as an occurred factual event.

## 9. Freshness and Time Integrity

- Stale stock evidence cannot drive a directional state.
- Missing or unavailable critical stock evidence returns `UNKNOWN/GREY/score=null`.
- Stale context is excluded or explicitly degrades confidence.
- Missing freshness is never treated as LIVE.
- Future subject selection, snapshot, MARKET decision, direction, sector, flow, catalyst fact, discovery candidate, source observation, and source receipt are rejected.
- No interpolation or forward tolerance was introduced.

## 10. Historical Session Integrity

- Historical reference timestamp must be strictly earlier than the current snapshot.
- Current snapshot must be at or before explicit `evaluatedAt`.
- Historical and current snapshots require matching explicit `sessionDate`, `sessionPhase`, and `sessionCalendarId`.
- Missing historical SessionIdentity fails closed.
- Cross-session history fails closed.
- Equal-time historical references fail closed.
- Duplicate snapshot identity with identical bytes may de-duplicate.
- Duplicate snapshot identity with conflicting bytes fails closed.

## 11. Determinism

- Same semantic normalized inputs, evaluatedAt, profile, and engine version produce the same decision IDs and byte-identical canonical output.
- Reordered semantically unordered inputs produce identical canonical output.
- Subject, snapshot, direction, sector, flow, catalyst, discovery, evidence, and context ordering follow the authority-defined deterministic order.
- No randomness, process-local IDs, locale-dependent ordering, or implicit system-time dependency was introduced.

## 12. Mock Scenarios

All 24 required scenarios were implemented and carry the exact notice `MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA`:

1. `ACCUMULATION_CONFIRMED`
2. `BUY_PRESSURE_CONFIRMED`
3. `NEUTRAL_BALANCED`
4. `CONFLICTED_STOCK_VS_MARKET`
5. `CONFLICTED_STOCK_VS_SECTOR`
6. `DISTRIBUTION_CONFIRMED`
7. `SELL_PRESSURE_CONFIRMED`
8. `WAIT_EVENT_RISK_EARNINGS`
9. `MISSING_RELATIVE_VOLUME`
10. `MISSING_VWAP`
11. `STALE_STOCK_DATA`
12. `STALE_MARKET_CONTEXT`
13. `MARKET_RISK_ON_CONFIRMATION`
14. `MARKET_RISK_OFF_CONFLICT`
15. `SECTOR_CONFIRMATION`
16. `SECTOR_DIVERGENCE`
17. `RELATIVE_STRENGTH_CONFIRMATION`
18. `RELATIVE_STRENGTH_DIVERGENCE`
19. `VWAP_RECLAIM_CONTEXT`
20. `VWAP_BREAKDOWN_CONTEXT`
21. `MY_FOCUS_SUBJECT`
22. `AI_DISCOVERED_SELECTED_SUBJECT`
23. `AI_DISCOVERED_NOT_SELECTED_REJECTION`
24. `DETERMINISTIC_ORDERING`

## 13. Validation Results

Command:

```text
npm_config_offline=true npm run check
```

Results:

- Baseline before implementation: 193 passed, 0 failed, 0 skipped.
- Package 006 tests added: 30.
- Final total: 223 passed, 0 failed, 0 skipped.
- Build: PASS.
- Architecture guard: PASS.
- V5 integrity: PASS.
- Package 001 regression: PASS.
- Package 002 regression: PASS.
- Package 003 regression: PASS.
- Package 004 regression: PASS.
- Package 005 regression: PASS.

The only console note was the pre-existing non-blocking npm warning for the environment's `http-proxy` configuration; it did not affect tests, architecture guard, or build.

## 14. Lifecycle and Forbidden Scope

- Stock Decision Engine lifecycle: SHADOW.
- Package 006 ACTIVE features: none.
- Production composite influence: false.
- Stock Decision UI: not added.
- Trade Decision Zones: not added.
- Options contracts/analytics: not added.
- PredictionRecord issuance/outcome processing: not added.
- Model Test functionality: not added.
- Live provider, scraping, API key, broker connectivity/execution: not added.
- ML, neural network, LLM narrative, AI-created numeric market data: not added.
- Deployment: not performed.
- Package 007 work: none.

## 15. Options Evidence Status

```text
OPTIONS_EVIDENCE:
  status: DEFERRED
  reason: NO_APPROVED_NORMALIZED_OPTIONS_CONTRACT
```

## 16. Architectural Deviations

None.

## 17. Unresolved Issues

None.

## 18. Next Recommended Action

Perform an independent architecture/code/test review of implementation commit
`8a70d4e877bcea32021fe86e6ff36dbb16083de5` and this report. Package 006 must
remain `IMPLEMENTED_PENDING_INDEPENDENT_REVIEW`. Package 007 remains
unauthorized and no execution should auto-continue.
