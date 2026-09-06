# Execution Package 006 — Deterministic Stock Decision Intelligence

Status: ARCHITECTURE AUTHORITY — IMPLEMENTATION REQUIRES SEPARATE AUTHORIZATION

Branch: `decision-cockpit-v1`

Package 006 implementation: UNAUTHORIZED

Package 007: UNAUTHORIZED

## 0. Authority and Execution Boundary

This document defines architecture authority for a later, separately
authorized Package 006 implementation. Creating this document does not
authorize implementation.

Package 006 may later implement a deterministic SHADOW Stock Decision Engine
for deep analysis of:

- user-selected My Focus stocks; and
- explicitly selected AI Discovered candidates.

Required flow:

```text
Explicit Stock Analysis Selection
        +
StockSnapshot history
        +
Market Regime
        +
Market Direction
        +
Sector Context
        +
Catalyst Risk
        ↓
Deterministic Stock Decision Engine
        ↓
STOCK DecisionState
        ↓
SHADOW validation only
```

The package does not authorize trading commands, Trade Decision Zones,
options analytics, portfolio action, prediction issuance, UI integration,
live data, execution, deployment, or Package 007.

## 1. Binding Architecture Authority Order

A later implementation must read and obey these authorities in order:

1. `docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md`
2. `docs/ARCHITECTURE_AMENDMENT_001_FEATURE_LIFECYCLE.md`
3. `docs/ARCHITECTURE_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
4. `docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md`
5. `docs/MASTER_DATA_CONTRACTS_v1.md`
6. `docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md`
7. `docs/DATA_CONTRACTS_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
8. `docs/DATA_CONTRACTS_AMENDMENT_003_ANOMALY_DISCOVERY.md`
9. `docs/DATA_CONTRACTS_AMENDMENT_004_PREMARKET_SESSION_INTELLIGENCE.md`
10. `docs/DATA_CONTRACTS_AMENDMENT_005_COCKPIT_PRESENTATION.md`
11. `docs/SOURCE_FRESHNESS_MATRIX_v1.md`
12. `docs/ENGINE_DEPENDENCY_GRAPH_v1.md`
13. `docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md`
14. `docs/EXECUTION_001_REPORT.md`
15. `docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md`
16. `docs/EXECUTION_002_REPORT.md`
17. `docs/EXECUTION_PACKAGE_002_REMEDIATION.md`
18. `docs/EXECUTION_002_REMEDIATION_REPORT.md`
19. `docs/EXECUTION_PACKAGE_003_DETERMINISTIC_ANOMALY_RADAR.md`
20. `docs/EXECUTION_003_REPORT.md`
21. `docs/EXECUTION_PACKAGE_004_DETERMINISTIC_PREMARKET_SESSION_INTELLIGENCE.md`
22. `docs/EXECUTION_004_REPORT.md`
23. `docs/EXECUTION_PACKAGE_005_DETERMINISTIC_COCKPIT_PROJECTION.md`
24. `docs/EXECUTION_005_REPORT.md`
25. `docs/DATA_CONTRACTS_AMENDMENT_006_STOCK_DECISION_INTELLIGENCE.md`
26. this execution package.

The latest approved additive amendment controls where earlier draft language
conflicts. Lifecycle is `OFF | SHADOW | BETA | ACTIVE`; only `ACTIVE` may
influence production composite state.

If implementation needs an analytical input, evidence family, contract,
indicator, or semantic outside these authorities, it must stop and record an
unresolved architecture decision. Scope must not expand silently.

## 2. Starting Conditions for Later Execution

A separate implementation authorization must provide an exact starting remote
HEAD. Before modifying code, the implementer must verify:

- current branch is `decision-cockpit-v1`;
- remote HEAD equals the separately authorized exact SHA;
- main HEAD remains `f4483cb2ce7d0eec2f05337a1d0b566d0b778afa`;
- both Package 006 authority documents exist;
- `docs/EXECUTION_005_REPORT.md` exists;
- the worktree contains no unexplained changes.

Then run:

```text
npm_config_offline=true npm run check
```

Required baseline:

