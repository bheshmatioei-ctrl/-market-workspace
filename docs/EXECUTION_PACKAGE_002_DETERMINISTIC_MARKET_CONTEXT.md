# EXECUTION PACKAGE 002 — Deterministic Market Context Engines

Status: READY FOR EXECUTION
Repository: bheshmatioei-ctrl/-market-workspace
Branch: decision-cockpit-v1
Depends on: APPROVED EXECUTION_PACKAGE_001

## 0. Execution Boundary

Execute ONLY this package.

Do not start live-data integration, anomaly scanning, stock recommendation logic, trade decision zones, AI narrative generation, portfolio logic, deployment, or Package 003.

The purpose of Package 002 is to make the first analytical layer deterministic, explainable, versioned, testable, and isolated from production V5.

## 1. Architecture Authorities

Before implementation, read and treat these documents as authority in this order:

1. docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md
2. docs/ARCHITECTURE_AMENDMENT_001_FEATURE_LIFECYCLE.md
3. docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md
4. docs/MASTER_DATA_CONTRACTS_v1.md
5. docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md
6. docs/SOURCE_FRESHNESS_MATRIX_v1.md
7. docs/ENGINE_DEPENDENCY_GRAPH_v1.md
8. docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md
9. docs/GLOBAL_CAPITAL_ROTATION_SPEC_v1.md
10. docs/EXECUTION_001_REPORT.md
11. docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md

If an implementation choice conflicts with these authorities, STOP and report the conflict. Do not invent a replacement architecture.

## 2. Starting Conditions to Verify

Before changing code:

- Confirm current branch is decision-cockpit-v1.
- Confirm main is not checked out for implementation.
- Confirm existing V5 entry point/index.html remains unchanged.
- Run existing Package 001 validation suite.
- Confirm existing tests pass before Package 002 modifications.
- Confirm FeatureLifecycle is OFF|SHADOW|BETA|ACTIVE.
- Confirm only ACTIVE may influence production composite state.

If baseline tests fail before changes, STOP and report BLOCKED.

## 3. Scope

Implement the following deterministic SHADOW analytical components:

1. HistoricalSnapshotWindow
2. MarketRegimeEngine v0.2-shadow
3. MarketDirectionEngine v0.2-shadow
4. MoneyFlowEngine v0.2-shadow
5. USAssetFlowMonitor deterministic classifier v0.2-shadow
6. GlobalCapitalRotationEngine v0.2-shadow
7. MarketContextBundle assembler
8. Versioned EXPERIMENTAL rule profiles
9. Expanded mock scenario matrix
10. Automated deterministic/monotonicity/conflict/time-integrity tests

All Package 002 engines remain SHADOW.

They may compute and be tested, but they must NOT influence any production composite state and must NOT appear as active production user signals.

## 4. Explicit Non-Scope

Do NOT implement:

- live market providers;
- paid data providers;
- market website scraping;
- browser automation for market data;
- production API keys;
- broker connectivity;
- order placement;
- black-box BUY/SELL output;
- machine learning;
- neural networks;
- LLM market analysis;
- AI-generated narratives;
- anomaly radar production scanner;
- Stock Decision Engine production logic;
- Trade Decision Zones;
- options-flow production integration;
- Event & Catalyst ingestion;
- Portfolio Context Engine;
- durable production database;
- production deployment;
- replacement or modification of V5;
- Package 003.

## 5. Design Principles

### 5.1 Deterministic First

For identical normalized inputs, rule profile, engine version, and evaluation timestamp, output must be byte-for-byte canonically identical.

### 5.2 Explainability

Each state must be reconstructable from:
- normalized input snapshots;
- evidence references;
- rule profile;
- engine version.

No hidden scoring state.

### 5.3 No Claimed Predictive Edge

All Package 002 rules are EXPERIMENTAL.

Do not describe thresholds, scores, or traffic lights as validated trading signals.

### 5.4 Missing Data Fails Closed

Missing, stale, contradictory, or insufficient evidence lowers confidence or returns GREY/UNKNOWN/INSUFFICIENT.

Never coerce missing data into zero and then treat zero as neutral evidence.

### 5.5 Direct vs Proxy Separation

