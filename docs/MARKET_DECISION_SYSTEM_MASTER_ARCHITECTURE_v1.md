# Market Decision Intelligence System — Master Architecture v1

Status: MASTER ARCHITECTURE BASELINE
Branch: decision-cockpit-v1
Purpose: Consolidate all agreed product concepts before implementation so future updates can be added without cross-module conflict, state corruption, or duplicated logic.

---

## 1. Product Definition

The product is an always-on Market Decision Intelligence System for US-market monitoring, interpretation, testing, and visual decision support.

It is not a broker, not an automated trader, and not a black-box signal generator.

Its job is to transform fragmented market information into a coherent, inspectable, timestamped, low-latency view that answers:

1. What is the current market state?
2. Is the market improving or deteriorating?
3. Where is money/relative demand moving?
4. Which stocks/sectors/countries show abnormal behavior?
5. What changed overnight and before the US open?
6. What are the major current and upcoming catalysts?
7. How do user-selected stocks compare with automatically discovered opportunities/risks?
8. What does the model predict, and how accurate has it actually been?
9. What is confirmed measured flow versus inferred/proxy flow?

---

## 2. System Principle

Every important object is displayed in three simultaneous layers:

RAW DATA -> SYSTEM INTERPRETATION -> VISUAL STATE

Visual states:
- GREEN = constructive / favorable / accumulation / inflow evidence.
- ORANGE = mixed / caution / transition / conditional.
- RED = deterioration / distribution / risk / outflow evidence.
- GREY = insufficient / stale / unavailable / non-comparable evidence.

Color never replaces evidence.

Every conclusion must expose:
- timestamp;
- source/freshness;
- confidence;
- supporting evidence;
- opposing evidence where relevant.

---

## 3. Top-Level Architecture

The system is split into five layers.

### Layer A — Data Acquisition

Adapters collect raw data from independent sources.

Examples:
- market prices;
- volume;
- futures;
- breadth;
- rates;
- volatility;
- FX;
- commodities;
- ETF/fund flows;
- SEC filings;
- earnings/news;
- macro releases;
- global market indices;
- direct cross-border/country-flow datasets where available.

Rule: source-specific logic stays inside adapters. No engine should directly depend on a vendor-specific response shape.

### Layer B — Normalized Market State

All adapters write to normalized contracts.

Core contracts:
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot
- StockSnapshot
- FuturesSnapshot
- RatesSnapshot
- VolatilitySnapshot
- AssetFlowSnapshot
- CountryFlowSnapshot
- PremarketSnapshot
- CatalystEvent
- NewsEvent
- Alert
- DecisionState
- PredictionRecord
- PredictionOutcome

Rule: engines consume normalized contracts only.

### Layer C — Analytical Engines

Independent engines interpret normalized state.

Engines never silently overwrite each other. Conflicts are explicit outputs.

### Layer D — Presentation / Decision Cockpit

The UI presents raw evidence, interpretation, traffic-light state, confidence, and change over time.

### Layer E — Validation / Model Test

Immutable predictions are scored after the fact against actual outcomes and simple baselines.

This layer is logically separate from the live Decision Cockpit.

---

## 4. Core Engines

### 4.1 Market Regime Engine

Purpose:
Classify the overall US market environment.

Inputs:
- SPY / QQQ / IWM / DIA;
- breadth;
- up/down volume;
- new highs/lows;
- percentage above key moving averages when available;
- volatility;
- rates;
- credit/risk proxies;
- sector participation.

Outputs:
- Strong Risk-On / Risk-On / Neutral / Risk-Off / Strong Risk-Off;
- score;
- confidence;
- supporting/opposing evidence.

---

### 4.2 Market Direction Engine

Purpose:
Measure change, not only current level.

Horizon separation is mandatory:
- 30m;
- 60m;
- 120m;
- Session.

Outputs:
- Improving / Stable / Deteriorating;
- speed of improvement/deterioration;
- capital-flow bias only when evidence is sufficient.

---

### 4.3 Money Flow Engine

Purpose:
Identify where relative demand and participation are concentrating inside the US market.

Coverage:
- semiconductors;
- mega-cap tech;
- financials;
- energy;
- industrials;
- small caps;
- defensives;
- other sector/group extensions.

