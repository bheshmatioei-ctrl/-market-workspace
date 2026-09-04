# Data Contracts Amendment 005 — Cockpit Presentation

Status: APPROVED ADDITIVE CONTRACT AUTHORITY

Applies to: Market Decision Intelligence System

Branch: `decision-cockpit-v1`

Compatibility: additive to Master Data Contracts v1 and all approved data
contract amendments. No existing contract or field may be removed, renamed,
or semantically redefined.

## 1. Purpose

Define a normalized deterministic read-model for projecting approved normalized
state and approved engine outputs into a validation-only Decision Cockpit UI.

`CockpitProjection` is a presentation object. It is not raw market truth, an
analytical engine output, a production composite, a forecast, a prediction, a
trade decision, or an execution instruction.

The contract preserves the architecture sequence:

```text
RAW DATA -> SYSTEM INTERPRETATION -> VISUAL STATE
```

It authorizes lossless selection, copying, reference inventory, canonical
ordering, and presentation labeling only. It does not authorize new market
analytics.

## 2. Reused Approved Types

This amendment reuses without redefining:

- `EvidenceRef`;
- `SourceMeta`;
- `Confidence`;
- `FreshnessAssessment`;
- `EngineMeta`;
- `MarketContextBundle`;
- `DecisionState`;
- `DirectionAssessment`;
- `FlowAssessment`;
- `GlobalRotationAssessment`;
- `Alert`;
- `DiscoveryCandidate`;
- `PremarketSnapshot`;
- `PremarketWindowAssessment`;
- `MarketSnapshot`;
- `BreadthSnapshot`;
- `SectorSnapshot`;
- `StockSnapshot`;
- `AssetFlowSnapshot`;
- `FuturesSnapshot`;
- `PremarketStockSnapshot`;
- `CatalystEvent`.

The authoritative feature lifecycle remains
`OFF | SHADOW | BETA | ACTIVE`. Package 005 is `SHADOW` and its display mode is
`VALIDATION_ONLY`. Only ACTIVE analytical features may influence production
composite state.

## 3. Presentation Enumerations

```text
CockpitDisplayMode = VALIDATION_ONLY

LifecycleDisplayMode = VALIDATION_ONLY

CockpitSection =
  LIVE_MARKET |
  PREMARKET |
  GLOBAL_CAPITAL |
  US_ASSET_FLOWS
```

Package 005 introduces no production display mode. It does not authorize an
ACTIVE state or lifecycle transition.

Freshness presentation reuses the approved `FreshnessStatus` values:

```text
LIVE | DELAYED | DEGRADED | STALE | UNAVAILABLE
```

The projection copies freshness status. It does not derive status from age,
source type, confidence, color, or a UI-local threshold.

## 4. CockpitProjection

Required additive normalized read-model:

```text
CockpitProjection {
  schemaVersion: string
  projectionId: string
  generatedAt: UTC timestamp
  displayMode: VALIDATION_ONLY

  market: CockpitMarketView
  premarket: CockpitPremarketView
  globalCapital: CockpitGlobalCapitalView
  discovery: CockpitDiscoveryView

  displayEvidence?: CockpitDisplayEvidence
  freshnessSummary: FreshnessDisplayRecord[]
  conflicts: ConflictDisplayRecord[]
  warnings: WarningDisplayRecord[]
  sourceObjectIds: string[]
  projectionMeta: ProjectionMeta
}
```

Required rules:

1. Every field except optional `displayEvidence` is mandatory.
2. `schemaVersion`, `projectionId`, and `generatedAt` are explicit.
3. `displayMode` must equal `VALIDATION_ONLY`.
4. The projection contains canonical copies or references to approved source
   objects only.
5. The projection is not a source of truth and must never be written back into
   normalized state or engine output.
6. No nested approved object may be mutated, have evidence removed, or have its
   analytical state changed during projection.
7. Provenance, freshness, confidence, conflict/opposition, horizon, engine
   version, rule profile, and lifecycle metadata remain intact.
8. Missing source output remains `null` or an empty collection as declared; it
   must not be replaced with a fabricated state.
9. `projectionId` is deterministic and contains no random or process-local
   component.
10. The contract contains no broker, order, position, target-price, prediction,
    or real-money execution semantics.

## 5. CockpitMarketView

```text
CockpitMarketView {
  regime: DecisionState | null
  directions: DirectionAssessment[]
  flow: FlowAssessment[]
  assetFlow: FlowAssessment[]
  alerts: Alert[]
}
```