DIRECT and PROXY flow evidence remain separate through every engine result.

No proxy calculation may manufacture a cash-flow dollar amount.

### 5.6 Time Integrity

No engine may read a snapshot timestamped later than its evaluation timestamp.

No interpolation by default.

Session boundaries must remain explicit.

## 6. HistoricalSnapshotWindow

Implement a deterministic in-memory state utility under the decision-cockpit state layer.

Required capabilities:

- append normalized snapshots;
- query by contract/scope;
- retrieve latest valid snapshot at-or-before evaluation time;
- retrieve comparison snapshot for 30m, 60m, 120m, and SESSION horizons;
- apply configurable maximum age/tolerance;
- reject future-data access;
- preserve sessionDate/sessionPhase boundaries;
- return explicit insufficiency metadata when comparison is unavailable;
- deterministic ordering;
- no silent interpolation.

Recommended API conceptually:

append(snapshot)
latestAtOrBefore(scope, timestamp)
comparisonFor(scope, timestamp, horizon, tolerance)
series(scope, from, to)

Exact implementation may adapt to repository style but semantics are mandatory.

## 7. Engine Result Contracts

Implement runtime validation and canonical serialization support for the additive contracts in:

docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md

Required:
- EngineMeta
- DirectionAssessment
- FlowAssessment
- GlobalRotationAssessment
- MarketContextBundle

Do not break Package 001 contract validators.

## 8. Rule Profile System

Create versioned rule profiles outside engine logic.

Suggested location:
src/decision-cockpit/engines/rules/

Required metadata:
- ruleProfileId
- version
- description
- status: EXPERIMENTAL
- engineId
- thresholds/weights/rules

Rules must be data/configuration, not scattered magic constants.

Initial rule profiles may be simple and synthetic but must exercise all major states.

Do not label them production-ready.

## 9. Market Regime Engine

### 9.1 Purpose

Classify current US market context using normalized evidence.

### 9.2 Inputs

Use normalized objects only:
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot[]
- selected AssetFlowSnapshot[] where applicable
- optional compact GlobalRotationAssessment[] summary when provided
- freshness/provenance metadata

No provider payloads.

### 9.3 Output

Emit DecisionState with:
- scope=MARKET
- explicit engineVersion
- explicit ruleProfileId through EngineMeta or linked metadata
- score
- trafficLight
- confidence
- supportingEvidence
- opposingEvidence
- freshness

Allowed market semantic states in Package 002:
- RISK_ON
- NEUTRAL
- CONFLICTED
- RISK_OFF
- UNKNOWN

Do not introduce Strong Risk-On/Strong Risk-Off semantics unless existing contracts are extended through an approved amendment. Numeric score may carry intensity.

### 9.4 Rules

The engine must consider multiple independent evidence families. At minimum:

- index participation / broad index state;
- breadth;
- advancing vs declining volume where available;
- new highs vs new lows where available;
- sector participation;
- volatility/rates evidence only when normalized evidence permits comparison;
- asset-flow evidence only with direct/proxy distinction preserved.

No single data field can alone create a high-confidence market state.

Price direction alone cannot generate RISK_ON/RISK_OFF at high confidence.

Conflicting evidence should produce CONFLICTED or reduced confidence.

## 10. Market Direction Engine

### 10.1 Purpose

Measure whether conditions are improving, stable, or deteriorating across separate horizons.

### 10.2 Horizons

Required:
- 30m
- 60m
- 120m
- SESSION

### 10.3 Inputs

HistoricalSnapshotWindow over:
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot aggregates

### 10.4 Output

One DirectionAssessment per horizon.

### 10.5 Direction Logic

Compare current evidence against valid past-only comparison snapshots.

At minimum examine changes in:
- index state;
- breadth participation;
- up/down volume if available;
- new highs/lows if available;
- sector participation.

If historical comparison data is insufficient, output UNKNOWN/GREY for that horizon.

Do not reuse 30m result for 60m/120m/session.

## 11. Money Flow Engine

### 11.1 Purpose

Estimate relative demand/selling pressure by sector/segment without inventing cash-flow values.

### 11.2 Inputs

