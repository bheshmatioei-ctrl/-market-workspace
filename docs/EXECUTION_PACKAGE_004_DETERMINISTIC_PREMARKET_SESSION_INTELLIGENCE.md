# Execution Package 004 — Deterministic Premarket Session Intelligence

Status: ARCHITECTURE AUTHORITY — IMPLEMENTATION REQUIRES SEPARATE AUTHORIZATION

Repository: `bheshmatioei-ctrl/-market-workspace`

Branch: `decision-cockpit-v1`

Depends on: APPROVED Execution Packages 001, 002, and 003

## 0. Authority and Execution Boundary

This document defines a later, strictly bounded Package 004 implementation.
Creation of this document does not authorize implementation code.

Package 004 establishes deterministic SHADOW interpretation of normalized
extended-hours state. It preserves the independent `AFTERHOURS`, `OVERNIGHT`,
and `PREMARKET` windows, emits a provenance-preserving `PremarketSnapshot`, and
freezes that record at an explicitly supplied regular open.

It is not a live-data integration package, UI package, opening-probability
forecast, Stock Decision Engine, Trade Decision Zones package, broker execution
package, or deployment package.

Required logical flow:

```text
Normalized Extended-Hours State
        +
Catalyst / Global Context
        |
        v
Explicit Session Window Classification
        |
        v
Deterministic Premarket Intelligence Engine
        |
        v
PremarketSnapshot
        |
        v
SHADOW Validation
        |
        v
Freeze at Explicit Regular Open
```

If a later implementation choice conflicts with the binding authorities, it
must stop and report BLOCKED rather than inventing architecture in code.

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
11. `docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md`
12. `docs/EXECUTION_001_REPORT.md`
13. `docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md`
14. `docs/EXECUTION_002_REPORT.md`
15. `docs/EXECUTION_PACKAGE_002_REMEDIATION.md`
16. `docs/EXECUTION_002_REMEDIATION_REPORT.md`
17. `docs/EXECUTION_PACKAGE_003_DETERMINISTIC_ANOMALY_RADAR.md`
18. `docs/EXECUTION_003_REPORT.md`
19. `docs/DATA_CONTRACTS_AMENDMENT_004_PREMARKET_SESSION_INTELLIGENCE.md`
20. `docs/EXECUTION_PACKAGE_004_DETERMINISTIC_PREMARKET_SESSION_INTELLIGENCE.md`

The first eighteen entries preserve the required existing authority order.
Data Contracts Amendment 004 adds only the Package 004 contract authority, and
this document adds only the Package 004 execution boundary.

## 2. Starting Conditions for Later Execution

Before changing code, a separately authorized Package 004 execution must:

1. verify the current branch is `decision-cockpit-v1`;
2. verify the exact Package 004 starting remote HEAD supplied by the later
   execution instruction;
3. verify `main` remains at its separately supplied expected SHA;
4. verify Package 001, 002, and 003 approval reports and authorities exist;
5. verify V5 remains unchanged;
6. run `npm_config_offline=true npm run check` before implementation;
7. require the existing 95 tests, build, architecture guard, V5 integrity, and
   Package 001/002/003 regressions to pass;
8. stop as BLOCKED before modifying code if any baseline check fails;
9. confirm no Package 004 feature is `ACTIVE` and only `ACTIVE` may influence
   production composite state.

## 3. Strict Package Scope

A later Package 004 execution may implement only:

1. additive normalized contracts and validators authorized by Data Contracts
   Amendment 004;
2. deterministic canonical serialization for those contracts;
3. deterministic `PremarketIntelligenceEngine`;
4. explicit session-window classification from `MarketSessionBoundary`;
5. independent `PremarketWindowAssessment[]` generation;
6. additive `PremarketSnapshot` fields and deterministic freeze-at-open
   behavior;
7. versioned EXPERIMENTAL SHADOW rule profile;
8. deterministic Package 004 mock scenarios;
9. Package 004 automated tests and required regressions;
10. narrowly necessary immutable frozen-record support that does not add a
    provider, UI, deployment, or production integration.

No source outside this scope may be modified. Any proposed additional input,
output, analytical engine, or product surface requires a separate architecture
decision and is not implicitly authorized.

## 4. Engine Declaration

The future engine declaration is:

```text
engineId: premarket-intelligence-engine
engineVersion: 0.4-shadow
ruleProfileId: premarket-intelligence.experimental.v0.4
ruleProfileVersion: 0.4.0
status: EXPERIMENTAL
lifecycle: SHADOW
deterministic: true
```