- 193 tests pass;
- 0 tests fail;
- 0 tests are skipped;
- build passes;
- architecture guard passes;
- V5 integrity passes.

Any mismatch is a stop condition. No implementation change is permitted after
a failed baseline gate.

## 3. Strict Future Package Scope

Package 006 may later implement only:

1. additive `StockAnalysisSubject` runtime contract and validation;
2. additive `StockDecisionContext` and the authorized companion extension to
   the existing `DecisionState`;
3. additive reuse of `SessionIdentity` on historical-comparison-capable
   `StockSnapshot` records;
4. deterministic `StockDecisionEngine`;
5. external versioned experimental SHADOW rule profile;
6. deterministic identity, canonical ordering, provenance, freshness, and
   fail-closed support;
7. twenty-four required deterministic mock scenarios;
8. automated Package 006 tests;
9. narrowly necessary compatibility and SHADOW feature support.

No full UI implementation is authorized. Package 005 remains presentation
authority, and stock-decision presentation requires a separate authorization.

## 4. Analysis Subject and Selection Boundary

The engine may analyze only an explicit, valid `StockAnalysisSubject`:

```text
StockAnalysisSubject {
  schemaVersion
  subjectId
  symbol
  origin
  selectedAt
  discoveryCandidateId
}
```

Allowed origins:

```text
MY_FOCUS
AI_DISCOVERED_SELECTED
```

Rules:

- `MY_FOCUS` is explicitly user-selected and requires
  `discoveryCandidateId=null`;
- `AI_DISCOVERED_SELECTED` is an explicit user selection of an existing
  approved candidate and requires a matching non-null candidate ID and symbol;
- an AI Discovered record alone is not eligible for deep analysis;
- no automatic promotion, implicit selection, or provider-created selection;
- symbol matching alone does not prove selection;
- invalid, missing, future, contradictory, or duplicate-conflicting selection
  fails closed.

## 5. Engine Declaration

The future engine is declared exactly as:

```text
engineId: stock-decision-engine
engineVersion: 0.6-shadow
ruleProfileId: stock-decision.experimental.v0.6
ruleProfileVersion: 0.6.0
status: EXPERIMENTAL
lifecycle: SHADOW
deterministic: true
```

The initial profile must be described explicitly as:

```text
SYNTHETIC
EXPERIMENTAL
NOT PRODUCTION-CALIBRATED
NOT EMPIRICALLY VALIDATED
```

No production calibration claim or production analytical weight is
authorized.

## 6. Allowed Inputs Only

The engine may consume only approved normalized:

- `StockAnalysisSubject[]`;
- `StockSnapshot[]`;
- `DecisionState` with `scope=MARKET`;
- `DirectionAssessment[]`;
- `SectorSnapshot[]`;
- `FlowAssessment[]`;
- `CatalystEvent[]`;
- `DiscoveryCandidate[]`.

`DiscoveryCandidate` is permitted only to validate provenance for
`AI_DISCOVERED_SELECTED`. It must never trigger analysis automatically.

Forbidden inputs include provider payloads, direct REST/vendor objects,
scraping results, UI-created analytics, unapproved indicator contracts, and
AI-created numeric market values. The engine performs no network access and
imports no provider adapter.

## 7. Options Evidence

```text
OPTIONS_EVIDENCE:
  status: DEFERRED
  reason: NO_APPROVED_NORMALIZED_OPTIONS_CONTRACT
```

Package 006 does not authorize options chains, implied volatility, gamma,
open interest analytics, put/call models, dealer positioning, or options
provider data. A separate authority is required.

## 8. Authorized Evidence Families

Initial deterministic stock analysis may use only approved normalized evidence
from these families:

- price behavior;
- `changePct`;
- volume;
- `relativeVolume`;
- VWAP;
- `distanceFromVWAPPct`;
- `relativeStrengthVsBenchmark`;
- sector context;
- approved MARKET regime context;
- approved market-direction context;
- approved flow context;
- catalyst/event risk;
- freshness;
- supporting and opposing evidence.

No new technical indicator family may be added silently. Price, volume, gap,
dollar volume, sector state, or one direction horizon alone cannot manufacture
a measured capital-flow claim or a complete stock decision.

