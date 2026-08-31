# Market Decision Intelligence System — Product Specification v1

Status: DRAFT BASELINE
Branch: decision-cockpit-v1
Purpose: Build a new Decision Cockpit in parallel with the frozen V5 workspace. Do not modify the current production experience until the new system is validated.

## 1. Product Goal

Build an always-on market decision intelligence screen that converts fragmented market information into a coherent, inspectable, low-latency view of:

1. Current US market state.
2. Direction of change over 30m / 60m / 120m / session.
3. Capital flow by sector and market segment.
4. Abnormal stock behavior and emerging opportunities/risks.
5. Deep analysis of user-selected focus stocks.
6. Event and catalyst risk.
7. Portfolio context.
8. A separate model-validation lab that tests predictions without influencing real decisions.

The system must expose raw data, its own analysis, and a fast visual status layer. It must never hide the underlying evidence.

## 2. Non-Goals

- Not an automated trading bot.
- Not a broker execution system.
- Not a black-box buy/sell signal product.
- Not a replacement for primary data sources.
- Not a redesign of the current V5 workspace during the validation phase.
- Not a generic dashboard containing unrelated widgets.

## 3. Core UX Principle

Every important market object should be represented in three simultaneous layers:

RAW DATA -> SYSTEM INTERPRETATION -> VISUAL STATE

Visual states:
- GREEN: constructive / accumulation / favorable confirmation.
- ORANGE: mixed / caution / transition / conditional.
- RED: distribution / deterioration / risk.
- GREY: insufficient evidence / data unavailable / no valid conclusion.

The color is a summary, never the evidence itself.

## 4. System Architecture

The product is composed of eight coordinated engines. They share a common data model and timestamped market state. Engines must not silently override each other; conflicts are surfaced explicitly.

### 4.1 Market Regime Engine

Purpose: classify the overall US market environment.

Inputs include:
- SPY / QQQ / IWM / DIA.
- Advance/Decline.
- Up Volume / Down Volume.
- New Highs / New Lows.
- Percentage above 50DMA / 200DMA when available.
- VIX.
- Treasury yields.
- Credit/risk proxies when available.
- Sector participation.

Outputs:
- Strong Risk-On / Risk-On / Neutral / Risk-Off / Strong Risk-Off.
- Numeric score.
- Confidence score.
- Supporting and opposing evidence.

### 4.2 Market Direction Engine

Purpose: detect whether market conditions are improving or deteriorating, rather than only reporting the current level.

Required horizons:
- 30 minutes.
- 60 minutes.
- 120 minutes.
- Session.

Track change in:
- Breadth.
- Up/Down volume.
- SPY/QQQ relative to VWAP.
- VIX.
- Rates.
- Sector participation.

Outputs:
- Improving / Stable / Deteriorating.
- Rate of deterioration/improvement.
- Capital inflow/outflow bias only when evidence is sufficient.

### 4.3 Money Flow Engine

Purpose: identify where market participation and relative demand are concentrating.

Analyze:
- Sectors.
- Semiconductors.
- Mega-cap technology.
- Financials.
- Energy.
- Industrials.
- Small caps.
- Defensive sectors.

Primary evidence:
- Price trend.
- Relative volume.
- Relative strength versus broad index.
- Breadth/participation inside the group.

Output example:
Semiconductors: GREEN / strong inflow candidate
Small Caps: RED / broad relative weakness

Do not label price declines alone as capital outflow.

### 4.4 Anomaly Radar

Purpose: scan a broad universe cheaply and surface only unusual behavior.

Detect:
- Relative volume spikes.
- Gap moves.
- VWAP breaks/reclaims.
- Breakouts/breakdowns.
- Relative-strength changes.
- Sector confirmation/divergence.
- Abnormal volume with failed price confirmation.
- News/catalyst events.

Output:
- Timestamp.
- Symbol.
- Event type.
- Raw measurements.
- Interpretation.
- Severity.
- Confidence.

### 4.5 Stock Decision Engine

Purpose: deeply analyze a limited set of user-selected Focus stocks plus selected anomaly candidates.

User may choose approximately 3–20 Focus stocks.