The engine must consume normalized contracts only, perform no network access,
preserve source provenance, and emit only non-authoritative SHADOW output. The
configuration is synthetic and experimental, not production-calibrated or
empirically validated.

## 5. Allowed Normalized Inputs

The initial Package 004 engine may consume only:

- `MarketSessionBoundary`;
- `FuturesSnapshot[]`;
- `MarketSnapshot[]`;
- `PremarketStockSnapshot[]`;
- `SectorSnapshot[]`;
- `CatalystEvent[]`;
- `GlobalRotationAssessment[]`;
- `DiscoveryCandidate[]`.

Provider payloads, direct REST/vendor objects, scraped material, UI-created
analytics, and AI-created numeric market values are forbidden.

If implementation needs any other input contract, it must stop and record an
unresolved architecture decision. It must not silently expand scope.

## 6. Session Calendar and Window Architecture

Package 004 requires an explicit normalized `MarketSessionBoundary` with all
four UTC timestamps:

```text
priorRegularCloseTimestamp
afterhoursEndTimestamp
premarketStartTimestamp
regularOpenTimestamp
```

The engine classifies observations only against that supplied boundary:

```text
AFTERHOURS = prior regular close -> afterhours end
OVERNIGHT  = afterhours end -> premarket start
PREMARKET  = premarket start -> regular open
```

The exact inclusive/exclusive intervals and validation rules are defined by
Data Contracts Amendment 004.

Analytical code must not:

- hard-code `09:30` or any local-clock value;
- calculate exchange session boundaries;
- infer a timezone or convert from a guessed local timezone;
- embed daylight-saving rules;
- invent holiday, early-close, or special-session semantics;
- infer session identity from timestamp, `scopeId`, or array position.

This explicit calendar authority prevents DST drift, holiday errors,
early-close errors, special-session errors, and exchange-calendar ambiguity.
Missing, invalid, or contradictory boundaries fail closed.

## 7. Session Identity and Isolation

Every session-bound Market, Futures, Premarket Stock, and Sector observation
used by Package 004 must have explicit `SessionIdentity` compatible with the
supplied boundary.

The mapping is exact:

```text
afterhours -> AFTERHOURS
overnight  -> OVERNIGHT
premarket  -> PREMARKET
regular    -> reject from premarket evidence
```

Protected invariant:

```text
AFTERHOURS evidence
!= OVERNIGHT evidence
!= PREMARKET evidence
!= REGULAR evidence
```

Rules:

1. Each eligible input must match `sessionDate`, `sessionCalendarId`, phase, and
   explicit timestamp interval.
2. Missing identity or unprovable equivalence fails closed.
3. Evidence from the three extended-hours windows is assessed independently
   before any composite interpretation.
4. A regular-session observation supplied to a premarket-only calculation is
   rejected or causes the affected calculation to fail closed.
5. Regular-session data must never silently contaminate `PremarketSnapshot`.

## 8. Futures State

The engine evaluates ES, NQ, and RTY independently before interpreting futures
context.

It must preserve:

- each instrument's normalized change from its explicit prior cash close;
- freshness, volume, source provenance, and missingness;
- agreement, disagreement, and absent components.

Example:

```text
ES  positive
NQ  strongly positive
RTY negative
```

This may yield `MIXED / ORANGE` with explicit supporting and opposing evidence.
It must not be forced to `GREEN` by averaging away RTY disagreement. Missing or
stale futures components are not zero or neutral, and cannot support false
alignment.

No futures value is a measured cash-flow value. Futures direction alone cannot
prove broad equity demand.

## 9. Extended-Hours Window Assessment

The engine emits one `PremarketWindowAssessment` for each evaluable window:

- `AFTERHOURS`;
- `OVERNIGHT`;
- `PREMARKET`.

Each assessment retains its own:

- traffic-light state;
- direction;
- confidence and freshness;
- supporting evidence;
- opposing evidence;
- source snapshot IDs;
- SHADOW `EngineMeta`.

The engine must not average the three windows into one raw historical period
before retaining their independent states. Reversals, such as overnight
deterioration followed by premarket recovery, must remain visible rather than
being collapsed into artificial neutrality.

Missing or insufficient evidence yields `GREY / UNKNOWN` or an explicitly
degraded assessment. No directional certainty is forced.

## 10. Premarket Stock and Liquidity Semantics

`PremarketStockSnapshot[]` may support deterministic participation, mover,
focus-risk, and discovery-context interpretation.