## 9. Output Contract and State Boundary

Package 006 reuses the existing `DecisionState` without redefinition and must
emit:

```text
scope: STOCK
scopeId: selected subject symbol
state: one authorized Package 006 state
stockDecisionContext: authorized additive StockDecisionContext
```

Authorized states only:

- `ACCUMULATION`;
- `BUY_PRESSURE`;
- `NEUTRAL`;
- `CONFLICTED`;
- `DISTRIBUTION`;
- `SELL_PRESSURE`;
- `WAIT_EVENT_RISK`;
- `UNKNOWN`.

These are analytical states, never commands:

```text
BUY_PRESSURE != BUY ORDER
SELL_PRESSURE != SELL ORDER
ACCUMULATION != BUY
DISTRIBUTION != SELL
```

No target, entry, exit, stop, position, order, broker, portfolio, prediction,
or Trade Decision Zone semantic may enter the output.

## 10. Stock Decision Context

Every Package 006 decision must carry the additive context authorized by Data
Contracts Amendment 006:

```text
StockDecisionContext {
  subjectId
  symbol
  origin
  marketDecisionId
  directionAssessmentIds[]
  sectorId
  catalystEventIds[]
  sourceSnapshotIds[]
  engineMeta
}
```

The context must preserve explicit subject provenance, the consumed MARKET
decision, all consumed direction assessments, sector and catalyst relationships,
all source stock/sector snapshots, and exact engine/rule-profile/lifecycle
metadata. It must not replace or mutate an input.

## 11. State Rule Philosophy

### 11.1 ACCUMULATION

`ACCUMULATION` requires multiple independent, compatible evidence families,
conceptually including:

- constructive price behavior;
- relative-volume participation;
- constructive VWAP context;
- positive relative strength;
- sector/market context that is not materially contradictory.

No single metric may produce `ACCUMULATION`. Price rise alone, volume alone,
and dollar volume alone are insufficient.

### 11.2 BUY_PRESSURE

`BUY_PRESSURE` may classify short-horizon positive pressure only when multiple
compatible evidence families support it, such as positive price behavior,
participation, VWAP confirmation, and relative-strength confirmation.

It is not a recommendation, entry, target, or order.

### 11.3 DISTRIBUTION

`DISTRIBUTION` requires multiple independent negative evidence families, such
as weak price structure, elevated participation, VWAP weakness, relative-
strength weakness, and compatible market/sector confirmation where available.

Price decline alone cannot create `DISTRIBUTION`.

### 11.4 SELL_PRESSURE

`SELL_PRESSURE` may classify short-horizon negative pressure only when
sufficient independent evidence supports it. It is not a SELL order and
contains no exit, stop, target, or broker semantic.

### 11.5 CONFLICTED

`CONFLICTED` is required when credible approved evidence points materially in
opposing directions, including:

- stock strength with market deterioration;
- VWAP reclaim with relative-strength deterioration;
- stock strength with sector weakness;
- short-horizon improvement with longer-horizon deterioration.

Supporting and opposing evidence must remain distinct. The engine must not
silently average conflict into directional certainty.

### 11.6 WAIT_EVENT_RISK

`WAIT_EVENT_RISK` may suspend directional classification only when a relevant
event satisfies every configured eligibility rule:

- the subject symbol appears in `affectedSymbols`;
- `impactTier` is `HIGH` or `CRITICAL`;
- timing falls within the approved profile window;
- normalized provenance and source timestamps are eligible.

A future scheduled event may be pending risk. It is not an occurred event:

```text
KNOWN FUTURE EVENT != OCCURRED EVENT
```

An unrelated symbol event is ignored. A `LOW`-impact event cannot force
`WAIT_EVENT_RISK` by itself.

### 11.7 NEUTRAL and UNKNOWN

`NEUTRAL` means sufficient valid evidence exists but no directional state has
adequate support.

`UNKNOWN` means critical evidence is missing, stale, unavailable,
non-comparable, contradictory beyond declared rule tolerance, or insufficient
for classification.

