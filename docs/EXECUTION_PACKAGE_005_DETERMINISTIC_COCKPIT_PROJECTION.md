# Execution Package 005 — Deterministic Cockpit Projection

Status: ARCHITECTURE AUTHORITY — IMPLEMENTATION REQUIRES SEPARATE AUTHORIZATION

Branch: `decision-cockpit-v1`

Package 005 implementation: UNAUTHORIZED

Package 006: UNAUTHORIZED

## 0. Authority and Execution Boundary

This document defines the authority for a later, separately authorized
Package 005 implementation. It does not itself authorize implementation.

The future package may create a deterministic presentation/read-model layer
that projects approved normalized state and approved engine outputs into a
validation-only Decision Cockpit UI.

Required flow:

```text
Normalized State
        +
Approved Engine Outputs
        ↓
Deterministic Cockpit Projection
        ↓
Validation-Only Decision Cockpit UI
```

Package 005 is not an analytical engine. It must not create, replace, refine,
or reinterpret market analytics. It must not modify V5, main, or any approved
source contract/output.

## 1. Binding Architecture Authority Order

The later implementation must read and obey these authorities in order:

1. `docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md`
2. `docs/ARCHITECTURE_AMENDMENT_001_FEATURE_LIFECYCLE.md`
3. `docs/ARCHITECTURE_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
4. `docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md`
5. `docs/MASTER_DATA_CONTRACTS_v1.md`
6. `docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md`
7. `docs/DATA_CONTRACTS_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
8. `docs/DATA_CONTRACTS_AMENDMENT_003_ANOMALY_DISCOVERY.md`
9. `docs/DATA_CONTRACTS_AMENDMENT_004_PREMARKET_SESSION_INTELLIGENCE.md`
10. `docs/SOURCE_FRESHNESS_MATRIX_v1.md`
11. `docs/ENGINE_DEPENDENCY_GRAPH_v1.md`
12. `docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md`
13. `docs/EXECUTION_001_REPORT.md`
14. `docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md`
15. `docs/EXECUTION_002_REPORT.md`
16. `docs/EXECUTION_PACKAGE_002_REMEDIATION.md`
17. `docs/EXECUTION_002_REMEDIATION_REPORT.md`
18. `docs/EXECUTION_PACKAGE_003_DETERMINISTIC_ANOMALY_RADAR.md`
19. `docs/EXECUTION_003_REPORT.md`
20. `docs/EXECUTION_PACKAGE_004_DETERMINISTIC_PREMARKET_SESSION_INTELLIGENCE.md`
21. `docs/EXECUTION_004_REPORT.md`
22. `docs/DATA_CONTRACTS_AMENDMENT_005_COCKPIT_PRESENTATION.md`
23. this execution package.

The latest approved additive amendment controls where an earlier draft uses
older terminology. In particular, lifecycle is `OFF | SHADOW | BETA | ACTIVE`,
and explicit Package 004 session boundaries replace any hard-coded open-time
assumption.

If implementation requires an input, semantic transformation, or lifecycle
behavior outside these authorities, execution must stop and record an
unresolved architecture decision. It must not silently expand scope.

## 2. Starting Conditions for Later Execution

A later implementation authorization must name an exact authorized remote HEAD.
Before changing code, the implementer must verify:

- current branch is `decision-cockpit-v1`;
- remote HEAD equals the separately authorized exact SHA;
- main HEAD remains `f4483cb2ce7d0eec2f05337a1d0b566d0b778afa`;
- both Package 005 authority documents exist;
- `docs/EXECUTION_004_REPORT.md` exists;
- the worktree contains no unexplained changes.

It must then run:

```text
npm_config_offline=true npm run check
```

Required baseline:

- 164 tests pass;
- 0 tests fail;
- 0 tests are skipped;
- build passes;
- architecture guard passes;
- V5 integrity passes.

Any mismatch is a stop condition. No implementation change is permitted after
a failed baseline gate.

## 3. Strict Future Package Scope

Package 005 may later implement only:

1. the additive `CockpitProjection` read-model and supporting presentation-only
   types authorized by Data Contracts Amendment 005;
2. deterministic projection identity, validation, and canonical serialization;
3. a deterministic projection builder/projector that copies, references,
   indexes, de-duplicates by identity, and canonically orders approved objects;
4. a validation-only Decision Cockpit UI that renders the projection;
5. evidence-inspection presentation for approved evidence and metadata;
6. externalized presentation labels and view configuration that contain no
   analytical thresholds or weights;
7. the twenty required deterministic mock scenarios;
8. automated Package 005 tests;
9. narrowly necessary feature-flag support for a Package 005 SHADOW,
   validation-only module.

