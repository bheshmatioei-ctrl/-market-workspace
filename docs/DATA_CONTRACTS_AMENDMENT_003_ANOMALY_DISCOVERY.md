# Data Contracts Amendment 003 — Anomaly Discovery

Status: APPROVED ADDITIVE CONTRACT AUTHORITY

Applies to: Market Decision Intelligence System

Branch: `decision-cockpit-v1`

Compatibility: additive to Master Data Contracts v1 and approved amendments;
no existing contract or field is removed, renamed, or semantically redefined.

## 1. Purpose

Define one normalized, deterministic output contract for symbols surfaced by
the SHADOW Anomaly Radar. `DiscoveryCandidate` records unusual observable
behavior and its evidence. It is not a stock decision, opportunity judgment,
trade recommendation, order instruction, or broker action.

## 2. Reused Approved Types

This amendment reuses the existing normalized contracts without redefining
them:

- `Confidence`;
- `EvidenceRef`;
- `FreshnessAssessment`;
- `EngineMeta`;
- `Alert`.

The authoritative lifecycle remains `OFF|SHADOW|BETA|ACTIVE`. Package 003
outputs require `EngineMeta.lifecycle=SHADOW`. Only `ACTIVE` may influence
production composite state.

## 3. AnomalyType

The normalized anomaly enumeration is:

```text
RELATIVE_VOLUME_SPIKE
ABNORMAL_DOLLAR_VOLUME
GAP_UP
GAP_DOWN
VWAP_RECLAIM
VWAP_BREAKDOWN
BREAKOUT
BREAKDOWN
RELATIVE_STRENGTH_ACCELERATION
RELATIVE_STRENGTH_DETERIORATION
SECTOR_CONFIRMATION
SECTOR_DIVERGENCE
PRICE_VOLUME_DIVERGENCE
CATALYST_ASSOCIATED_ANOMALY
```

Each label describes an observed or deterministically derived anomaly class.
No label carries BUY, SELL, opportunity, valuation, position, or execution
semantics.

## 4. DiscoveryCandidate

Required fields:

```text
DiscoveryCandidate {
  schemaVersion: string
  candidateId: string
  timestamp: UTC timestamp
  symbol: string
  anomalyTypes: AnomalyType[]
  severity: info | watch | warning | critical
  confidence: Confidence
  supportingEvidence: EvidenceRef[]
  opposingEvidence: EvidenceRef[]
  catalystEventIds: string[]
  sectorId: string | null
  sourceSnapshotIds: string[]
  freshness: FreshnessAssessment
  engineMeta: EngineMeta
}
```

`severity` expresses anomaly-observation importance only. It is not direction,
trade conviction, expected return, or suitability.

`sectorId=null` means sector equivalence could not be established from the
normalized input. It must degrade confidence and cannot silently become sector
neutrality or confirmation.

## 5. Required Contract Rules

1. `schemaVersion`, `candidateId`, `timestamp`, `symbol`, `freshness`, and
   `engineMeta` are mandatory.
2. `anomalyTypes` must be non-empty, unique, valid, and canonically ordered.
3. `supportingEvidence` must be non-empty for an emitted candidate.
4. Every evidence item must preserve `evidenceId`, source metadata, field,
   value, unit, and evidence type.
5. `opposingEvidence` is never discarded when valid conflict exists.
6. `catalystEventIds` contains only normalized events eligible at evaluation
   time. An empty array means no qualifying catalyst exists in the supplied
   normalized input; it does not prove that no catalyst exists in reality.
7. `sourceSnapshotIds` must be non-empty and must identify every normalized
   Stock/Sector snapshot used in the conclusion.
8. `engineMeta.deterministic` must be `true`.
9. `engineMeta.lifecycle` must be `SHADOW` throughout Package 003.
10. `engineMeta.ruleProfileId` and engine version must identify the exact
    experimental configuration used.
11. Stale evidence cannot produce a high-confidence candidate.
12. Missing, stale, contradictory, or insufficient required evidence must
    fail closed: do not emit a directional anomaly assertion unsupported by
    evidence. Where an explicit insufficient audit output is supported, it
    must be GREY/degraded and non-authoritative.
13. A candidate must not be emitted from price movement alone when the declared
    anomaly requires volume, baseline, VWAP, sector, relative-strength, or
    catalyst evidence.