Missing data must not become `NEUTRAL`. `UNKNOWN` requires `GREY` and
`score=null`.

## 12. Market Regime Context

The engine consumes one approved `DecisionState` with `scope=MARKET`. It must
not recalculate, overwrite, or reinterpret Market Regime.

Constructive stock evidence plus a `RISK_OFF` market must preserve the
contradiction. Allowed outcomes include reduced confidence or `CONFLICTED`,
with the market evidence retained as opposition.

The stock engine must never mutate the MARKET decision or silently ignore a
material contradiction.

## 13. Market Direction Context

Direction horizons remain independently visible:

```text
30m
60m
120m
SESSION
```

The engine must not collapse them into a hidden average. A structure such as
30m/60m `IMPROVING` with 120m `DETERIORATING` remains explicit conflict or
context. Every consumed assessment ID is retained in canonical horizon order.

## 14. Sector Context

`SectorSnapshot` is contextual evidence only:

```text
sector GREEN != stock automatically BUY_PRESSURE
sector RED != stock automatically SELL_PRESSURE
```

Sector state may support, oppose, reduce confidence, or contribute to
`CONFLICTED`. It cannot dictate stock state unilaterally. Missing or stale
sector context is not neutrality.

## 15. Flow Context

`FlowAssessment` may be used only as approved contextual evidence. DIRECT and
PROXY channels remain separate and retain their original provenance.

Required invariants:

```text
Dollar volume != net capital inflow
Volume != net capital inflow
Gap != confirmed demand
Gap != confirmed selling pressure
```

Stock price/volume fields must never become a measured stock cash-flow amount.
Missing DIRECT flow is not zero. Proxy evidence cannot become
`directFlowValue`.

## 16. Freshness and Fail-Closed Behavior

The engine follows `SOURCE_FRESHNESS_MATRIX_v1.md` and approved normalized
freshness contracts.

- stale stock evidence cannot drive a directional state;
- unavailable critical stock evidence may force `UNKNOWN` / `GREY`;
- stale market, direction, flow, or sector context is excluded or degrades
  confidence according to the rule profile;
- missing freshness is not `LIVE`;
- missing evidence is not zero or neutral evidence;
- no old directional state may be presented as current.

The engine must not create a local freshness taxonomy or silently override an
approved freshness assessment.

## 17. Time Integrity

For explicit `evaluatedAt=T`:

```text
StockAnalysisSubject.selectedAt <= T
StockSnapshot.timestamp <= T
Market DecisionState.timestamp <= T
DirectionAssessment.timestamp <= T
SectorSnapshot.timestamp <= T
FlowAssessment.timestamp <= T
CatalystEvent factual timestamp <= T
DiscoveryCandidate.timestamp <= T
EvidenceRef.sourceMeta.observedAt <= T
EvidenceRef.sourceMeta.receivedAt <= T
```

No future fact, snapshot, reference, source observation, or source receipt may
enter evaluation. No interpolation or forward tolerance is authorized.

Future scheduled events may remain only as explicitly pending risk and cannot
be treated as released facts.

## 18. Historical Stock Window and Session Isolation

When multiple `StockSnapshot` records are consumed:

```text
referenceSnapshot.timestamp
<
currentSnapshot.timestamp
<=
evaluatedAt
```

Historical comparison requires the additive explicit `SessionIdentity`
authorized by Data Contracts Amendment 006. Candidate and current identities
must match exactly by session date, session phase, and session calendar ID.

Rules:

- selection is past-only;
- future comparison is categorically ineligible;
- no interpolation;
- no forward tolerance;
- no cross-session contamination;
- missing identity fails closed;
- identity is never inferred from timestamp, symbol, array position, or local
  calendar assumptions;
- same ID plus identical canonical bytes may de-duplicate;
- same ID plus different canonical bytes fails closed;
- numeric equality is not identity.

Cross-session comparison remains unauthorized. If later desired, it requires
a separate architecture amendment.

## 19. Determinism and Identity

Stock decision identity must include at minimum:

```text
stock-decision
|
engineVersion
|
ruleProfileId
|
evaluatedAt
|
subjectId
|
symbol
```

