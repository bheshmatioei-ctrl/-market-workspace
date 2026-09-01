# Execution Package 003 — Deterministic Anomaly Radar and Discovery

Status: ARCHITECTURE AUTHORITY — IMPLEMENTATION REQUIRES SEPARATE AUTHORIZATION

Repository: `bheshmatioei-ctrl/-market-workspace`

Branch: `decision-cockpit-v1`

Depends on: APPROVED Execution Packages 001 and 002

## 0. Authority and Execution Boundary

This document defines a later, strictly bounded Package 003 implementation. Its
creation does not authorize implementation code.

Package 003 is a deterministic SHADOW anomaly scanner over normalized market
state. It is not a Stock Decision Engine, trade-signal engine, live-data
integration package, AI narrative system, or deployment package.

Required logical flow:

```text
StockSnapshot[]
+ SectorSnapshot[]
+ CatalystEvent[]
        |
        v
Deterministic Anomaly Radar
        |
        v
Alert[] + DiscoveryCandidate[]
        |
        v
SHADOW validation only
```

## 1. Binding Architecture Authority Order

Before any later implementation, read and treat these documents as binding in
this order:

1. `docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md`
2. `docs/ARCHITECTURE_AMENDMENT_001_FEATURE_LIFECYCLE.md`
3. `docs/ARCHITECTURE_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
4. `docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md`
5. `docs/MASTER_DATA_CONTRACTS_v1.md`
6. `docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md`
7. `docs/DATA_CONTRACTS_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
8. `docs/DATA_CONTRACTS_AMENDMENT_003_ANOMALY_DISCOVERY.md`
9. `docs/SOURCE_FRESHNESS_MATRIX_v1.md`
10. `docs/ENGINE_DEPENDENCY_GRAPH_v1.md`
11. `docs/EXECUTION_001_REPORT.md`
12. `docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md`
13. `docs/EXECUTION_002_REPORT.md`
14. `docs/EXECUTION_PACKAGE_002_REMEDIATION.md`
15. `docs/EXECUTION_002_REMEDIATION_REPORT.md`
16. `docs/EXECUTION_PACKAGE_003_DETERMINISTIC_ANOMALY_RADAR.md`

If implementation conflicts with these authorities, stop and report BLOCKED.
Do not invent replacement architecture in code.

## 2. Starting Conditions for Later Execution

Before changing code, later execution must:

1. verify branch `decision-cockpit-v1`;
2. verify the exact separately supplied Package 003 starting remote HEAD;
3. verify `main` remains at its separately supplied expected SHA;
4. verify V5 remains unchanged;
5. run `npm_config_offline=true npm run check` as the baseline;
6. stop as BLOCKED if tests, build, architecture guard, V5 integrity, or
   Package 001/002 regression fails;
7. confirm all Package 003 features start as `SHADOW` and only `ACTIVE` can
   influence production composite state.

## 3. Strict Package Scope

Later Package 003 implementation may add only:

1. deterministic `AnomalyRadarEngine`;
2. additive `DiscoveryCandidate` runtime validation and canonical
   serialization;
3. versioned EXPERIMENTAL SHADOW anomaly rule profile;
4. deterministic mock Stock/Sector/Catalyst scenarios;
5. automated anomaly detection and isolation tests;
6. provenance-preserving `Alert[]` and `DiscoveryCandidate[]` outputs;
7. AI Discovered candidate generation as SHADOW validation output only.

No UI implementation or production activation is authorized.

## 4. Engine Declaration

### Purpose

Scan a normalized stock universe cheaply and surface unusual observable
behavior for later evaluation.

### Consumed contracts

- `StockSnapshot[]`;
- `SectorSnapshot[]`;
- `CatalystEvent[]`.

No optional context is approved for the initial Package 003 engine. Adding
Market Regime, Market Direction, portfolio, options, provider, or UI context
requires a later explicit architecture decision.

### Emitted contracts

- existing normalized `Alert[]`;
- additive normalized `DiscoveryCandidate[]` from Data Contracts Amendment
  003.

### Engine metadata

- engine ID: `anomaly-radar-engine`;
- initial engine version: `0.3-shadow`;
- deterministic: `true`;
- lifecycle: `SHADOW`;
- rule profile: `anomaly-radar.experimental.v0.3`.

### Dependency direction

The engine consumes normalized state only. It must not call providers, access
the network, import adapter payload types, scrape websites, calculate inside
the UI, mutate source snapshots, or write conclusions back into normalized raw
state.

## 5. Required Anomaly Classes

The engine must preserve these explicit deterministic semantics:

1. `RELATIVE_VOLUME_SPIKE`
2. `ABNORMAL_DOLLAR_VOLUME`
3. `GAP_UP`
4. `GAP_DOWN`
5. `VWAP_RECLAIM`
6. `VWAP_BREAKDOWN`
7. `BREAKOUT`
8. `BREAKDOWN`
9. `RELATIVE_STRENGTH_ACCELERATION`
10. `RELATIVE_STRENGTH_DETERIORATION`
11. `SECTOR_CONFIRMATION`
12. `SECTOR_DIVERGENCE`
13. `PRICE_VOLUME_DIVERGENCE`
14. `CATALYST_ASSOCIATED_ANOMALY`

Exact internal identifiers may follow repository enum conventions only if
these semantics remain one-to-one, explicit, documented, and deterministic.

## 6. Anomaly Semantics

Protected invariants:

```text
ANOMALY != OPPORTUNITY
ANOMALY != BUY
ANOMALY != SELL
```

Examples:

- High RVOL alone means unusual participation, not bullish demand.
- A gap does not establish continuation or fair value.
- A volume spike does not establish inflow.
- A price move does not establish confirmed demand.
- High RVOL plus strong price movement with weak sector confirmation may emit
  the detected anomalies, `SECTOR_DIVERGENCE`, reduced confidence, and explicit
  opposing evidence. It must not emit a bullish trade conclusion.

Package 003 must not assign Accumulation, Buy Pressure, Distribution, Sell
Pressure, Opportunity Zone, target price, position size, or order action.

## 7. Deterministic Detection Boundaries

### Relative volume

`RELATIVE_VOLUME_SPIKE` requires an explicit normalized relative-volume value
or a valid past-only volume baseline with compatible units and provenance.
Missing volume or baseline is not zero and cannot trigger the anomaly.

### Abnormal dollar volume

`ABNORMAL_DOLLAR_VOLUME` requires normalized dollar volume or a deterministic
price-times-volume measurement with compatible timestamp, currency/unit, and
provenance. It must not infer capital inflow or outflow.

### Gaps

`GAP_UP` and `GAP_DOWN` compare current price with an explicit normalized prior
close. Missing or stale prior close fails closed. Gap direction is an observed
price discontinuity, not a trade direction.

### VWAP transitions

`VWAP_RECLAIM` and `VWAP_BREAKDOWN` require a valid current VWAP relationship
and a valid past-only prior relationship. Current distance alone cannot prove a
transition. No future or interpolated relationship is permitted.

### Breakout and breakdown

`BREAKOUT` and `BREAKDOWN` require an explicit past-only reference range or
prior high/low series. The reference window, tolerance, and minimum history are
rule-profile configuration. The current observation cannot be included in a
way that leaks its future outcome into the baseline.

### Relative-strength change

Acceleration or deterioration requires comparable current and past-only
relative-strength observations against the same declared benchmark and units.

### Sector context

Sector confirmation or divergence requires a matching normalized
`SectorSnapshot` at or before evaluation time. Missing sector ID, missing
sector snapshot, stale sector context, or incompatible timestamp cannot become
neutral sector evidence. It must degrade confidence or fail the sector anomaly
closed.

### Price-volume divergence

Price and volume evidence must remain separate families. Opposing behavior is
preserved explicitly; it is not averaged into a directional conclusion.

### Catalyst association

`CATALYST_ASSOCIATED_ANOMALY` requires an eligible normalized CatalystEvent
linked through `affectedSymbols` or compatible `affectedSectors`, with event
and source timestamps at or before evaluation. Association is not causation.

A future scheduled event may be known risk but cannot be represented as an
already occurred catalyst. An empty eligible catalyst set means no qualifying
catalyst was supplied, not proof that no catalyst exists.

## 8. Time Integrity

For evaluation at time `T`, every used input and evidence observation must
satisfy:

```text
input.timestamp <= T
evidence.sourceMeta.observedAt <= T
evidence.sourceMeta.receivedAt <= T
eligible catalyst fact timestamp <= T
historical baseline timestamp <= its target timestamp <= T
```

Reject future StockSnapshot, SectorSnapshot, CatalystEvent facts, evidence, and
reference data. No look-ahead is allowed through:

- volume baselines;
- dollar-volume baselines;
- prior close;
- breakout/breakdown references;
- VWAP transitions;
- relative-strength comparisons;
- sector comparisons;
- catalyst association.

No forward tolerance or interpolation is authorized.

## 9. Freshness and Fail-Closed Policy

Required semantics:

```text
missing != zero
missing != neutral evidence
stale != current
unknown catalyst != no catalyst
price move != confirmed demand
volume spike != bullish
```

The Source & Freshness Matrix governs normalized evidence. A stale required
input cannot drive an anomaly conclusion as if current. Missing, stale,
incompatible, contradictory, or insufficient evidence must:

- prevent the affected anomaly classification; or
- emit an explicitly GREY/degraded, low-confidence audit result where the
  approved output contract supports it.