Mandatory rules:

- thin liquidity reduces confidence;
- `INSUFFICIENT` liquidity cannot produce high-confidence direction;
- missing relative premarket volume is not zero;
- missing catalyst is not proof of no catalyst;
- price gap alone is not confirmed demand or selling pressure;
- dollar volume is activity, not measured inflow/outflow;
- stale or non-comparable stock evidence fails closed or degrades explicitly;
- sector context must be session-compatible and fresh before it can confirm a
  stock move.

Package 004 may describe observed extended-hours behavior. It must not perform
deep Stock Decision Engine logic or generate trade zones.

## 11. Participation Proxy

Package 004 may deterministically emit proxy states:

```text
BROAD_DEMAND_PROXY
BROAD_SELLING_PRESSURE_PROXY
CONCENTRATED_DEMAND
CONCENTRATED_SELLING
MIXED
INSUFFICIENT
```

Proxy evidence cannot create fabricated measured cash flow. In particular, the
engine must never claim that a dollar amount entered or left United States
equities unless a compatible DIRECT measured-flow contract supports that exact
claim.

Required integrity:

- DIRECT and PROXY evidence remain separate;
- PROXY evidence never creates `directFlowValue`;
- missing DIRECT evidence is not zero;
- volume, gaps, breadth, sector participation, futures, and anomalies remain
  proxies unless explicitly represented by compatible DIRECT evidence;
- contradictions between direct and proxy channels remain visible.

## 12. Catalyst and Scheduled Risk

Package 004 may use the additive optional `CatalystEvent.impactTier` authorized
by Data Contracts Amendment 004.

A scheduled future event can be known before evaluation and can reduce
confidence when its release remains pending before regular open. It cannot be
treated as occurred evidence.

Example:

```text
constructive current premarket evidence
+ pending HIGH-impact macro release before open
= constructive state may remain with degraded confidence
```

Protected invariant:

```text
KNOWN FUTURE EVENT != OCCURRED EVENT
```

Only an eligible normalized occurred/released event whose observation and
receipt timestamps are at or before evaluation may contribute as released
catalyst evidence. Unknown catalyst status is not proof of no catalyst.

## 13. Global Rotation Context

`GlobalRotationAssessment[]` is context, not a substitute for current United
States premarket evidence.

Allowed short-horizon context:

- `overnight`;
- `1d`.

Longer horizons:

- `5d`;
- `1m`;
- structural.

Longer horizons remain labeled with their true horizon. Monthly or structural
data must not be transformed into overnight flow or intraday evidence.
United States/global disagreement must be preserved as explicit opposing
evidence or conflict rather than averaged away.

## 14. AI Discovered and My Focus

The permanent ownership boundary remains:

- My Focus: user-selected universe;
- AI Discovered: `DiscoveryCandidate`-derived universe.

Package 004 may reference both streams for premarket context. It must not:

- automatically promote AI Discovered into My Focus;
- mutate My Focus;
- run Stock Decision Engine logic;
- create Stock Decision State;
- create Trade Decision Zones;
- create portfolio or broker actions.

## 15. PremarketSnapshot and Freeze at Open

The engine preserves every existing `PremarketSnapshot` field and adds only the
fields authorized by Data Contracts Amendment 004.

Before explicit regular open:

```text
freezeStatus = LIVE
frozenAt = null
```

When evaluation reaches the supplied boundary:

```text
freezeStatus = FROZEN
frozenAt = MarketSessionBoundary.regularOpenTimestamp
```

The regular open comes only from
`MarketSessionBoundary.regularOpenTimestamp`, never hard-coded `09:30`.

Once frozen, the `PremarketSnapshot` becomes immutable historical evidence.
After freeze:

- post-open market data cannot modify it;
- a regular-session `MarketSnapshot` cannot modify it;
- a later `CatalystEvent` cannot rewrite it;
- a later anomaly or discovery result cannot rewrite it;
- a process restart or later evaluation cannot change its canonical bytes.

Corrections require a new separately versioned record with a new identity and
explicit correction provenance. The frozen historical record is never mutated.

Package 004 does not issue a `PredictionRecord` and does not integrate with
Model Test.

## 16. Time Integrity

For evaluation at `T`, all consumed facts must satisfy:

```text
input.timestamp <= T
sourceMeta.observedAt <= T
sourceMeta.receivedAt <= T
historicalOrReference.timestamp <= targetTimestamp <= T
```

Mandatory protections:

- no future `FuturesSnapshot`;
- no future `MarketSnapshot`;
- no future `PremarketStockSnapshot`;
- no future `SectorSnapshot`;
- no future occurred-event fact;
- no future source observation or source receipt;
- no future historical/reference baseline;
- no interpolation;
- no forward tolerance;
- no post-open evidence in the premarket calculation;
- no look-ahead through futures reference close, volume, relative volume,
  sector comparison, global context, catalyst association, discovery context,
  or window transitions.

A future scheduled event may be retained only as explicitly pending risk. It
cannot be treated as a future fact about the event outcome.

## 17. Freshness and Fail-Closed Semantics

The approved Source Freshness Matrix remains binding. Package 004 preserves:

```text
missing != zero
missing != neutral evidence
stale != current
unknown catalyst != no catalyst
price move != confirmed demand
volume spike != bullish
proxy participation != measured cash flow
```

Missing, stale, insufficient, contradictory, non-comparable, or
session-incompatible evidence must:

- be rejected where the contract is invalid;
- otherwise degrade confidence and freshness explicitly;
- return `GREY / UNKNOWN / INSUFFICIENT` where the required evidence cannot be
  established;
- remain visible in opposing evidence or degradation metadata where supported.

It must never be coerced into directional certainty.

## 18. Rule Profile

Later execution must implement:

```text
profileId: premarket-intelligence.experimental.v0.4
version: 0.4.0
status: EXPERIMENTAL
lifecycle: SHADOW
```

All thresholds are externalized, versioned configuration. Potential dimensions
include only:

- `minimumFuturesEvidenceFamilies`;
- `futuresConflictMagnitude`;
- `participationMinimumFamilies`;
- `minimumLiquidityQuality`;
- `pendingEventConfidencePenalty`;
- `highImpactEventWindowSeconds`;
- `maximumPremarketStockAgeSeconds`;
- `maximumFuturesAgeSeconds`;
- `maximumSectorAgeSeconds`;
- `minimumGlobalContextFamilies`.

Thresholds must be documented as synthetic, experimental, and not
production-calibrated. They must not be hidden engine state. Package 004 must
not introduce production analytical weights.

## 19. Determinism

Mandatory invariant:

```text
same normalized inputs
+ same evaluatedAt
+ same MarketSessionBoundary
+ same rule profile
+ same engine version
= byte-for-byte identical canonical output
```

Required deterministic ordering:

```text
FuturesSnapshot:
  instrument, timestamp, snapshotId

PremarketStockSnapshot:
  symbol, timestamp, snapshotId

SectorSnapshot:
  sectorId, timestamp, snapshotId

CatalystEvent:
  timestamp, eventId

GlobalRotationAssessment:
  countryOrRegion, horizon, assessmentId

DiscoveryCandidate:
  symbol, candidateId

PremarketWindowAssessment:
  AFTERHOURS, OVERNIGHT, PREMARKET; then assessmentId

Evidence:
  evidenceId

sourceSnapshotIds:
  lexical
```

No randomness, process-local IDs, input-array-order dependence, locale-specific
sorting, unordered-set leakage, or system-current-time dependency beyond the
explicit `evaluatedAt` is permitted.

## 20. Required Mock Scenarios

Later execution must create deterministic fixtures for at least:

1. `ALL_CONSTRUCTIVE`
2. `MIXED_FUTURES`
3. `BROAD_RISK_OFF`
4. `AFTERHOURS_ONLY`
5. `OVERNIGHT_DETERIORATION`
6. `PREMARKET_RECOVERY`
7. `OVERNIGHT_TO_PREMARKET_REVERSAL`
8. `WINDOW_SEPARATION`
9. `FUTURE_INPUT_REJECTION`
10. `REGULAR_SESSION_INPUT_REJECTION`
11. `STALE_FUTURES`
12. `STALE_MARKET_CONTEXT`
13. `THIN_PREMARKET_LIQUIDITY`
14. `BROAD_PARTICIPATION`
15. `CONCENTRATED_PARTICIPATION`
16. `HIGH_IMPACT_EVENT_PENDING`
17. `HIGH_IMPACT_EVENT_RELEASED`
18. `GLOBAL_US_DISAGREEMENT`
19. `FOCUS_STOCK_RISK`
20. `AI_DISCOVERED_PREMARKET`
21. `FREEZE_AT_OPEN`
22. `POST_OPEN_MUTATION_REJECTION`
23. `DETERMINISTIC_ORDERING`

Every fixture and mock data source must visibly state:

```text
MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA
```

Mocks must contain no fabricated claim that they represent real market data.

## 21. Required Future Tests

Later implementation must add automated tests covering all categories below.

### 21.1 Contracts

- `MarketSessionBoundary` validation;
- `FuturesSnapshot` validation;
- `PremarketStockSnapshot` validation;
- `PremarketWindowAssessment` validation;
- additive `PremarketSnapshot` extension validation;
- invalid boundary ordering rejection;
- missing/contradictory `SessionIdentity` fail-closed behavior;
- canonical serialization and runtime validation.

### 21.2 Time integrity

- future `FuturesSnapshot` rejection;
- future `MarketSnapshot` rejection;
- future `PremarketStockSnapshot` rejection;
- future `SectorSnapshot` rejection;
- future `CatalystEvent` fact rejection;
- future source observation rejection;
- future source receipt rejection;
- past-only historical/reference selection;
- no interpolation or forward tolerance;
- no post-open evidence in premarket calculation.

### 21.3 Session classification and isolation

- afterhours classification;
- overnight classification;
- premarket classification;
- regular-session contamination rejection;
- explicit calendar-boundary use;
- missing boundary fail-closed behavior;
- no hard-coded timezone/session inference;
- window separation and reversal preservation;
- holiday/early-close behavior follows supplied boundaries without engine
  calendar logic.

### 21.4 Futures

- aligned ES/NQ/RTY;
- conflicting ES/NQ/RTY;
- missing futures component;
- stale futures;
- disagreement remains explicit;
- no unlabeled averaging into false consensus.

### 21.5 Participation

- broad participation;
- concentrated participation;
- missing participation evidence;
- mixed participation conflict preservation;
- proxy cannot fabricate direct cash flow;
- DIRECT and PROXY remain separate;
- dollar volume does not become measured inflow.

### 21.6 Liquidity

- thin-liquidity confidence degradation;
- insufficient liquidity cannot emit high-confidence state;
- missing relative volume remains missing;
- gap alone does not create confirmed demand/selling pressure.

### 21.7 Catalyst

- pending `HIGH`-impact event reduces confidence;
- pending `CRITICAL` event remains future risk;
- future event is not treated as occurred;
- released eligible event may contribute;
- unknown catalyst does not mean no catalyst;
- later post-open catalyst cannot rewrite a frozen snapshot.

### 21.8 Global context

- overnight/1d context accepted when eligible;
- structural context is not converted into overnight flow;
- 5d/1m context remains correctly labeled;
- United States/global disagreement remains explicit.

### 21.9 Freeze and immutability

- `LIVE` before open with `frozenAt=null`;
- frozen exactly at explicit `regularOpenTimestamp`;
- no hard-coded `09:30` dependency;
- frozen snapshot is immutable;
- post-open market data cannot rewrite frozen state;
- post-open catalyst cannot rewrite frozen state;
- later anomaly/discovery cannot rewrite frozen state;
- a correction creates a new version rather than mutation.

### 21.10 My Focus / AI Discovered separation

- AI Discovered remains separate from My Focus;
- no automatic promotion;
- My Focus is not mutated;
- no Stock Decision Engine output;
- no Trade Decision Zones or portfolio action.

### 21.11 Determinism

- canonical byte identity;
- reordered input arrays produce identical output;
- deterministic IDs;
- deterministic window order;
- deterministic evidence ordering;
- deterministic source snapshot ordering;
- no implicit system-time dependency.

### 21.12 Lifecycle and isolation

- Package 004 defaults `SHADOW`;
- Premarket `EngineMeta` is `SHADOW`;
- no `ACTIVE` Package 004 feature;
- SHADOW cannot influence production composite state;
- engine imports no provider adapters;
- engine performs no network access;
- UI contains no new analytical logic.

### 21.13 Regression

- Package 001 regression PASS;
- Package 002 regression PASS;
- Package 003 regression PASS;
- all existing 95 tests remain PASS;
- architecture guard PASS;
- V5 integrity PASS;
- main unchanged.

## 22. Future Validation Gate

Later Package 004 execution must run:

```bash
npm_config_offline=true npm run check
```

Required result:

- all tests PASS;
- 0 failed;
- 0 skipped;
- build PASS;
- architecture guard PASS;
- V5 integrity PASS;
- Package 001 regression PASS;
- Package 002 regression PASS;
- Package 003 regression PASS;
- canonical determinism PASS;
- lifecycle isolation PASS;
- main unchanged.

