# Data Contracts Amendment 001 — Deterministic Engine Outputs

Status: APPROVED ADDITIVE CONTRACT AMENDMENT
Applies to: Market Decision Intelligence System
Branch: decision-cockpit-v1
Compatibility: additive to Master Data Contracts v1; no existing v1 contract is removed or redefined.

## Purpose

Execution Package 001 established normalized input snapshots and general DecisionState contracts. Before implementing deterministic analytical engines, the system needs explicit, versionable output contracts for multi-horizon direction, flow-proxy analysis, global rotation analysis, and shadow evaluation.

This amendment prevents engine-specific ad hoc objects from leaking into UI, validation, or later model-testing layers.

## Common Engine Metadata

### EngineMeta

Required fields:
- engineId: string
- engineVersion: string
- lifecycle: OFF|SHADOW|BETA|ACTIVE
- evaluatedAt: UTC timestamp
- inputSchemaVersions: object/map
- ruleProfileId: string
- deterministic: boolean

Rules:
1. engineVersion must be explicit.
2. ruleProfileId identifies the exact threshold/weight/rule configuration.
3. SHADOW output cannot influence production composite state.
4. deterministic=true for all Package 002 engines.

## DirectionAssessment

Purpose: represent one time-horizon direction result.

Fields:
- schemaVersion
- assessmentId
- timestamp
- scope: MARKET|SECTOR|STOCK
- scopeId
- horizon: 30m|60m|120m|SESSION
- direction: IMPROVING|STABLE|DETERIORATING|UNKNOWN
- score: number in [-1,1] or null when unavailable
- trafficLight: GREEN|ORANGE|RED|GREY
- confidence: Confidence
- supportingEvidence: EvidenceRef[]
- opposingEvidence: EvidenceRef[]
- freshness: FreshnessAssessment
- engineMeta: EngineMeta

Rules:
- UNKNOWN requires GREY.
- Missing historical comparison data cannot be treated as STABLE.
- Each horizon is calculated and stored independently.
- No future snapshot may be used.

## FlowAssessment

Purpose: represent measured or inferred demand/rotation without conflating direct cash flow and proxies.

Fields:
- schemaVersion
- assessmentId
- timestamp
- scope: MARKET|SECTOR|ASSET_CLASS
- scopeId
- flowMode: DIRECT|PROXY|MIXED
- state: DEMAND|SELLING_PRESSURE|MIXED|NEUTRAL|INSUFFICIENT
- trafficLight: GREEN|ORANGE|RED|GREY
- score: number in [-1,1] or null
- directFlowValue: number|null
- currency: string|null
- reportingPeriod: string|null
- confidence: Confidence
- directEvidence: EvidenceRef[]
- proxyEvidence: EvidenceRef[]
- opposingEvidence: EvidenceRef[]
- freshness: FreshnessAssessment
- engineMeta: EngineMeta

Rules:
1. PROXY mode requires directFlowValue=null.
2. DIRECT mode may contain a measured directFlowValue only if supported by DIRECT evidence.
3. MIXED mode keeps direct and proxy evidence as separate arrays.
4. Price change alone cannot create a DEMAND or SELLING_PRESSURE classification.
5. INSUFFICIENT requires GREY.

## GlobalRotationAssessment

Purpose: represent country/region capital-rotation evidence while preserving horizon and direct/proxy separation.

Fields:
- schemaVersion
- assessmentId
- timestamp
- countryOrRegion
- horizon: overnight|1d|5d|1m|structural
- state: POSITIVE_ROTATION|NEGATIVE_ROTATION|MIXED|NEUTRAL|INSUFFICIENT
- trafficLight: GREEN|ORANGE|RED|GREY
- score: number in [-1,1] or null
- equityState: GREEN|ORANGE|RED|GREY
- bondState: GREEN|ORANGE|RED|GREY
- fxState: GREEN|ORANGE|RED|GREY
- relativeStrengthState: GREEN|ORANGE|RED|GREY
- directFlowState: GREEN|ORANGE|RED|GREY
- directFlowValue: number|null
- directFlowCurrency: string|null
- confidence: Confidence
- directEvidence: EvidenceRef[]
- proxyEvidence: EvidenceRef[]
- opposingEvidence: EvidenceRef[]
- freshness: FreshnessAssessment
- engineMeta: EngineMeta

Rules:
- Horizons cannot be silently combined.
- Structural/quarterly data cannot determine overnight or 1d traffic lights.
- Missing country inputs reduce confidence and may force GREY.
- A direct number must retain reporting frequency and timestamp in its evidence SourceMeta.

## MarketContextBundle

Purpose: immutable aggregate container for SHADOW validation and later UI consumption. It is not itself a market conclusion.

Fields:
- schemaVersion
- bundleId
- timestamp
- marketDecisionState: DecisionState|null
- directionAssessments: DirectionAssessment[]
- sectorFlowAssessments: FlowAssessment[]
- assetFlowAssessments: FlowAssessment[]
- globalRotationAssessments: GlobalRotationAssessment[]
- conflicts: string[]
- warnings: string[]
- sourceSnapshotIds: string[]
- generatedBy: EngineMeta[]

Rules:
1. Bundle does not average or overwrite engine results.
2. Conflicts are explicit.
3. SHADOW results remain SHADOW inside the bundle.
4. Bundle is recomputable from normalized evidence.
5. No bundle field authorizes broker/trade execution.

## HistoricalSnapshotWindow

This is a state-layer structure, not a provider contract.

Purpose: provide deterministic past-only snapshot selection for 30m/60m/120m/session comparisons.

Required behavior:
- append normalized snapshots in timestamp order;
- reject or explicitly sort out-of-order data according to a declared policy;
- never expose future snapshots to an evaluation timestamp;
- select comparison snapshot at-or-before target horizon with configured tolerance;
- return explicit MISSING/INSUFFICIENT when no valid comparison exists;
- preserve session date and session phase boundaries;
- no interpolation unless a later approved rule explicitly enables it.

## Rule Profiles

Package 002 engine rules must be externalized into versioned rule profiles.

Each profile must include:
- ruleProfileId
- version
- description
- thresholds/weights/rules
- intended status: EXPERIMENTAL|VALIDATED

Initial profiles are EXPERIMENTAL only.

No initial rule profile is to be described as empirically validated or predictive.

## Versioning

This amendment is additive and uses schema version compatible with the current major contract version.

If a later implementation changes semantics of an existing field, a major schema change is required.

## Invariants

1. Engine outputs are normalized and versioned.
2. Every engine result includes engine version and rule profile.
3. Direct/proxy separation survives engine output.
4. Horizons survive engine output.
5. Unknown/insufficient evidence never becomes directional certainty.
6. SHADOW calculations cannot influence production composite state.
7. No future data is permitted in historical comparisons.