It must not create a market conclusion, composite score, confidence value,
freshness judgment, forecast, prediction, trade decision, or execution action.

## 4. Core Presentation Principle

The presentation flow is binding:

```text
RAW DATA
    ↓
SYSTEM INTERPRETATION
    ↓
VISUAL STATE
```

The UI renders approved engine outputs and their normalized evidence. It must
not:

- compute market regime or direction;
- compute direct or proxy flow;
- average signals or windows;
- create weights or thresholds;
- calculate or override confidence;
- calculate or override freshness;
- create forecasts or probabilities;
- create BUY, SELL, STRONG_BUY, or STRONG_SELL semantics;
- create or mutate composite market state;
- mutate any normalized input or engine output;
- turn a display preference into market truth.

Color is a display aid only and never replaces evidence.

## 5. Projection Declaration

The future deterministic projector is declared as:

```text
moduleId: cockpit-projection
projectionVersion: 0.5.0
featureLifecycle: SHADOW
displayMode: VALIDATION_ONLY
deterministic: true
```

There is no Package 005 analytical engine version, analytical rule profile,
weight profile, or production calibration claim. `sourceEngineVersions` and
`sourceRuleProfiles` are copied from the supplied approved outputs; Package 005
does not create substitute engine metadata.

## 6. Allowed Inputs

The projector may consume only these approved normalized objects:

- `MarketContextBundle`;
- `DecisionState` or the approved market-regime output represented by it;
- `DirectionAssessment[]`;
- `FlowAssessment[]`;
- `GlobalRotationAssessment[]`;
- `Alert[]`;
- `DiscoveryCandidate[]`;
- `PremarketSnapshot`;
- `PremarketWindowAssessment[]`.

These normalized raw objects may be accepted only as optional display evidence:

- `MarketSnapshot`;
- `BreadthSnapshot`;
- `SectorSnapshot`;
- `StockSnapshot`;
- `AssetFlowSnapshot`;
- `FuturesSnapshot`;
- `PremarketStockSnapshot`;
- `CatalystEvent`.

Optional raw objects must be losslessly copied/referenced for inspection only.
They must not be re-analyzed by projection or UI code.

Provider payloads, vendor REST objects, scraping output, UI-created analytics,
and AI-created numeric market values are forbidden inputs. The projector and UI
must perform no network access.

If any additional analytical input is required, implementation must stop and
record the request as an unresolved architecture decision.

## 7. CockpitProjection Output

The future implementation must follow the normalized `CockpitProjection`
contract in Data Contracts Amendment 005. Conceptually it contains:

```text
CockpitProjection {
  schemaVersion
  projectionId
  generatedAt
  displayMode: VALIDATION_ONLY
  market {
    regime
    directions
    flow
    assetFlow
    alerts
  }
  premarket {
    snapshot
    windows
  }
  globalCapital {
    assessments
  }
  discovery {
    candidates
  }
  displayEvidence?
  freshnessSummary
  conflicts[]
  warnings[]
  sourceObjectIds[]
  projectionMeta
}
```

The projection is not source of truth. It contains references or canonical
copies of approved inputs only. It preserves source provenance, freshness,
confidence, conflicts, horizons, direct/proxy distinction, and lifecycle
metadata without hidden analytical transformation.

When the same identity is supplied through both `MarketContextBundle` and a
direct array, byte-identical duplicates may be collapsed structurally. The same
identity with different canonical bytes is a conflict and must fail closed.
Numeric equality is never an identity or de-duplication rule.

## 8. ProjectionMeta

The future output must include:

```text
projectionMeta {
  projectionVersion
  deterministic
  generatedAt
  sourceEngineVersions[]
  sourceRuleProfiles[]
  lifecycleDisplayMode
}
```

Required invariants:

- `projectionVersion=0.5.0`;
- `deterministic=true`;
- `generatedAt` equals `CockpitProjection.generatedAt`;
- `sourceEngineVersions` is a canonical inventory copied from source metadata;
- `sourceRuleProfiles` is a canonical inventory copied from source metadata;
- `lifecycleDisplayMode=VALIDATION_ONLY`.

Projection metadata must not claim production authority or promote any source
feature lifecycle.

## 9. Validation-Only Mode and Lifecycle

Package 005 starts and remains:

```text
featureLifecycle = SHADOW
displayMode = VALIDATION_ONLY
```

The validation UI must visibly and persistently surface:

- `VALIDATION MODE`;
- `SHADOW DATA`;
- `NOT LIVE`;
- `NOT PRODUCTION DECISION`.