Required invariant:

```text
same normalized semantic inputs
+ same evaluatedAt
+ same rule profile
+ same engine version
= same decisionId and byte-for-byte identical canonical output
```

Required deterministic ordering:

- subjects: symbol, origin enum order, subject ID;
- stock snapshots: symbol, timestamp, snapshot ID;
- directions: 30m, 60m, 120m, SESSION, then assessment ID;
- sectors: sector ID, timestamp, snapshot ID;
- flow assessments: scope, scope ID, flow mode, assessment ID;
- catalysts: timestamp, event ID;
- discovery candidates: symbol, candidate ID;
- supporting/opposing evidence: evidence ID;
- catalyst IDs and source snapshot IDs: lexical Unicode code-point order;
- emitted decisions: symbol, subject ID, decision ID.

No randomness, process-local ID, locale-dependent sorting, unordered-set
leakage, or current-time dependency beyond explicit `evaluatedAt`.

## 20. Evidence Integrity

Every stock decision must preserve:

- `supportingEvidence[]`;
- `opposingEvidence[]`;
- each evidence ID;
- source metadata;
- observed and received timestamps;
- evidence type;
- field and value;
- unit where applicable;
- every input decision, assessment, event, candidate, and snapshot identity
  used through `StockDecisionContext`.

Opposing evidence cannot be dropped. De-duplication is provenance/identity
based, never numeric. Conflicting evidence produces explicit opposition or
`CONFLICTED`; it is not averaged into certainty.

## 21. External Rule Profile

The future implementation must define one external, versioned profile:

```text
ruleProfileId: stock-decision.experimental.v0.6
version: 0.6.0
status: EXPERIMENTAL
lifecycle: SHADOW
```

Configuration may include:

- `minimumEvidenceFamilies`;
- `relativeVolumeParticipationThreshold`;
- `vwapDistanceThreshold`;
- `relativeStrengthThreshold`;
- `marketConflictPenalty`;
- `sectorConflictPenalty`;
- `lowFreshnessPenalty`;
- `pendingHighImpactEventWindowSeconds`;
- `eventRiskConfidenceCap`.

All thresholds are:

```text
SYNTHETIC
EXPERIMENTAL
NOT PRODUCTION-CALIBRATED
NOT EMPIRICALLY VALIDATED
```

Thresholds and penalties must be configuration, not hidden engine state. No
production weight is authorized.

## 22. Required Mock Scenarios

A later implementation must provide at least these twenty-four deterministic
fixtures:

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

Every fixture must contain exactly:

```text
MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA
```

Fixtures must be deterministic, normalized, time-safe, provenance-preserving,
and free of provider payloads or fabricated market data claims.

## 23. Required Future Tests

### 23.1 Contracts

- `StockAnalysisSubject` validation;
- `MY_FOCUS` origin validation;
- `AI_DISCOVERED_SELECTED` validation;
- `discoveryCandidateId` presence and same-symbol consistency;
- additive `StockDecisionContext` validation;
- additive historical `StockSnapshot.sessionIdentity` validation;
- legacy compatibility outside historical comparison.

### 23.2 Selection

- My Focus accepted;
- explicitly selected AI Discovered accepted;
- unselected `DiscoveryCandidate` rejected;
- symbol mismatch rejected;
- no automatic promotion;
- future selection rejected;
- conflicting duplicate subject identity rejected.

### 23.3 States

- `ACCUMULATION`;
- `BUY_PRESSURE`;
- `NEUTRAL`;
- `CONFLICTED`;
- `DISTRIBUTION`;
- `SELL_PRESSURE`;
- `WAIT_EVENT_RISK`;
- `UNKNOWN` with `GREY` and `score=null`.

### 23.4 Evidence

- multiple independent evidence families required;
- a single metric cannot dominate;
- supporting evidence preserved;
- opposing evidence preserved;
- equal numeric values with distinct provenance are not de-duplicated;
- volume alone cannot create a flow claim;
- dollar volume cannot become net inflow;
- DIRECT and PROXY remain separate.

### 23.5 Market Context