Rules:

1. `regime` is copied from an approved market-scope `DecisionState` or the
   approved `MarketContextBundle.marketDecisionState`. It is never calculated
   by the projector.
2. `directions` retains independent 30m, 60m, 120m, and SESSION assessments.
3. `flow` and `assetFlow` retain original scope, mode, evidence, confidence,
   freshness, and engine metadata.
4. `alerts` retains raw evidence, interpretation, severity, traffic light,
   confidence, timestamp, and model version.
5. Package 005 must not merge, average, weight, rescore, or reconcile these
   objects.
6. An unavailable source is represented explicitly; it does not become a
   neutral, GREEN, RED, or zero-valued state.

## 6. CockpitPremarketView

```text
CockpitPremarketView {
  snapshot: PremarketSnapshot | null
  windows: PremarketWindowAssessment[]
}
```

Rules:

1. `snapshot` is an approved Package 004 output or `null`.
2. `windows` retains AFTERHOURS, OVERNIGHT, and PREMARKET independently.
3. When `snapshot.windowAssessments` and `windows` both represent the same
   assessment identities, their canonical bytes must match. A mismatch fails
   closed; projection must not choose one silently.
4. `freezeStatus=FROZEN` and `frozenAt` are preserved exactly.
5. Frozen premarket state must not be combined with regular-session state.
6. Projection cannot mutate a frozen snapshot or create a corrected version.
7. Presentation must expose `FINAL PREMARKET SNAPSHOT` and `FROZEN AT OPEN`
   when the approved snapshot is frozen.

## 7. CockpitGlobalCapitalView

```text
CockpitGlobalCapitalView {
  assessments: GlobalRotationAssessment[]
}
```

Each assessment preserves:

- `countryOrRegion`;
- horizon;
- state and traffic light;
- direct evidence;
- proxy evidence;
- opposing evidence;
- confidence;
- freshness;
- engine metadata.

The horizons remain distinct:

```text
overnight | 1d | 5d | 1m | structural
```

Projection must not convert structural or monthly context into overnight,
intraday, or current-flow evidence.

## 8. CockpitDiscoveryView

```text
CockpitDiscoveryView {
  candidates: DiscoveryCandidate[]
  myFocusStatus: ANALYSIS_ENGINE_NOT_AUTHORIZED
}
```

Rules:

1. `candidates` is the approved AI Discovered stream.
2. The view does not create, analyze, or mutate My Focus.
3. `myFocusStatus` is a presentation placeholder, not analytical state.
4. The UI must render:

   ```text
   MY FOCUS
   Analysis engine not yet authorized
   ```

5. No candidate is automatically promoted into My Focus.
6. No Stock Decision State or Trade Decision Zone is created.

## 9. Optional CockpitDisplayEvidence

Raw normalized objects may be included only as lossless display evidence:

```text
CockpitDisplayEvidence {
  marketSnapshots: MarketSnapshot[]
  breadthSnapshots: BreadthSnapshot[]
  sectorSnapshots: SectorSnapshot[]
  stockSnapshots: StockSnapshot[]
  assetFlowSnapshots: AssetFlowSnapshot[]
  futuresSnapshots: FuturesSnapshot[]
  premarketStockSnapshots: PremarketStockSnapshot[]
  catalystEvents: CatalystEvent[]
}
```

Rules:

1. Every included object must pass its approved normalized runtime contract.
2. The object is copied/referenced without analytical mutation.
3. The projection may canonically order objects and index their IDs only.
4. Raw objects cannot supply a new regime, direction, flow, confidence,
   freshness state, conflict, forecast, or composite.
5. Provider payloads and UI-created analytics are forbidden.
6. Omission of `displayEvidence` does not permit the UI to fetch, synthesize,
   or infer it.

## 10. FreshnessDisplayRecord

```text
FreshnessDisplayRecord {
  recordId: string
  sourceObjectId: string
  status: LIVE | DELAYED | DEGRADED | STALE | UNAVAILABLE
  assessedAt: UTC timestamp
  ageSeconds: number | null
  decisionGrade: boolean
  reason: string
}
```

Each record is a presentation index copied from exactly one approved
`FreshnessAssessment` on a source object.

Required rules:

1. `recordId` is deterministic from source object identity and freshness
   identity fields.
2. No threshold is evaluated in the projector or UI.
3. Missing freshness is not LIVE and cannot be silently omitted for an object
   that requires freshness.