Displaying SHADOW output is permitted only inside this explicitly separated
validation surface. It is not BETA/ACTIVE presentation and must not masquerade
as production authority.

Package 005 must not:

- influence production composite state;
- appear as ACTIVE;
- promote itself or another feature to BETA or ACTIVE;
- alter any source `EngineMeta.lifecycle`;
- modify the existing V5 production experience.

Only ACTIVE engine features may influence production composite state.

## 10. Live Market View

The validation-only LIVE MARKET view may render approved values for:

- Market Regime;
- 30m Direction;
- 60m Direction;
- 120m Direction;
- Session Direction;
- Money Flow;
- US Asset Flow;
- Alerts;
- AI Discovered;
- Market Internals.

Directions must retain the canonical `30m`, `60m`, `120m`, `SESSION` order and
must not be combined.

My Focus decision state is unavailable. The exact placeholder must be visible:

```text
MY FOCUS
Analysis engine not yet authorized
```

The UI must not fabricate My Focus states, confidence, recommendations, or
deep stock analysis.

## 11. Premarket View

The validation-only PREMARKET view may render approved Package 004 state:

- Premarket State;
- AFTERHOURS;
- OVERNIGHT;
- PREMARKET;
- Futures State;
- Participation Proxy;
- Global Context;
- Scheduled Event Risk;
- AI Discovered;
- Freshness;
- Confidence;
- Freeze Status.

The three windows remain distinct. The projection must not recalculate or
average them.

When `freezeStatus=FROZEN`, the UI must display exactly and prominently:

```text
FINAL PREMARKET SNAPSHOT
FROZEN AT OPEN
```

A frozen premarket snapshot must never be silently merged with regular-session
state or mutated by current display state.

## 12. Global Capital View

For each approved `GlobalRotationAssessment`, render:

- `countryOrRegion`;
- `horizon`;
- `state`;
- direct evidence;
- proxy evidence;
- opposing evidence;
- confidence;
- freshness.

The following horizon labels remain explicit and distinct:

```text
overnight | 1d | 5d | 1m | structural
```

Structural or monthly context must never be presented as current intraday or
overnight flow. Mixed horizons remain separately inspectable.

## 13. US Asset Flow View

The validation UI must render separate channels:

```text
DIRECT / MEASURED
```

and:

```text
PROXY / INFERRED
```

They must never be combined into a fabricated total. Missing DIRECT evidence
is displayed as unavailable, not zero. PROXY evidence cannot be formatted as a
measured cash-flow amount.

Allowed example:

```text
US EQUITY
DIRECT: Unavailable
PROXY: Selling-pressure proxy
Confidence: 0.61
```

Forbidden example unless compatible DIRECT measured evidence supports it:

```text
Equity Outflow: -$4.2B
```

## 14. Evidence Inspection

Every important state card must provide a presentation/readout of:

- state;
- supporting evidence;
- opposing evidence;
- freshness;
- source metadata;
- `observedAt`;
- `receivedAt`;
- engine version;
- rule profile;
- lifecycle.

The inspector may format and label approved fields. It must not score, rank,
reinterpret, summarize into a new conclusion, or omit opposition to simplify
the display. Color never replaces evidence.

## 15. Conflict Rendering

Explicit source conflicts and valid opposing evidence must remain visible with
the conceptual indicator:

```text
CONFLICT
```

Example:

```text
Market state: ORANGE
Supporting: SPY strength; QQQ strength
Opposing: IWM weakness; breadth deterioration
```

Projection conflict records are structural display records copied from
approved conflict/opposition fields. Package 005 must not infer a new market
conflict from numeric thresholds. It must not drop opposition or force a single
directional conclusion.

## 16. Freshness Rendering

Every relevant card/output must expose the approved freshness state:

```text
LIVE | DELAYED | DEGRADED | STALE | UNAVAILABLE
```

The display label must be copied from the approved `FreshnessAssessment`; the
UI must not calculate age thresholds or upgrade/downgrade status locally.

STALE or UNAVAILABLE output must use the GREY/degraded visual presentation
already declared by its source output. An old GREEN or RED state must not remain
presented as current. Missing freshness cannot be inferred as LIVE.

## 17. Determinism and Canonical Ordering

Required invariant:

```text
same approved normalized inputs
+ same approved engine outputs
+ same generatedAt
+ same projection version
= byte-for-byte identical CockpitProjection
```

Canonical ordering is:

```text
directions:
  30m, 60m, 120m, SESSION

alerts:
  timestamp ascending, severity in info/watch/warning/critical order, alertId

discovery candidates:
  symbol, candidateId

global assessments:
  countryOrRegion, horizon in overnight/1d/5d/1m/structural order, assessmentId

premarket windows:
  AFTERHOURS, OVERNIGHT, PREMARKET, assessmentId

evidence:
  evidenceId

freshness/conflict/warning records:
  sourceObjectId, recordId

sourceEngineVersions / sourceRuleProfiles / sourceObjectIds:
  lexical code-point order
```

Severity and horizon comparisons must use explicit declared enum order, not
locale comparison. There is no randomness, process-local identity, unordered
set leakage, locale-dependent ordering, or implicit current time.

`projectionId` must be derived deterministically from projection version,
explicit `generatedAt`, and the canonical source-object identity list. It must
not use randomness or process-local sequence.

## 18. UI State Boundary

UI-local state may contain only presentation state, for example:

- selected tab;
- expanded/collapsed card;
- user-selected sort;
- display filter.

UI-local state is never authoritative market truth. Forbidden behavior includes:

- local/session storage overriding confidence, freshness, state, or lifecycle;
- a UI control changing engine lifecycle;
- frontend calculation of regime, direction, flow, confidence, or composite;
- frontend changing RED, ORANGE, GREEN, or GREY analytical state;
- UI writing conclusions back into normalized state or engine output;
- mutation of source objects during sorting or filtering.

## 19. Required Mock Scenarios

Later implementation must provide at least these deterministic scenarios:

1. `CONSTRUCTIVE_MARKET`
2. `RISK_OFF_MARKET`
3. `CONFLICTED_MARKET`
4. `STALE_MARKET`
5. `MISSING_MARKET_CONTEXT`
6. `PREMARKET_LIVE`
7. `PREMARKET_FROZEN`
8. `PREMARKET_REVERSAL`
9. `DIRECT_FLOW_AVAILABLE`
10. `PROXY_ONLY_FLOW`
11. `DIRECT_PROXY_CONFLICT`
12. `GLOBAL_POSITIVE`
13. `GLOBAL_NEGATIVE`
14. `GLOBAL_MIXED_HORIZONS`
15. `ALERT_STREAM`
16. `MULTIPLE_DISCOVERY_CANDIDATES`
17. `SHADOW_LIFECYCLE_VISIBILITY`
18. `STALE_TO_GREY`
19. `CONFLICT_EVIDENCE_VISIBLE`
20. `DETERMINISTIC_PROJECTION`

Every fixture and scenario must state exactly:

```text
MOCK / TEST DATA ONLY — NOT LIVE MARKET DATA
```

Mocks must not be presented as real symbols, current market facts, provider
payloads, production calibration, or empirical validation.

## 20. Required Future Tests

### 20.1 Projection contracts and determinism

- `CockpitProjection` contract validation;
- projection metadata validation;
- deterministic projection identity;
- deterministic canonical serialization;
- reordered inputs produce identical projection;
- source object references are preserved;
- identical duplicate identities collapse structurally;
- conflicting duplicate identities fail closed;
- source objects remain immutable.

### 20.2 No analytics in projection or UI

- UI does not calculate regime;
- UI does not calculate direction;
- UI does not calculate flow;
- UI does not calculate confidence;
- UI does not calculate freshness thresholds;
- UI does not calculate composite state;
- projector does not average or weight engine outputs;
- projection does not mutate engine output.

### 20.3 Lifecycle and validation mode

- SHADOW is visibly labeled;
- VALIDATION_ONLY is visibly labeled;
- NOT LIVE and NOT PRODUCTION DECISION are visible;
- Package 005 cannot influence production composite state;
- no ACTIVE Package 005 feature exists;
- no source engine lifecycle is promoted or rewritten.

### 20.4 Evidence and conflicts

- supporting evidence is visible;
- opposing evidence is visible;
- freshness is visible;
- source metadata is visible;
- `observedAt` and `receivedAt` are visible;
- engine version is visible;
- rule profile is visible;
- lifecycle is visible;
- conflicts are preserved;
- opposing evidence cannot be dropped;
- conflicted state is not converted to directional certainty;
- color never substitutes for evidence.

### 20.5 Freshness

- LIVE is displayed;
- DELAYED is displayed;
- DEGRADED is displayed;
- STALE is displayed;
- UNAVAILABLE is displayed;
- stale/unavailable cannot appear current;
- missing freshness cannot become LIVE;
- UI does not recalculate freshness.

### 20.6 Premarket

- LIVE premarket renders;
- FROZEN premarket renders;
- frozen status is explicit;
- `FINAL PREMARKET SNAPSHOT` and `FROZEN AT OPEN` are visible;
- AFTERHOURS, OVERNIGHT, and PREMARKET remain distinct;
- frozen premarket and regular-session state remain distinct;
- UI state cannot mutate a frozen snapshot.