14. `DiscoveryCandidate` must contain no provider-specific payload.
15. `DiscoveryCandidate` must contain no UI-derived analytical value.

## 6. Canonical Identity and De-duplication

Within one evaluation, the engine emits at most one `DiscoveryCandidate` per
symbol. Multiple anomaly classes for that symbol are preserved in the single
candidate's `anomalyTypes` array.

Candidate identity must be derived deterministically from the explicit tuple:

```text
(
  engineMeta.engineVersion,
  engineMeta.ruleProfileId,
  timestamp,
  symbol
)
```

No random ID or process-local sequence may affect `candidateId`.

De-duplication uses canonical identity and provenance, never numeric equality.
Distinct evidence records with equal numeric values remain distinct when their
`evidenceId` or source snapshot provenance differs.

## 7. Deterministic Ordering

Canonical serialization requires deterministic ordering for:

- `anomalyTypes` by the approved enum order in this amendment;
- `supportingEvidence` by `evidenceId`;
- `opposingEvidence` by `evidenceId`;
- `catalystEventIds` by event ID;
- `sourceSnapshotIds` by snapshot ID.

Across engine output, `DiscoveryCandidate[]` is ordered by:

1. symbol;
2. candidate ID as a deterministic tie-breaker.

Serialization must be byte-for-byte identical for identical normalized inputs,
evaluation timestamp, rule profile, and engine version.

## 8. Relationship to Alert

Package 003 reuses the approved `Alert` contract. It does not redefine Alert.

For anomaly alerts:

- `Alert.type` is one explicit `AnomalyType`;
- `Alert.rawEvidence` preserves normalized evidence provenance;
- `Alert.modelVersion` equals the emitting anomaly engine version;
- `Alert.interpretation` describes the anomaly without trade semantics;
- `Alert.trafficLight` summarizes evidence quality/conflict, not a trade action;
- Package 003 feature lifecycle remains SHADOW, so alerts cannot render as
  authoritative production signals or influence production composite state.

Alert identity is deterministic from:

```text
(
  engineVersion,
  ruleProfileId,
  evaluatedAt,
  symbol,
  anomalyType
)
```

At most one Alert may exist for the same identity tuple in one evaluation.
`Alert[]` is ordered by symbol, anomaly-type enum order, then `alertId`.

## 9. Time Integrity

For evaluation at `T`:

```text
DiscoveryCandidate.timestamp == T
EngineMeta.evaluatedAt == T
input.timestamp <= T
EvidenceRef.sourceMeta.observedAt <= T
EvidenceRef.sourceMeta.receivedAt <= T
eligible CatalystEvent.timestamp <= T
```

Historical/reference evidence must be selected at or before its declared
target time. Future facts, future snapshots, forward tolerance, and
interpolation are forbidden.

A scheduled event with `scheduledAt > T` may be retained only as known future
risk. It cannot support `CATALYST_ASSOCIATED_ANOMALY` as if the event had
already occurred.

## 10. Explicitly Forbidden Fields and Semantics

`DiscoveryCandidate` and Package 003 anomaly alerts must not contain or imply:

```text
BUY
SELL
STRONG_BUY
STRONG_SELL
targetPrice
positionSize
orderType
brokerAction
real-money execution instruction
```

They also must not contain Trade Decision Zones, portfolio actions, automatic
My Focus promotion, predicted return, or AI-generated numeric market values.

## 11. AI Discovered Boundary

`DiscoveryCandidate` is the only Package 003 normalized candidate output for
the product category named AI Discovered. In Package 003, that label means a
deterministic rule-based anomaly discovery stream; it does not authorize ML,
LLM inference, generated narrative, or deep Stock Decision Engine analysis.

My Focus remains user-selected and structurally separate. Candidate creation
must not mutate My Focus.

## 12. Validation Invariants

1. Candidate serialization is deterministic.
2. Anomaly types are explicit and non-directional.
3. Provenance, freshness, confidence, and conflict remain inspectable.
4. Missing evidence is not zero or neutral evidence.
5. Stale evidence is not current evidence.
6. Unknown catalyst is not proof of no catalyst.
7. Duplicate candidates and alerts are prohibited deterministically.
8. Every Package 003 candidate is SHADOW.
9. SHADOW candidates cannot influence production composite state.
10. No trade, broker, portfolio, deployment, or execution semantics enter this
    additive contract.