4. STALE or UNAVAILABLE records must not be visually presented as current.
5. A GREY/degraded visual state must be retained when declared by the approved
   source output. The projection does not invent a replacement traffic light.

## 11. ConflictDisplayRecord

```text
ConflictDisplayRecord {
  conflictId: string
  sourceObjectIds: string[]
  label: CONFLICT
  description: string
  supportingEvidence: EvidenceRef[]
  opposingEvidence: EvidenceRef[]
}
```

Rules:

1. A conflict record may only materialize an explicit approved source conflict,
   warning, or non-empty opposing-evidence relationship.
2. It must not infer analytical conflict from locally compared numbers.
3. Supporting and opposing evidence remain separate and canonically ordered.
4. `sourceObjectIds` identifies all approved objects represented by the record.
5. `conflictId` is deterministic from the explicit source conflict identity and
   canonical source-object IDs.
6. Opposing evidence cannot be dropped to manufacture directional certainty.

## 12. WarningDisplayRecord

```text
WarningDisplayRecord {
  warningId: string
  sourceObjectId: string
  message: string
  sourceField: string
}
```

A warning is copied from an explicit approved warning, degraded reason,
missingness reason, or lifecycle/freshness disclosure. It is presentational and
must not add an analytical conclusion. Identity and ordering are deterministic.

## 13. ProjectionMeta

```text
ProjectionMeta {
  projectionVersion: string
  deterministic: boolean
  generatedAt: UTC timestamp
  sourceEngineVersions: string[]
  sourceRuleProfiles: string[]
  lifecycleDisplayMode: VALIDATION_ONLY
}
```

Required rules:

1. `projectionVersion=0.5.0` for the initial Package 005 contract.
2. `deterministic=true`.
3. `generatedAt` equals `CockpitProjection.generatedAt`.
4. Source engine versions are copied from supplied `EngineMeta.engineVersion`
   or approved equivalent metadata and ordered lexically.
5. Source rule profiles are copied from supplied `EngineMeta.ruleProfileId`
   and ordered lexically.
6. Missing source metadata cannot be invented.
7. `lifecycleDisplayMode=VALIDATION_ONLY`.
8. Projection metadata does not replace source `EngineMeta`, claim production
   authority, or promote lifecycle.

## 14. Projection Identity and Source Object Identity

`projectionId` must be derived deterministically from:

```text
(
  projectionMeta.projectionVersion,
  generatedAt,
  canonical sourceObjectIds
)
```

`sourceObjectIds` inventories every approved object copied or referenced by the
projection, including objects nested through a supplied bundle when rendered.

Rules:

1. Source identities use their approved ID fields, such as `bundleId`,
   `decisionId`, `assessmentId`, `alertId`, `candidateId`, or `snapshotId`.
2. IDs are non-empty, unique, and lexically ordered by Unicode code point.
3. Same-ID, byte-identical duplicates may collapse to one display reference.
4. Same-ID objects with different canonical bytes are invalid and fail closed.
5. Numeric equality is not identity.
6. No random UUID, process-local counter, array position, locale comparison, or
   system clock may affect identity.

## 15. Direct and Proxy Presentation Integrity

Any US Asset Flow or Global Capital presentation must preserve:

```text
DIRECT / MEASURED
```

separately from:

```text
PROXY / INFERRED
```

Required rules:

1. `FlowAssessment.directEvidence` and `proxyEvidence` remain separate.
2. `directFlowValue` may be displayed only when the approved source object
   contains a compatible DIRECT measured value and its currency/reporting
   period remain visible.
3. PROXY evidence never contributes to a displayed measured cash-flow amount.
4. Missing DIRECT is displayed as unavailable, not zero.
5. DIRECT/PROXY opposition remains a conflict, not an average.
6. The projection must not sum, convert, normalize, or fabricate dollar flow.

## 16. Evidence Inspection Integrity

For every important displayed state, the read-model must retain a path to:

- state;
- supporting evidence;
- opposing evidence;
- freshness;
- complete source metadata;
- `observedAt`;
- `receivedAt`;
- engine version;
- rule profile;
- lifecycle.

The UI may expand, collapse, sort, and filter this information as presentation
state. It must not remove opposition from the underlying projection, modify
metadata, rank evidence analytically, or write a conclusion back into the
source object.

## 17. Deterministic Canonical Ordering

Canonical projection serialization requires:

```text
market.directions:
  30m, 60m, 120m, SESSION; then assessmentId

market.alerts:
  timestamp ascending, severity in info/watch/warning/critical order, alertId

discovery.candidates:
  symbol, candidateId

globalCapital.assessments:
  countryOrRegion, horizon in overnight/1d/5d/1m/structural order,
  assessmentId

premarket.windows:
  AFTERHOURS, OVERNIGHT, PREMARKET; then assessmentId

supportingEvidence / opposingEvidence / rawEvidence / evidenceRefs:
  evidenceId

freshnessSummary:
  sourceObjectId, recordId

conflicts:
  canonical sourceObjectIds, conflictId

warnings:
  sourceObjectId, warningId

sourceEngineVersions / sourceRuleProfiles / sourceObjectIds:
  lexical Unicode code-point order
```

Explicit enum ordering is required for horizon, severity, and window. Locale
comparison is forbidden.

Required invariant:

```text
same approved normalized inputs
+ same approved engine outputs
+ same generatedAt
+ same projection version
= byte-for-byte identical canonical CockpitProjection
```

## 18. Immutability and UI-State Boundary

The projection and nested source copies are immutable after creation. Sorting,
filtering, tab selection, and expansion state must not mutate canonical bytes.

UI-local state may contain only:

- selected tab;
- expanded/collapsed state;
- user-selected sort;
- display filter.

It must not contain or override authoritative market state, confidence,
freshness, engine lifecycle, traffic light, flow value, or analytical
conclusion. No UI action may write into normalized state or engine output.

## 19. Validation-Only Disclosure

Every Package 005 validation surface must persistently expose:

```text
VALIDATION MODE
SHADOW DATA
NOT LIVE
NOT PRODUCTION DECISION
```

These disclosures are part of the presentation contract. They cannot be hidden
by a default tab, collapsed panel, stale local storage state, or responsive
layout.

SHADOW display in this contract is isolated validation display only. It does
not constitute BETA or ACTIVE product presentation and cannot influence
production composite state.

## 20. Runtime Validation Requirements

Later implementation must validate:

- required fields and exact validation-only enums;
- every nested object against its approved normalized contract;
- deterministic projection identity;
- complete source-object inventory;
- canonical array ordering and duplicate handling;
- canonical equality where a source appears through multiple input paths;
- projection metadata and source engine/rule inventories;
- freshness record fidelity;
- conflict/opposition preservation;
- premarket window and freeze-state preservation;
- direct/proxy separation;
- My Focus placeholder and AI Discovered separation;
- immutability;
- absence of analytical, prediction, trade, broker, and provider semantics.

Invalid projection inputs must be rejected or fail closed. They must not be
silently repaired, averaged, rescored, or reinterpreted.

## 21. Explicit Forbidden Fields and Semantics

`CockpitProjection` and its supporting presentation records must not add or
imply:

```text
BUY
SELL
STRONG_BUY
STRONG_SELL
targetPrice
positionSize
orderType
brokerAction
openingProbability
baseProbability
bullProbability
bearProbability
productionCompositeOverride
real-money execution instruction
```

Approved nested source objects may retain their existing fields and semantics;
Package 005 must not manufacture any forbidden value or reinterpret an existing
field as an instruction.

## 22. Compatibility and Non-Semantics

This amendment is additive. It does not authorize or define:

- live providers, Reuters/Bloomberg integration, adapters, scraping, or API
  keys;
- a Stock Decision Engine, Trade Decision Zones, Portfolio Context Engine, or
  Event ingestion engine;
- PredictionRecord issuance or Model Test implementation;
- LLM market analysis, AI narrative, ML, or neural networks;
- production analytical weights or thresholds;
- lifecycle promotion from SHADOW to BETA or ACTIVE;
- production deployment, main modification, V5 modification, merge, or Package
  006 work.

No existing normalized contract, engine output, or stored historical record is
modified by this authority.

## 23. Acceptance Invariants

1. Projection is deterministic, versioned, canonical, and immutable.
2. Projection remains a non-authoritative read-model.
3. Only approved normalized objects may enter it.
4. No market analytics are created in projection or UI.
5. Source provenance, freshness, confidence, conflicts, horizons, versions,
   profiles, and lifecycle remain inspectable.
6. Missing, stale, unavailable, or conflicting data cannot appear current or
   certain.
7. DIRECT and PROXY remain separate.
8. Premarket and regular state remain separate; frozen state remains frozen.
9. AI Discovered and My Focus remain separate.
10. Package 005 remains SHADOW and VALIDATION_ONLY.
11. Package 005 cannot influence production composite state.
12. No provider, prediction, trade, broker, deployment, or Package 006 semantic
    enters this contract.