### 20.7 Direct and proxy flow

- DIRECT measured channel is separate;
- PROXY inferred channel is separate;
- DIRECT/PROXY conflict is visible;
- missing DIRECT is unavailable, not zero;
- PROXY cannot render as measured cash flow;
- no fabricated dollar flow is emitted or rendered.

### 20.8 Global capital

- horizon labels are preserved;
- overnight, 1d, 5d, 1m, and structural remain distinguishable;
- structural is not presented as overnight;
- mixed-horizon data remains separate;
- direct, proxy, and opposing evidence remain visible.

### 20.9 Discovery and Focus

- AI Discovered renders separately;
- My Focus placeholder is visible;
- My Focus analysis is not fabricated;
- no candidate is promoted automatically;
- no Stock Decision output is created.

### 20.10 Isolation

- projection and UI perform no network calls;
- no provider integration/import exists;
- no provider payload is used;
- there is no live-data dependency;
- UI does not mutate normalized or engine state;
- no analytical values are stored in UI-local state;
- V5 remains isolated.

### 20.11 Regression

- Package 001 tests pass;
- Package 002 tests pass;
- Package 003 tests pass;
- Package 004 tests pass;
- all existing 164 tests pass;
- build passes;
- architecture guard passes;
- V5 integrity passes;
- main remains unchanged.

## 21. Future Validation Gate

After later implementation, run exactly:

```text
npm_config_offline=true npm run check
```

Required result:

- all tests pass;
- 0 failed;
- 0 skipped;
- build PASS;
- architecture guard PASS;
- V5 integrity PASS;
- Package 001 regression PASS;
- Package 002 regression PASS;
- Package 003 regression PASS;
- Package 004 regression PASS;
- main unchanged.

Every skipped test, if an external execution environment prevents the required
zero-skipped result, is a failure unless separately authorized before execution.

## 22. Explicit Non-Scope

Package 005 does not authorize:

- live adapters or market-data providers;
- Reuters or Bloomberg integration;
- provider payloads, scraping, or API keys;
- Stock Decision Engine;
- Trade Decision Zones;
- Portfolio Context Engine;
- Event ingestion engine;
- PredictionRecord issuance;
- Model Test implementation;
- LLM market analysis or AI narrative;
- opening probabilities or forecasts;
- production weights, ML, or neural networks;
- broker connectivity or real-money execution;
- SHADOW-to-BETA or SHADOW-to-ACTIVE transition;
- production deployment;
- modification of main or V5;
- merge;
- Package 006 architecture or implementation work.

## 23. Later Implementation Commit Policy

After separate implementation authorization, the executor must:

1. verify the exact authorized starting remote HEAD and baseline;
2. implement only Package 005 scope;
3. run the complete validation gate;
4. create one separate Package 005 implementation commit containing only the
   read-model contract, validators/canonicalization, deterministic projector,
   validation-only UI, mocks, tests, and strictly necessary feature support;
5. exclude the execution report from that implementation commit;
6. create `docs/EXECUTION_005_REPORT.md` after the implementation commit;
7. commit the report separately;
8. push `decision-cockpit-v1`;
9. stop.

Package 005 then remains:

```text
IMPLEMENTED_PENDING_INDEPENDENT_REVIEW
```

It must not self-approve, authorize Package 006, merge, deploy, or continue.

## 24. Acceptance Criteria for Later Implementation

Package 005 implementation is complete only when independent evidence shows:

1. all projection contracts validate and remain additive;
2. canonical output is byte-identical for equivalent inputs;
3. projection and UI create no market analytics;
4. all approved provenance, freshness, confidence, horizon, conflict, and
   lifecycle metadata remain inspectable;
5. DIRECT and PROXY channels remain separate;
6. premarket windows and frozen status remain explicit;
7. AI Discovered and My Focus remain separate;
8. validation-only SHADOW labels are persistently visible;
9. no Package 005 feature influences production composite state;
10. all Package 001–004 regressions and repository gates pass;
11. V5 and main remain unchanged;
12. no forbidden-scope or Package 006 work exists;
13. implementation and report are separate commits;
14. Package 005 remains pending independent review.

## 25. Stop Conditions

Stop without inventing architecture if:

- the authorized starting SHA differs;
- main differs from the expected baseline;
- any binding authority is missing or contradictory;
- baseline or final validation fails;
- a new input contract or analytical transformation is required;
- presentation cannot preserve evidence, conflict, freshness, horizon, or
  lifecycle without changing source semantics;
- implementation would modify V5, main, or production behavior;
- Package 006 work would be required.

No auto-continue is authorized.