Evidence:
- price trend;
- relative volume;
- relative strength;
- breadth/participation;
- ETF/group behavior.

Important rule:
Price decline alone is not capital outflow.

---

### 4.4 US Asset Flow Monitor

Purpose:
Answer: "Where did US financial-market money appear to move?"

Separate measured flows from intraday proxies.

#### Direct / Measured Flow Layer
Where available:
- equity ETF/mutual-fund flow;
- bond fund/ETF flow;
- money-market fund flow;
- commodity/gold ETF flow;
- sector/thematic ETF creations/redemptions;
- high-yield / investment-grade flow;
- other licensed or official fund-flow datasets.

Each direct number requires:
- source;
- reporting period;
- timestamp;
- frequency;
- comparability status.

#### Intraday Proxy Layer
Use:
- up/down volume;
- breadth;
- SPY/QQQ/IWM price-volume behavior;
- futures;
- VIX;
- Treasury yields;
- DXY;
- gold;
- sector ETF behavior;
- options/futures positioning where valid.

Allowed outputs:
- Equity demand proxy;
- Equity selling-pressure proxy;
- Bond demand proxy;
- Cash-parking / defensive rotation proxy;
- Gold/commodity demand proxy;
- Mixed / insufficient evidence.

Never fabricate a dollar flow from proxy evidence.

---

### 4.5 Global Capital Rotation Engine

Purpose:
Show country/region-level capital-rotation evidence.

Coverage initially:
- US;
- Canada;
- UK;
- Euro Area;
- Germany;
- France;
- Switzerland;
- Japan;
- China;
- Hong Kong;
- South Korea;
- Taiwan;
- India;
- Australia;
- Brazil;
- Mexico;
- selected emerging-market aggregate.

Per country/region:
- equity state;
- bond state;
- FX state;
- risk state;
- direct flow data where available;
- inferred rotation proxy;
- confidence;
- data quality;
- last update.

Horizon separation:
- overnight;
- 1 day;
- 5 days;
- 1 month;
- structural trend.

Structural quarterly data must never be presented as intraday flow.

---

### 4.6 Premarket Intelligence Engine

Purpose:
Cover prior US close to next US open.

Mandatory sub-windows:
- Post-market 16:00–20:00 ET;
- Overnight / global session;
- US premarket 04:00–09:30 ET.

Inputs:
- ES / NQ / RTY futures;
- rates;
- DXY;
- oil;
- gold;
- volatility;
- Asian/European markets;
- global capital rotation;
- US asset-flow updates where available;
- premarket movers;
- user Focus names;
- news/earnings/SEC/catalysts;
- scheduled events before open.

Outputs:
- Premarket State;
- overnight direction;
- global risk state;
- broad/concentrated participation;
- sector leadership;
- My Focus premarket state;
- AI-discovered premarket names;
- ranked catalyst digest;
- conditional opening scenarios;
- countdown to major scheduled event.

At 09:30 ET the final snapshot freezes and hands off to intraday engines.

---

### 4.7 Anomaly Radar

Purpose:
Scan a broad market universe cheaply and surface unusual behavior only.

Detect:
- RVOL spikes;
- abnormal dollar volume;
- gaps;
- VWAP breaks/reclaims;
- breakout/breakdown;
- relative-strength shifts;
- sector divergence/confirmation;
- failed volume/price confirmation;
- catalyst-driven anomalies.

Output:
- timestamp;
- symbol;
- raw measurements;
- event type;
- interpretation;
- severity;
- confidence.

---

### 4.8 Stock Decision Engine

Purpose:
Deeply analyze a limited Focus list plus selected AI-discovered names.

Typical Focus capacity:
3–20 stocks.

Per stock:
- price;
- volume / RVOL;
- VWAP state;
- relative strength;
- sector context;
- market-regime context;
- options data where available;
- news / SEC / earnings risk;
- technical structure.

Output states:
- Accumulation;
- Buy Pressure;
- Neutral;
- Conflicted;
- Distribution;
- Sell Pressure;
- Wait — Event Risk.

No unexplained BUY/SELL commands.

---

### 4.9 Trade Decision Zones

Purpose:
Generate conditional, testable price zones.