- SectorSnapshot[]
- StockSnapshot aggregates when mock fixtures provide them
- BreadthSnapshot
- selected AssetFlowSnapshot[]

### 11.3 Output

FlowAssessment[] by sector/segment.

### 11.4 Minimum Evidence Families

- price/relative strength;
- relative volume;
- internal participation/breadth;
- up/down volume where available;
- direct flow evidence separately where available.

### 11.5 Rules

- price increase alone != DEMAND;
- price decline alone != SELLING_PRESSURE;
- broad participation + relative strength + volume confirmation may increase confidence;
- price/volume divergence must surface conflict;
- insufficient inputs -> GREY/INSUFFICIENT.

## 12. US Asset Flow Monitor — Deterministic Classifier

### 12.1 Purpose

Produce standardized FlowAssessment records for US asset classes while preserving measured direct flow versus intraday proxy evidence.

### 12.2 Direct Records

For DIRECT AssetFlowSnapshot:
- preserve measured flowValue;
- preserve currency;
- preserve reporting period/frequency;
- preserve source metadata;
- do not transform weekly/monthly data into intraday claims.

### 12.3 Proxy Records

For PROXY mode, use available normalized:
- breadth;
- up/down volume;
- index behavior;
- sector behavior;
- rates/volatility/FX/commodity evidence only when present in MarketSnapshot and comparable.

No proxy dollar value.

### 12.4 Output

FlowAssessment[] for at least mock categories:
- US_EQUITY
- US_BOND
- MONEY_MARKET when direct mock data exists
- GOLD

No claim that proxy output is exact net flow.

## 13. Global Capital Rotation Engine

### 13.1 Purpose

Classify country/region rotation evidence using CountryFlowSnapshot and associated normalized evidence.

### 13.2 Output

GlobalRotationAssessment[] with horizon preserved.

### 13.3 Rules

- direct and proxy evidence remain separate;
- structural data cannot determine overnight/1d classification;
- cross-frequency conflict must reduce confidence;
- missing direct flow is not negative evidence;
- positive equity performance alone is insufficient for high-confidence positive rotation;
- contradictory equity/bond/FX signals should produce MIXED/ORANGE where appropriate;
- insufficient quality -> GREY.

## 14. MarketContextBundle Assembler

Create an immutable assembler that receives outputs from Package 002 engines and creates MarketContextBundle.

Requirements:
- no averaging of engine scores;
- no mutation of engine outputs;
- preserve all engine versions/rule profiles;
- collect explicit conflicts/warnings;
- preserve source snapshot IDs;
- deterministic canonical serialization;
- SHADOW lifecycle retained.

The bundle is for validation only in Package 002.

It must not become production composite market state.

## 15. Mock Scenario Matrix

Expand mocks to cover at least these deterministic scenarios:

1. BROAD_RISK_ON
   - broad positive participation
   - positive breadth
   - confirming volume
   - multiple sectors positive

2. BROAD_RISK_OFF
   - broad negative participation
   - weak breadth
   - negative volume confirmation
   - multiple sectors negative

3. MEGACAP_CONCENTRATED
   - headline index relatively strong
   - broad breadth weak
   - concentration/conflict expected

4. PRICE_VOLUME_DIVERGENCE
   - price positive
   - participation/volume weak
   - flow conflict expected

5. BREADTH_RECOVERY
   - earlier weak state
   - improving 30m/60m breadth
   - longer horizon still weak

6. LATE_SESSION_DETERIORATION
   - 30m/60m deteriorating
   - session state not necessarily identical

7. STALE_DATA
   - stale critical evidence
   - confidence degradation / GREY where required

8. MISSING_HISTORY
   - current state exists
   - no valid 30m/60m/120m comparison
   - direction UNKNOWN

9. GLOBAL_US_DISAGREEMENT
   - global rotation constructive
   - US internals weak
   - disagreement surfaced, not overwritten

10. DIRECT_PROXY_CONFLICT
   - direct fund flow positive for reporting period
   - intraday proxy negative
   - MIXED/conflict preserved

11. STRUCTURAL_VS_OVERNIGHT
   - structural direct flow positive
   - overnight proxy negative
   - separate horizons remain separate