If any check fails, Package 004 execution must stop as PARTIAL or BLOCKED and
must not create a passing report claim.

## 23. Lifecycle and Composite Isolation

All Package 004 functionality starts and remains `SHADOW`.

- no Package 004 feature may become `ACTIVE`;
- SHADOW outputs may be computed, serialized, and tested only;
- SHADOW outputs cannot render as authoritative production intelligence;
- SHADOW outputs cannot influence production composite state;
- only `ACTIVE` may influence production composite state;
- Package 004 may not change lifecycle authority or production feature flags.

## 24. Explicit Non-Scope

Package 004 does not authorize:

- live market adapters;
- CME integration;
- licensed-feed integration;
- production API keys;
- scraping;
- news ingestion engine;
- news ranking engine;
- LLM summary or AI narrative;
- Opening Scenario probabilities;
- Base/Bull/Bear probabilities;
- PredictionRecord issuance;
- Model Test integration;
- Stock Decision Engine;
- Trade Decision Zones;
- Portfolio Context Engine;
- automated My Focus promotion;
- Premarket UI implementation;
- broker connectivity;
- broker or real-money execution;
- production analytical weights;
- ML or neural networks;
- deployment or production anomaly/premarket activation;
- V5 modification;
- `main` modification;
- merge;
- Package 005 work.

## 25. Later Implementation Commit Policy

A separately authorized implementation phase must:

1. verify the starting baseline and run the baseline validation before edits;
2. implement only the scope in this authority and Data Contracts Amendment 004;
3. run `npm_config_offline=true npm run check` successfully;
4. create one separate Package 004 implementation commit containing only:
   - Package 004 contract implementation, validation, and serialization;
   - `PremarketIntelligenceEngine` and narrowly necessary freeze support;
   - Package 004 EXPERIMENTAL SHADOW rule profile;
   - Package 004 mock scenarios;
   - Package 004 tests and strictly necessary support code;
5. exclude the execution report from that implementation commit;
6. create `docs/EXECUTION_004_REPORT.md` after the implementation commit;
7. record starting HEAD, authority commit, implementation SHA, exact files,
   contracts, engine behavior, windows, freeze behavior, profile, mocks, exact
   test results, determinism, time/session/freshness integrity, SHADOW isolation,
   build, guards, V5, regressions, main verification, prohibited-scope checks,
   deviations, unresolved issues, and exact next action;
8. commit the report in a second, separate commit;
9. push `decision-cockpit-v1`;
10. stop without merging, deploying, approving itself, or starting Package 005.

After implementation, Package 004 status remains:

```text
IMPLEMENTED_PENDING_INDEPENDENT_REVIEW
```

Package 004 can be approved only through independent review in the control
chat. Package 005 remains unauthorized.

## 26. Acceptance Criteria for Later Implementation

Package 004 implementation can report PASS only when all of the following are
true:

1. contracts match Data Contracts Amendment 004 additively;
2. the engine consumes only the eight approved normalized inputs;
3. explicit boundaries classify all eligible evidence;
4. AFTERHOURS, OVERNIGHT, and PREMARKET remain independently assessed;
5. regular-session contamination is rejected;
6. future and post-open evidence cannot enter premarket calculation;
7. ES/NQ/RTY disagreement remains explicit;
8. proxy evidence never fabricates DIRECT cash flow;
9. liquidity and scheduled-event risks degrade confidence deterministically;
10. global horizons retain their true semantics;
11. My Focus and AI Discovered remain separate;
12. freeze occurs at the explicit regular open and the frozen record is
    immutable;
13. canonical output is byte-identical under input reordering;
14. all Package 004 features remain SHADOW and isolated from production
    composite state;
15. every required mock and automated test exists and passes;
16. build, architecture guard, V5 integrity, Packages 001/002/003 regressions,
    and main integrity pass;
17. no prohibited scope or Package 005 work exists;
18. implementation and report are separate commits;
19. no architectural deviation or unresolved issue is hidden.

## 27. Stop Conditions

Later execution must stop and report rather than inventing behavior if:

- any baseline SHA differs;
- an authority document is missing or contradictory;
- an additional input or output appears necessary;
- session boundaries or session equivalence cannot be proven;
- a required timestamp, provenance, freshness, or unit is unavailable;
- freeze immutability cannot be guaranteed;
- validation, build, guards, V5, or regression checks fail;
- implementation would modify V5, `main`, UI, provider integration, deployment,
  or Package 005 scope.

No auto-continue is authorized.