Possible zones:
- Opportunity Zone;
- Conditional Zone;
- Partial Profit Zone;
- Exit Risk Zone;
- Hold Condition;
- Invalidation Level.

Every zone must include:
- price range;
- validity horizon/time window;
- required conditions;
- invalidation;
- confidence;
- reasoning summary.

Zones may be dynamically suspended when market conditions change.

These zones are for analysis and model testing in v1, not automated execution.

---

### 4.10 Event & Catalyst Engine

Purpose:
Connect scheduled and unscheduled events to current market and stock states.

Track:
- Fed;
- inflation/employment/ISM/JOLTS and other macro data;
- Treasury events where relevant;
- earnings/guidance;
- SEC filings;
- M&A;
- regulation/legal developments;
- material company news;
- geopolitical events;
- commodity shocks.

Outputs:
- next high-impact event;
- countdown;
- affected stocks/sectors;
- risk level;
- whether existing signals should have reduced confidence.

---

### 4.11 Portfolio Context Engine

Purpose:
Add optional user-portfolio context without changing the underlying market analysis.

Inputs when provided:
- holdings;
- cash;
- sector exposure;
- concentration;
- correlated positions.

Outputs:
- exposure warnings;
- concentration warnings;
- correlation warnings.

Invariant:
Good stock state != automatically good portfolio action.

---

### 4.12 Decision Timeline Engine

Purpose:
Record meaningful intraday state changes.

Examples:
- Risk-Off at open;
- semiconductor breadth improves;
- QQQ reclaims VWAP;
- Nasdaq A/D improves;
- 10Y yield falls;
- Market State changes Risk-Off -> Neutral.

This makes regime transitions visible, not only the latest snapshot.

---

## 5. My Focus and AI Discovered

These remain permanently separate concepts.

### My Focus
User-selected stocks monitored deeply.

### AI Discovered
Stocks surfaced by broad anomaly scan.

Flow:
WHOLE MARKET -> LIGHT SCANNER -> ANOMALIES -> DEEP ANALYSIS -> COCKPIT

AI-discovered names can be promoted into My Focus by the user.

---

## 6. Model Test Lab

Purpose:
Determine whether the system has measurable predictive edge.

This is not a trading panel.

### Immutable Prediction Record
Once issued, a prediction cannot be edited or removed from statistics.

Store:
- prediction ID;
- timestamp;
- symbol/market object;
- regime at issuance;
- prediction direction;
- reference price;
- expected move/range;
- horizon;
- confidence;
- evidence snapshot;
- model version.

### Outcome Record
Store after horizon expiration:
- actual move;
- direction result;
- magnitude error;
- max favorable excursion;
- max adverse excursion;
- pass/fail by predeclared rule.

### Metrics
- directional accuracy;
- magnitude error;
- calibration;
- false positive rate;
- false negative rate;
- performance by horizon;
- performance by regime;
- performance by sector;
- performance by symbol;
- premarket-specific accuracy;
- global-rotation-specific accuracy.

### Benchmarks
Compare against:
- random 50/50;
- simple momentum continuation;
- broad-index direction;
- simple relative-strength baseline where appropriate.

No claimed edge unless it beats relevant baselines out-of-sample.

---

## 7. Main User Interface

Persistent top navigation:
- LIVE MARKET
- PREMARKET
- GLOBAL CAPITAL
- US ASSET FLOWS
- MODEL TEST

### LIVE MARKET
Top summary:
- Market State;
- 30m / 60m / 2h / Session direction;
- Capital Flow state;
- volatility/rates state;
- next catalyst.

Primary body:
- Money Flow Map;
- Live Alerts;
- My Focus;
- AI Discovered;
- Market Internals;
- Macro/Risk;
- Decision Timeline.

### PREMARKET
- Premarket State;
- futures/rates/volatility/global risk;
- overnight timeline;
- global capital summary;
- US asset-flow updates;
- participation proxy;
- sectors;
- My Focus;
- AI Discovered;
- news/catalysts;
- opening scenarios.

### GLOBAL CAPITAL
- country/region list;
- direct vs proxy flow split;
- equity/bond/FX/risk evidence;
- confidence;
- freshness;
- multi-horizon view.