For each stock display:
- Price change.
- Relative volume.
- VWAP state.
- Relative strength vs relevant benchmark.
- Sector strength.
- Market regime context.
- Options data when available.
- News / SEC / earnings risk.
- Technical structure.

Output states:
- Accumulation.
- Buy Pressure.
- Neutral.
- Conflicted.
- Distribution.
- Sell Pressure.
- Wait — Event Risk.

Never emit an unexplained BUY/SELL command.

### 4.6 Trade Decision Zones

Purpose: generate testable, conditional market zones rather than deterministic trade commands.

Possible outputs:
- Opportunity Zone.
- Conditional Zone.
- Partial Profit Zone.
- Exit Risk Zone.
- Hold Condition.
- Invalidation Level.

Each zone must include:
- Price range.
- Valid time window or horizon.
- Supporting conditions.
- Invalidation condition.
- Confidence.
- Reasoning summary.

Zones are dynamic and may be suspended when conditions change.

### 4.7 Event & Catalyst Engine

Purpose: connect scheduled/unscheduled catalysts to current decisions.

Track:
- Fed events.
- CPI/PCE/Jobs/ISM/JOLTS and other macro releases.
- Treasury auctions where relevant.
- Earnings.
- Company guidance.
- SEC filings.
- Material company news.
- Geopolitical catalysts.

Outputs:
- Next high-impact event.
- Countdown.
- Affected sectors/stocks.
- Risk level.
- Whether an existing signal should be considered temporarily unreliable.

### 4.8 Portfolio Context Engine

Purpose: prevent a strong single-stock signal from being interpreted without portfolio exposure context.

Inputs when the user chooses to provide them:
- Holdings.
- Sector exposure.
- Cash.
- Concentration.

Outputs:
- Exposure warnings.
- Concentration warnings.
- Correlated-risk warnings.

Principle:
Good stock signal != automatically good portfolio decision.

## 5. Focus Watchlist + Auto Discovery

The system has two parallel streams:

### MY FOCUS
User-selected stocks monitored deeply and continuously.

### AI DISCOVERED
Stocks surfaced automatically by the broad-market anomaly scanner.

Flow:
WHOLE MARKET -> LIGHT SCANNER -> ANOMALIES -> DEEP ANALYSIS -> COCKPIT

The user can promote an AI-discovered name into My Focus.

## 6. Model Test Lab

This is separate from the decision cockpit and exists only to test whether the system actually has predictive value.

### 6.1 Prediction Record

Each prediction must be immutable after issuance.

Required fields:
- Prediction ID.
- Timestamp.
- Symbol.
- Market regime at issuance.
- Direction prediction.
- Reference price.
- Expected range/magnitude.
- Horizon: 30m / 60m / 120m / close / other defined horizon.
- Confidence.
- Evidence snapshot.
- Model version.

### 6.2 Outcome Record

After the prediction horizon expires, store:
- Actual price change.
- Direction result.
- Magnitude error.
- Max favorable excursion.
- Max adverse excursion.
- Pass/fail according to predeclared rule.

### 6.3 Validation Metrics

Track:
- Directional accuracy.
- Magnitude error.
- Calibration by confidence bucket.
- False positive rate.
- False negative rate.
- Performance by time horizon.
- Performance by market regime.
- Performance by sector.
- Performance by symbol.

### 6.4 Benchmarks

Compare the model against simple baselines:
- 50/50 random directional baseline.
- Simple momentum continuation.
- Broad-index direction baseline.

The model has no demonstrated edge unless it beats relevant baselines out-of-sample.

### 6.5 Anti-Bias Rules

- No editing predictions after issuance.
- No deleting failed predictions from statistics.
- Store model version with every prediction.
- Separate development and evaluation periods where possible.
- Do not use future information in features.
- Surface data gaps and invalid observations.

## 7. Main Decision Cockpit Layout

Top row:
- Market State.
- 30m / 60m / 2h direction.
- Capital Flow state.
- Next high-impact catalyst + countdown.

Primary body:
- Money Flow Map.
- Live Alert Stream.
- My Focus decision table.
- AI Discovered list.
- Market Internals.
- Macro/Risk panel.
- Decision Timeline.