- approved MARKET `DecisionState` consumed;
- non-MARKET context rejected;
- stock engine does not recalculate regime;
- market contradiction preserved;
- input market decision remains immutable.

### 23.6 Direction

- 30m, 60m, 120m, and SESSION retained independently;
- mixed-horizon disagreement preserved;
- assessment IDs retained in canonical horizon order;
- no hidden horizon average.

### 23.7 Sector

- confirmation supported;
- divergence preserved;
- sector alone cannot dictate stock state;
- missing/stale sector is not neutral.

### 23.8 Catalyst

- pending HIGH event may trigger `WAIT_EVENT_RISK`;
- pending CRITICAL event may trigger `WAIT_EVENT_RISK`;
- future scheduled event is not treated as occurred;
- unrelated-symbol event ignored;
- LOW-impact event cannot force `WAIT_EVENT_RISK` by itself;
- ineligible provenance cannot trigger event risk.

### 23.9 Freshness

- stale `StockSnapshot` cannot drive directional state;
- unavailable critical stock evidence yields `UNKNOWN` / `GREY`;
- stale market context degrades confidence or is excluded;
- stale sector/flow/direction context follows declared profile behavior;
- missing freshness is not treated as `LIVE`;
- missing critical data is not treated as `NEUTRAL`.

### 23.10 Time Integrity

- future `StockSnapshot` rejected;
- future MARKET `DecisionState` rejected;
- future `DirectionAssessment` rejected;
- future `SectorSnapshot` rejected;
- future `FlowAssessment` rejected;
- future `CatalystEvent` fact rejected;
- future `DiscoveryCandidate` rejected;
- future subject selection rejected;
- future source `observedAt` rejected;
- future source `receivedAt` rejected.

### 23.11 History and Session Isolation

- past-only historical selection;
- future comparison rejected;
- no interpolation;
- no forward tolerance;
- cross-session contamination rejected;
- missing `SessionIdentity` fails closed for historical comparison;
- phase/date/calendar mismatch rejected;
- conflicting duplicate snapshot identity rejected;
- identical canonical duplicate may de-duplicate.

### 23.12 Determinism

- same inputs produce byte-identical decision output;
- reordered semantically unordered inputs produce identical output;
- deterministic `decisionId`;
- deterministic decision ordering;
- deterministic supporting/opposing evidence ordering;
- deterministic context ID ordering;
- no implicit system-time dependency.

### 23.13 Lifecycle and Isolation

- Stock Decision Engine defaults `SHADOW`;
- every Package 006 `EngineMeta.lifecycle` is `SHADOW`;
- no ACTIVE Package 006 feature;
- Package 006 cannot influence production composite state;
- no provider imports or network calls;
- no UI analytical implementation;
- no Stock Decision output mutates normalized inputs or upstream outputs;
- options evidence remains deferred;
- no Trade Decision Zone or execution semantics.

### 23.14 Regression

- Package 001 passes;
- Package 002 passes;
- Package 003 passes;
- Package 004 passes;
- Package 005 passes;
- the existing 193 tests remain passing;
- build passes;
- architecture guard passes;
- V5 integrity passes;
- main remains unchanged.

## 24. UI Boundary

Package 006 does not authorize a full new UI implementation. Primary future
scope is contracts, engine, deterministic state output, mocks, tests, and
narrowly necessary compatibility/SHADOW support.

Package 005 remains presentation authority. Any Stock Decision UI integration
requires a separate package or separately authorized presentation integration.
UI files must not be modified unless a later authorization identifies a
strictly necessary non-functional compatibility change and requires it to be
documented explicitly.

## 25. Lifecycle and Composite Isolation

All Package 006 analytical functionality begins and remains:

```text
SHADOW
```

- no Package 006 feature may become `BETA` or `ACTIVE`;
- only `ACTIVE` may influence production composite state;
- Package 006 decisions may be computed, persisted, and tested only for SHADOW
  validation;
- Package 006 must not change any source `EngineMeta.lifecycle`;
- Package 006 must not modify production composite state or presentation
  authority.

## 26. Explicit Non-Scope

Package 006 does not authorize:

- Trade Decision Zones;
- Opportunity, Conditional, Partial Profit, Exit Risk, Hold, or Invalidation
  zones;
- entry price, exit price, stop loss, target price, position size, or order
  type;
- BUY/SELL commands or broker actions;
- broker connectivity or real-money execution;
- Portfolio Context Engine;
- options analytics/contracts;
- Model Test issuance;
- `PredictionRecord` generation or `PredictionOutcome` processing;
- live provider, Reuters/Bloomberg integration, scraping, or API keys;
- LLM market narrative or AI-generated numeric market data;
- ML, neural networks, or production-calibrated weights;
- SHADOW-to-BETA or SHADOW-to-ACTIVE transition;
- main or V5 modification;
- full Stock Decision UI implementation;
- merge, deployment, or Package 007 work.

`TRADE_DECISION_ZONES_AUTHORIZED=false`.

## 27. Required Future Validation

After a separately authorized implementation, run:

```text
npm_config_offline=true npm run check
```

Required result:

- all tests pass;
- 0 tests fail;
- 0 tests are skipped;
- build passes;
- architecture guard passes;
- V5 integrity passes;
- Package 001 regression passes;
- Package 002 regression passes;
- Package 003 regression passes;
- Package 004 regression passes;
- Package 005 regression passes;
- canonical determinism passes;
- lifecycle/composite isolation passes;
- main remains unchanged.

Exact test totals and every skipped-test reason, if any, must be reported. A
skip prevents PASS unless a later explicit authority accepts it.

## 28. Future Implementation Commit Policy

After separate implementation authorization, the executor must:

1. verify the exact authorized starting remote HEAD and required baseline;
2. implement only Package 006 scope;
3. run the complete validation gate;
4. create one separate Package 006 implementation commit containing only the
   authorized contracts, validators, canonicalization, Stock Decision Engine,
   external rule profile, mocks, tests, and narrowly necessary SHADOW support;
5. exclude the execution report from the implementation commit;
6. create `docs/EXECUTION_006_REPORT.md` only after the implementation commit;
7. include exact starting/implementation SHAs, exact files, contracts, engine,
   profile, selection, states, evidence, time/history/session, determinism,
   lifecycle, mock, test/build/guard/V5/regression, main-integrity, forbidden-
   scope, deviations, unresolved issues, and exact next-action results;
8. commit that report separately;
9. push `decision-cockpit-v1`;
10. stop.

After implementation, Package 006 remains:

```text
IMPLEMENTED_PENDING_INDEPENDENT_REVIEW
```

It must not self-approve, authorize Package 007, merge, deploy, or continue.

## 29. Acceptance Criteria for Later Implementation

Package 006 implementation is complete only when independent evidence shows:

1. explicit My Focus and explicitly selected AI Discovered subjects are the
   only analysis subjects;
2. no automatic selection or promotion exists;
3. contracts are additive and runtime-valid;
4. all eight authorized stock analytical states behave deterministically;
5. no single evidence metric creates accumulation/distribution or a flow
   claim;
6. market, direction, sector, flow, and catalyst conflicts remain explicit;
7. missing/stale/insufficient evidence fails closed;
8. time integrity and same-session historical isolation hold;
9. output identity, ordering, and canonical bytes are deterministic;
10. all Package 006 outputs remain SHADOW and non-authoritative;
11. no trade command, zone, provider, options, prediction, broker, UI,
    production weight, deployment, or Package 007 work exists;
12. all Package 001–005 regressions and repository gates pass;
13. V5 and main remain unchanged;
14. implementation and report are separate commits;
15. Package 006 remains pending independent review.

## 30. Stop Conditions

Stop without inventing architecture if:

- the authorized starting SHA differs;
- main differs from the expected baseline;
- a required authority or report is missing;
- baseline or final validation fails;
- an unapproved input, indicator, options contract, analytical semantic, or UI
  integration is required;
- explicit subject provenance cannot be proven;
- same-session historical eligibility cannot be proven;
- evidence, freshness, conflict, or direct/proxy separation cannot be
  preserved;
- implementation would modify V5, main, or production behavior;
- Package 007 work would be required.

No auto-continue is authorized.