### US ASSET FLOWS
- equities;
- bonds;
- money markets;
- gold/commodities;
- sector/thematic funds;
- direct measured flow where available;
- intraday proxy state separately.

### MODEL TEST
- live immutable predictions;
- expired outcomes;
- scoreboard;
- calibration;
- benchmark comparison;
- performance by horizon/regime/symbol.

---

## 8. Data Integrity Rules

1. Every displayed measurement has timestamp and source metadata.
2. LIVE / DELAYED / STALE / HISTORICAL states must be visible.
3. Missing data reduces confidence; it is never silently treated as neutral/positive.
4. Direct flow and inferred flow are different types and must never be merged silently.
5. News fact and market interpretation are stored separately.
6. Premarket, post-market, overnight and regular-session observations remain distinguishable.
7. Cross-country flow data with different frequencies must not be compared as if synchronous.
8. No fabricated dollar flows.
9. No fabricated model certainty.
10. If sources conflict, expose conflict.

---

## 9. Update-Safe Architecture

The system is explicitly designed for continual updating.

### 9.1 Stable Contracts, Replaceable Adapters

Source adapters are replaceable.

Example:
Vendor A price feed can later be replaced by Vendor B without changing Market Regime logic, as long as both map into the same StockSnapshot/MarketSnapshot schema.

### 9.2 Versioned Schemas

Every persisted contract has a schemaVersion.

Example:
StockSnapshot v1 -> v2 can add optional fields without silently breaking old consumers.

Breaking changes require:
- new schema version;
- migration/compatibility logic;
- explicit review.

### 9.3 Versioned Engines

Every analytical engine has engineVersion/modelVersion.

A new scoring method does not overwrite old historical predictions.

Example:
MarketRegimeEngine v1 predictions remain evaluable after v2 is released.

### 9.4 Feature Modules

New ideas enter as modules with declared:
- purpose;
- inputs;
- outputs;
- dependencies;
- freshness requirements;
- confidence behavior;
- UI placement;
- validation method.

No disconnected widget is added directly to the cockpit.

### 9.5 Feature Flags

Experimental modules should be behind feature flags until validated.

Possible states:
- OFF;
- TEST;
- SHADOW;
- ON.

SHADOW means the engine computes results for evaluation but does not influence the main composite state.

### 9.6 Dependency Direction

Allowed dependency direction:

ADAPTERS -> NORMALIZED STATE -> ENGINES -> COMPOSITE STATE -> UI
                                      -> MODEL TEST

Disallowed:
- UI writing market conclusions back into raw state;
- one engine mutating another engine's output;
- vendor-specific payloads leaking into engine logic;
- AI narrative creating missing numeric market data.

### 9.7 Composite State Is Derived, Never Source-of-Truth

Composite traffic-light results are recomputable from stored evidence.

Raw/normalized evidence remains the source of truth.

### 9.8 Auditability

For every important alert or conclusion store:
- inputs used;
- source timestamps;
- engine version;
- output;
- confidence;
- reason codes.

This allows later debugging and model evaluation.

---

## 10. Persistence Model

Persist time-series snapshots rather than only the latest state.

Minimum logical stores:

### Raw/Normalized Snapshot Store
Timestamped normalized market observations.

### Event Store
Catalysts/news/SEC/macro events.

### Alert Store
Issued anomaly/risk alerts.

### Prediction Store
Immutable model-test predictions.

### Outcome Store
Resolved prediction outcomes.

### Configuration Store
- My Focus;
- thresholds;
- enabled modules;
- UI preferences;
- feature flags.

### Model/Engine Registry
- engine name;
- version;
- activation date;
- status;
- change notes.

---

## 11. Composite Scoring Rules

Composite scores are provisional and decomposable.

Candidate evidence families:
- trend;
- breadth;
- volume;
- relative strength;
- sector confirmation;
- volatility;
- rates;
- options;
- catalyst/news;
- direct flow where relevant;
- global rotation context.

Rules:
1. No single input dominates by default.
2. Weights are configurable and versioned.
3. Missing inputs reduce confidence.
4. Strong disagreement produces ORANGE/CONFLICTED rather than forced GREEN/RED.
5. Weights must later be empirically validated.

---

## 12. Implementation Sequence