Persistent action:
- One-click MODEL TEST button opens Model Test Lab.

The page should emphasize exceptions. Normal conditions remain visually quiet; abnormal conditions attract attention.

## 8. Decision Timeline

Maintain an intraday timeline of regime-relevant changes, for example:
- Open: Risk-Off.
- Semiconductor breadth improves.
- QQQ reclaims VWAP.
- Nasdaq A/D improves.
- 10Y yield drops.
- Market State changes from Risk-Off to Neutral.

This allows the user to see not only current state but how the market arrived there.

## 9. Scoring Philosophy

Initial scores may use weighted evidence, but weights are provisional and must be validated empirically.

Candidate dimensions:
- Trend.
- Volume.
- Relative Strength.
- Sector Confirmation.
- Market Breadth.
- Volatility/Rates.
- Options.
- News/Catalyst.

Rules:
- No single metric may dominate by default without evidence.
- Conflicting signals must produce CONFLICTED/ORANGE rather than forced certainty.
- Missing data should reduce confidence or produce GREY, not be silently imputed as positive/negative.

## 10. Data Quality and Source Policy

Every metric should have:
- Primary source.
- Backup source where practical.
- Timestamp.
- Freshness threshold.
- Staleness state.

Primary/official sources should be used where possible for:
- Exchanges.
- SEC filings.
- Federal Reserve/macroeconomic data.
- Futures/exchange data.

Third-party aggregators may be used for convenience but must not silently override fresher primary data.

## 11. Time Integrity

All displayed market information must make time explicit.

The UI should distinguish:
- LIVE.
- DELAYED.
- LAST UPDATE.
- STALE.

Market conclusions must be recalculated when material inputs become stale.

## 12. Validation-First Development Plan

### Phase 0 — Freeze Existing V5
- Keep current public V5 unchanged.
- Treat main as control baseline.
- New work occurs on isolated branch.

### Phase 1 — Data Contracts + State Model
Define normalized schemas for:
- MarketSnapshot.
- BreadthSnapshot.
- SectorSnapshot.
- StockSnapshot.
- CatalystEvent.
- Alert.
- DecisionState.
- PredictionRecord.
- PredictionOutcome.

No UI implementation before these contracts are stable.

### Phase 2 — Deterministic Engines
Implement rule-based first versions of:
- Market Regime.
- Direction.
- Money Flow.
- Anomaly detection.

The initial version should be explainable and testable before adding AI narrative interpretation.

### Phase 3 — Cockpit UI
Build the one-screen Decision Cockpit from normalized engine outputs.

### Phase 4 — Focus Stock Analysis
Add deep per-stock analysis and conditional Trade Decision Zones.

### Phase 5 — Model Test Lab
Add immutable predictions, outcome scoring, calibration and benchmark comparison.

### Phase 6 — AI Interpretation Layer
Add textual synthesis only after deterministic/raw layers are working. AI should explain and synthesize; it must not fabricate missing market data.

### Phase 7 — Parallel Validation
Run old V5 and new Decision Cockpit in parallel.

Evaluate:
- Information speed.
- Cognitive load.
- Signal consistency.
- Prediction accuracy.
- False alerts.
- Stability.

Only then decide whether to replace, merge, or discard the new system.

## 13. Architectural Invariants

1. Existing V5 remains untouched during initial development.
2. Raw data is always inspectable beside derived conclusions.
3. Every conclusion carries timestamp and confidence.
4. Prediction history is immutable.
5. Failed predictions remain in statistics.
6. Missing/stale data cannot silently become a directional signal.
7. User-selected Focus and AI-discovered opportunities remain distinct.
8. Market-wide state and stock-specific state remain distinct.
9. Short-horizon and session/swing interpretations remain distinct.
10. AI narrative cannot override deterministic market data without explicitly marking disagreement.
11. No real-money execution capability in v1.
12. New features must fit this architecture; no disconnected widget accumulation.

## 14. First Deliverable

The first implementation deliverable is NOT a polished dashboard. It is a validated normalized data/state layer plus a static cockpit shell capable of rendering mocked snapshots consistently.

Once the data contracts and state logic pass review, live data adapters are added one by one.