12. INSUFFICIENT_COUNTRY_DATA
   - missing key country evidence
   - GREY result

All fixtures remain clearly marked MOCK / NOT LIVE DATA.

## 16. Test Requirements

Add automated tests covering at minimum:

### Determinism
- same input + same timestamp + same rule profile => identical canonical output.

### Time Integrity
- future snapshot is never used;
- missing comparison -> UNKNOWN, not STABLE;
- 30m/60m/120m/session remain independent;
- session boundaries respected.

### Monotonicity / Sanity
Where rule semantics imply monotonicity:
- improving breadth with all else equal must not worsen breadth component score;
- worsening breadth with all else equal must not improve breadth component score;
- stronger supporting evidence with unchanged opposition must not reduce confidence solely due to score direction.

Do not force monotonicity where rules explicitly encode nonlinear conflict behavior.

### Conflict Handling
- strong index + weak breadth -> conflict/reduced confidence;
- direct positive flow + proxy negative -> MIXED/conflict;
- global positive + US weak -> both preserved.

### Missing/Stale
- missing critical evidence degrades confidence;
- insufficient evidence -> GREY/UNKNOWN/INSUFFICIENT;
- stale direct flow cannot masquerade as live intraday flow.

### Direct/Proxy Integrity
- PROXY FlowAssessment cannot contain directFlowValue;
- DIRECT numeric flow requires DIRECT evidence;
- no proxy dollar fabrication.

### Lifecycle
- all new analytical engines default SHADOW;
- SHADOW cannot influence production composite state;
- no new ACTIVE feature introduced.

### Isolation
- engines do not import adapters/provider logic;
- engines perform no network access;
- UI does not implement analytical logic;
- V5 integrity guard continues to pass.

### Regression
- all Package 001 tests remain passing.

## 17. Build / Validation

Use existing dependency-free Node validation approach unless a compelling architecture reason requires otherwise.

Do not add external dependencies merely for convenience.

Required final validation:

- npm_config_offline=true npm run check
- build validation PASS
- all Package 001 + Package 002 tests PASS
- architecture guard PASS
- legacy V5 integrity PASS

If any test is skipped, report exactly why.

## 18. UI Constraint

Do not redesign the cockpit in Package 002.

The existing static shell may remain mock-only.

If developer-only rendering is needed for validation, it must be clearly labelled SHADOW / MOCK / NOT LIVE and must not be presented as production signal output.

No user-facing production activation.

## 19. Documentation

On completion create:

docs/EXECUTION_002_REPORT.md

Report must include:
- exact branch and commit SHA;
- baseline verification;
- files changed;
- engines implemented;
- rule profiles added;
- contract additions;
- mock scenarios;
- test counts/results;
- architecture guard result;
- V5 integrity result;
- known limitations;
- architectural deviations;
- unresolved issues;
- exact next recommended action.

## 20. Acceptance Criteria

PASS only if all are true:

1. Existing Package 001 tests still pass.
2. New engine-output contracts validate and serialize deterministically.
3. HistoricalSnapshotWindow is past-only and horizon-safe.
4. Market Regime engine emits explainable SHADOW DecisionState.
5. Market Direction emits independent 30m/60m/120m/session DirectionAssessments.
6. Money Flow outputs proxy classifications without fake cash-flow values.
7. US Asset Flow direct/proxy separation is preserved.
8. Global Capital Rotation preserves horizons and evidence type.
9. MarketContextBundle is immutable and non-authoritative.
10. Conflict scenarios remain conflicts.
11. Missing/stale evidence fails closed.
12. All new analytical engines are SHADOW.
13. No network/live provider integration exists.
14. V5 is unchanged.
15. Build and automated tests pass.
16. EXECUTION_002_REPORT.md is committed.

PARTIAL if implementation is useful but one or more non-critical acceptance items remain incomplete.

BLOCKED if architecture, baseline integrity, deterministic behavior, or V5 isolation cannot be preserved.

## 21. Stop Condition

After Package 002 is implemented and report committed:

STOP.

Do not begin:
- Package 003;
- live adapters;
- production weights;
- anomaly scanner;
- Stock Decision Engine;
- Trade Decision Zones;
- deployment.

Return only the required handoff summary.