No forced directional conclusion is permitted. A stale candidate cannot have
high confidence. Conflicting evidence must remain visible in opposing evidence
and confidence degradation.

## 10. Alert and DiscoveryCandidate Output Policy

`DiscoveryCandidate` follows
`docs/DATA_CONTRACTS_AMENDMENT_003_ANOMALY_DISCOVERY.md`.

Within one evaluation:

- emit at most one candidate per symbol;
- preserve all valid anomaly types for that symbol;
- emit at most one Alert per symbol/anomaly type;
- de-duplicate by deterministic identity and provenance, never numeric
  equality;
- preserve supporting and opposing evidence;
- retain source snapshot and catalyst IDs;
- keep all outputs SHADOW and non-authoritative.

`Alert.trafficLight` summarizes anomaly evidence quality/conflict only. It must
not be interpreted as a buy/sell light.

## 11. AI Discovered and My Focus Separation

`AI Discovered` is the deterministic Anomaly Radar output stream in Package
003. It remains separate from `My Focus`, which is user-selected.

Package 003 may create `DiscoveryCandidate` records only. It must not:

- mutate My Focus;
- automatically promote a candidate into My Focus;
- run deep Stock Decision Engine logic;
- create Trade Decision Zones;
- create portfolio actions.

Promotion is a separate later user-controlled workflow. The product label AI
Discovered does not authorize ML or LLM analysis in this package.

## 12. Rule Profile Authority

The later implementation must create one externalized profile:

```text
ruleProfileId: anomaly-radar.experimental.v0.3
version: 0.3.0
description: explicit SHADOW validation description
status: EXPERIMENTAL
lifecycle: SHADOW
engineId: anomaly-radar-engine
engineVersion: 0.3-shadow
```

Thresholds remain configuration, not hidden engine state. Configuration may
include:

- `minimumRelativeVolume`;
- `gapThresholdPct`;
- `abnormalDollarVolumeThreshold`;
- `vwapDistanceThreshold`;
- `relativeStrengthThreshold`;
- `breakoutThreshold`;
- `minimumEvidenceFamilies`;
- `conflictMagnitude`;
- past-only reference windows and tolerances;
- past-only catalyst-association window.

All thresholds are synthetic and EXPERIMENTAL. They must not be characterized
as empirically validated, predictive, production-ready, or production
analytical weights.

## 13. Determinism

Required invariant:

```text
same normalized inputs
+ same evaluatedAt
+ same rule profile
+ same engine version
= byte-for-byte identical canonical output
```

No randomness, current-clock access, unstable iteration, insertion-order
dependency, or process-local ID sequence is permitted.

Required deterministic ordering:

- StockSnapshot processing: timestamp, symbol, snapshot ID;
- SectorSnapshot processing: timestamp, sector ID, snapshot ID;
- CatalystEvent processing: timestamp, event ID;
- anomaly types: Data Contract Amendment 003 enum order;
- evidence arrays: evidence ID;
- catalyst event IDs: lexical event ID;
- source snapshot IDs: lexical snapshot ID;
- candidates: symbol, candidate ID;
- alerts: symbol, anomaly-type enum order, alert ID.

Canonical output must remain identical when semantically unordered normalized
input arrays arrive in different insertion order.

## 14. Required Mock Scenario Matrix

Later implementation must add at least these scenarios:

1. `RVOL_SPIKE`
2. `ABNORMAL_DOLLAR_VOLUME`
3. `GAP_UP_CONFIRMED`
4. `GAP_DOWN_CONFIRMED`
5. `VWAP_RECLAIM`
6. `VWAP_BREAKDOWN`
7. `BREAKOUT_CONFIRMED`
8. `BREAKDOWN_CONFIRMED`
9. `RELATIVE_STRENGTH_ACCELERATION`
10. `RELATIVE_STRENGTH_DETERIORATION`
11. `PRICE_VOLUME_DIVERGENCE`
12. `SECTOR_CONFIRMATION`
13. `SECTOR_DIVERGENCE`
14. `CATALYST_ASSOCIATED_MOVE`
15. `ABNORMAL_MOVE_WITHOUT_CATALYST`
16. `STALE_STOCK_DATA`
17. `MISSING_VOLUME`
18. `MISSING_SECTOR_CONTEXT`
19. `FUTURE_SNAPSHOT_REJECTION`
20. `MULTIPLE_ANOMALIES_SAME_SYMBOL`
21. `DUPLICATE_ALERT_PREVENTION`
22. `DETERMINISTIC_ORDERING`

Every fixture and fixture source must state exactly:

```text
MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA
```

No mock may be presented as observed market data.

## 15. Required Automated Tests

Later implementation must test at least:

1. deterministic canonical output;
2. deterministic result under reordered input arrays;
3. future stock snapshot rejection;
4. future sector snapshot rejection;
5. future catalyst fact/evidence rejection;
6. stale evidence fail-closed behavior;
7. missing evidence fail-closed behavior;
8. relative-volume spike detection;
9. abnormal dollar-volume detection;
10. gap-up and gap-down detection;
11. VWAP reclaim and breakdown transitions;
12. breakout and breakdown against past-only references;
13. relative-strength acceleration and deterioration;
14. price/volume divergence;
15. sector confirmation;
16. sector divergence;
17. catalyst association without claiming causation;
18. no-catalyst behavior without claiming proof of no catalyst;
19. multiple anomaly preservation for one symbol;
20. duplicate Alert prevention;
21. duplicate DiscoveryCandidate prevention;
22. deterministic candidate and alert ordering;
23. supporting/opposing conflict preservation;
24. anomaly output contains no BUY/SELL/trade semantics;
25. `DiscoveryCandidate` contract validation and deterministic round trip;
26. EngineMeta version/rule-profile/lifecycle validation;
27. all Package 003 functionality defaults SHADOW;
28. SHADOW cannot influence production composite state;
29. AI Discovered remains separate from My Focus;
30. engine performs no network access and imports no adapter/provider payload;
31. Package 001 regression;
32. Package 002 regression, including remediation tests;
33. architecture guard;
34. V5 integrity.

No required test may be skipped.

## 16. Required Validation

Later execution must run:

```text
npm_config_offline=true npm run check
```

Required result:

- all tests PASS;
- zero failed;
- zero skipped;
- build PASS;
- architecture guard PASS;
- V5 integrity PASS;
- Package 001 regression PASS;
- Package 002 regression PASS;
- main unchanged;
- deterministic canonical output preserved.

## 17. Lifecycle and Composite Isolation

The authoritative lifecycle is `OFF|SHADOW|BETA|ACTIVE`.

All Package 003 functionality starts and remains `SHADOW`. No Package 003
feature may become `ACTIVE`. SHADOW may compute and persist validation data but
must not render as an active production feature or influence any production
composite state. Only `ACTIVE` may influence production composite state.

Package 003 alerts and candidates are evaluation artifacts, not authoritative
production decision signals.

## 18. Explicit Non-Scope

Package 003 does not authorize:

- live market providers;
- scraping;
- production API keys;
- broker connectivity or broker execution;
- real-money execution;
- Stock Decision Engine;
- Trade Decision Zones;
- Portfolio Context Engine;
- automatic My Focus promotion;
- production anomaly-scanner deployment;
- production analytical weights;
- ML or neural networks;
- LLM market analysis;
- AI-generated narrative;
- production UI activation;
- production deployment;
- V5 modification;
- main modification or merge;
- Package 004 work.

## 19. Future Implementation Commit and Report Policy

A separately authorized implementation must produce exactly two ordered
commits:

1. one Package 003 implementation commit containing only narrowly necessary
   contract/validator, engine, rule-profile, mock, and test changes;
2. after successful validation, one separate report commit adding
   `docs/EXECUTION_003_REPORT.md`.

The report must record:

- starting remote HEAD;
- architecture authority commit;
- implementation commit SHA;
- exact files changed;
- contract and engine behavior;
- rule profile;
- mock scenarios;
- exact tests passed/failed/skipped;
- build, architecture guard, and V5 results;
- main integrity;
- SHADOW isolation;
- forbidden-scope verification;
- architectural deviations;
- unresolved issues;
- exact next recommended action.

After the report commit, stop. Package 003 remains pending independent review.
Do not begin Package 004 and do not auto-continue.

## 20. Acceptance Criteria for Later Implementation

Package 003 may report PASS only if:

1. the Anomaly Radar is deterministic and normalized-contract-only;
2. every required anomaly class is test-covered;
3. future, stale, missing, and insufficient evidence fails closed;
4. conflict and provenance remain visible;
5. candidate and alert identities/order are deterministic and duplicate-free;
6. anomaly output contains no trade-decision semantics;
7. AI Discovered and My Focus remain separate;
8. all Package 003 features remain SHADOW;
9. no output influences production composite state;
10. all Package 001, Package 002, Package 003, architecture, build, and V5
    validations pass with zero skips;
11. main and V5 remain unchanged;
12. implementation and report are separate commits;
13. no forbidden or Package 004 scope is introduced.

PARTIAL applies only when useful bounded work exists but a non-critical
acceptance criterion remains incomplete. BLOCKED applies when determinism,
time integrity, provenance, fail-closed behavior, lifecycle isolation, baseline
integrity, or V5/main integrity cannot be preserved.

## 21. Stop Condition

This architecture document does not authorize implementation. A later explicit
authorization must name this package and provide its required starting remote
HEAD.

After a later Package 003 implementation and separate report commit, stop.
Package 004 remains unauthorized.