### Phase 0 — Freeze Current V5
- main remains unchanged;
- old product is control baseline;
- new work stays on decision-cockpit-v1 or subsequent isolated branches.

### Phase 1 — Master Data Contracts
Define and review all normalized schemas.

No live UI logic before contracts are stable.

### Phase 2 — Persistence + Audit Layer
Implement timestamped snapshots, engine registry, prediction immutability, freshness metadata and audit records.

### Phase 3 — Deterministic Core Engines
Implement explainable first versions of:
- Market Regime;
- Market Direction;
- Money Flow;
- Anomaly Radar;
- US Asset Flow classification;
- Global Capital Rotation classification;
- Premarket State.

### Phase 4 — Static Cockpit Shell
Render mocked normalized states consistently.

### Phase 5 — Live Data Adapters
Add sources one by one behind adapter interfaces.

### Phase 6 — My Focus + AI Discovered
Add deep stock analysis and promotion workflow.

### Phase 7 — Trade Decision Zones
Add conditional test zones.

### Phase 8 — Model Test Lab
Activate immutable prediction/outcome scoring and benchmarks.

### Phase 9 — AI Interpretation Layer
Add textual synthesis only after deterministic/raw layers are stable.

AI may explain conflicts and evidence but may not fabricate missing measurements.

### Phase 10 — Parallel Validation
Run old and new systems in parallel.

Evaluate:
- usefulness;
- cognitive load;
- latency;
- data reliability;
- false alerts;
- stability;
- predictive performance;
- maintainability.

Only then decide merge / replace / discard.

---

## 13. Architectural Invariants

These rules are considered protected unless deliberately revised through an architecture decision.

1. Existing V5 stays untouched during initial validation.
2. Raw/normalized data is source-of-truth; composite states are derived.
3. Direct flow and proxy flow remain distinct.
4. Market-wide state and stock-specific state remain distinct.
5. My Focus and AI Discovered remain distinct.
6. Premarket and regular session remain distinct.
7. Short-horizon and session/swing interpretations remain distinct.
8. Every conclusion has timestamp, freshness and confidence.
9. Missing/stale data cannot silently create a directional signal.
10. Prediction history is immutable.
11. Failed predictions remain in statistics.
12. Model/engine version is attached to every prediction.
13. AI narrative cannot override raw market data silently.
14. No real-money execution in v1.
15. New features enter through modular contracts, not ad-hoc UI widgets.
16. Experimental engines can run in SHADOW mode before influencing live state.
17. Engine conflicts are surfaced, not hidden.
18. All meaningful conclusions are auditable back to inputs.
19. Data-source replacement must not require rewriting analytical engines.
20. Breaking schema/scoring changes require versioning and explicit migration/review.

---

## 14. Current Module Registry

ACTIVE DESIGN BASELINE:
- Market Regime Engine
- Market Direction Engine
- Money Flow Engine
- US Asset Flow Monitor
- Global Capital Rotation Engine
- Premarket Intelligence Engine
- Anomaly Radar
- Stock Decision Engine
- Trade Decision Zones
- Event & Catalyst Engine
- Portfolio Context Engine
- Decision Timeline
- My Focus
- AI Discovered
- Model Test Lab

FUTURE EXTENSIONS MAY INCLUDE:
- institutional ownership/positioning layer;
- options microstructure expansion;
- credit/liquidity stress engine;
- earnings-quality engine;
- longer-horizon swing/regime model;
- user-specific portfolio risk simulator;
- additional countries/asset classes.

Future modules must conform to this architecture before implementation.

---

## 15. Build Gate

No production implementation should begin until the following are reviewed:

1. Master Architecture v1.
2. Normalized data contracts.
3. Source/freshness matrix.
4. Engine dependency graph.
5. Persistence/audit model.
6. Versioning/feature-flag policy.
7. Initial deterministic scoring rules.
8. Mock cockpit layout.

Only after these gates pass should live-data integration and UI implementation proceed.

---

## 16. Current Decision

The current V5 remains frozen as control.

The new Market Decision Intelligence System is developed independently and modularly.

The next implementation task is not UI coding. It is:

PHASE 1 — MASTER DATA CONTRACTS + SOURCE/FRESHNESS MATRIX + ENGINE DEPENDENCY GRAPH.
