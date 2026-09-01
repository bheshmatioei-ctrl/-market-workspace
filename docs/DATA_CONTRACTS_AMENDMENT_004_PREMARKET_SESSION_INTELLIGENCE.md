# Data Contracts Amendment 004 — Premarket Session Intelligence

Status: APPROVED ADDITIVE CONTRACT AUTHORITY

Applies to: Market Decision Intelligence System

Branch: `decision-cockpit-v1`

Compatibility: additive to Master Data Contracts v1 and all approved data
contract amendments. No existing contract or field may be removed, renamed,
or semantically redefined.

## 1. Purpose

Define normalized contracts for deterministic interpretation of extended-hours
market state while preserving the distinct `AFTERHOURS`, `OVERNIGHT`, and
`PREMARKET` windows. These contracts support SHADOW validation only. They do
not define a forecast, stock decision, trade zone, order, broker action, or
production signal.

## 2. Reused Approved Types

This amendment reuses, without redefining:

- `SessionIdentity`;
- `Measurement`;
- `SourceMeta`;
- `EvidenceRef`;
- `Confidence`;
- `FreshnessAssessment`;
- `EngineMeta`;
- `TrafficLight`;
- `DirectionState`;
- `MarketSnapshot`;
- `SectorSnapshot`;
- `CatalystEvent`;
- `GlobalRotationAssessment`;
- `DiscoveryCandidate`;
- `PremarketSnapshot`.

The lifecycle authority remains `OFF | SHADOW | BETA | ACTIVE`. Package 004
requires `EngineMeta.lifecycle=SHADOW`. Only `ACTIVE` may influence production
composite state.

## 3. Normalized Enumerations

```text
PremarketWindow = AFTERHOURS | OVERNIGHT | PREMARKET

FuturesInstrument = ES | NQ | RTY

LiquidityQuality = HIGH | MEDIUM | LOW | INSUFFICIENT

PremarketFreezeStatus = LIVE | FROZEN

CatalystImpactTier = LOW | MEDIUM | HIGH | CRITICAL

ParticipationProxyState =
  BROAD_DEMAND_PROXY |
  BROAD_SELLING_PRESSURE_PROXY |
  CONCENTRATED_DEMAND |
  CONCENTRATED_SELLING |
  MIXED |
  INSUFFICIENT
```

`ParticipationProxyState` is explicitly a proxy classification. It must never
be serialized, narrated, or interpreted as measured capital flow.

## 4. MarketSessionBoundary

Required additive normalized contract:

```text
MarketSessionBoundary {
  schemaVersion: string
  sessionDate: string
  sessionCalendarId: string
  priorRegularCloseTimestamp: UTC timestamp
  afterhoursEndTimestamp: UTC timestamp
  premarketStartTimestamp: UTC timestamp
  regularOpenTimestamp: UTC timestamp
  evidenceRefs: EvidenceRef[]
}
```

Validation rules:

1. Every field is mandatory and every timestamp is an explicit UTC timestamp.
2. `sessionDate` and `sessionCalendarId` use the same semantics as the approved
   `SessionIdentity` contract.
3. The timestamp order must satisfy:

   ```text
   priorRegularCloseTimestamp
     < afterhoursEndTimestamp
     <= premarketStartTimestamp
     < regularOpenTimestamp
   ```

4. `evidenceRefs` must be non-empty and preserve the provenance of the
   normalized calendar/session-boundary source.
5. The contract is the exclusive analytical authority for Package 004 session
   boundaries. Engines must not calculate exchange boundaries, infer a timezone,
   assume daylight-saving rules, or hard-code regular open.
6. A boundary with missing, contradictory, or invalid timestamps fails closed.
7. Calendar corrections require a new normalized record/version; an already
   frozen historical `PremarketSnapshot` is not mutated.

The canonical classification intervals are:

```text
AFTERHOURS = [priorRegularCloseTimestamp, afterhoursEndTimestamp)
OVERNIGHT  = [afterhoursEndTimestamp, premarketStartTimestamp)
PREMARKET  = [premarketStartTimestamp, regularOpenTimestamp)
```

An observation at or after `regularOpenTimestamp` is not eligible as premarket
evidence. A gap between explicit boundaries, if any, is not silently assigned
to a window.

## 5. Session Identity Mapping

Package 004 maps the existing lowercase `SessionIdentity.sessionPhase` to the
new window enumeration exactly:

```text
afterhours -> AFTERHOURS
overnight  -> OVERNIGHT
premarket  -> PREMARKET
regular    -> ineligible for premarket calculation
```

For every session-bound input used by Package 004:

- `sessionIdentity.sessionDate` must equal
  `MarketSessionBoundary.sessionDate`;
- `sessionIdentity.sessionCalendarId` must equal
  `MarketSessionBoundary.sessionCalendarId`;
- `sessionIdentity.sessionPhase` must agree with the explicit boundary interval
  containing the input timestamp.

Missing or contradictory session identity is not compatible and fails closed.
No identity may be inferred from timestamp, `scopeId`, symbol, array position,
or local-clock conversion.

## 6. FuturesSnapshot

Required additive normalized contract:

```text
FuturesSnapshot {
  schemaVersion: string
  snapshotId: string
  timestamp: UTC timestamp
  sessionIdentity: SessionIdentity
  instrument: ES | NQ | RTY
  lastPrice: Measurement
  priorCashClose: Measurement
  changePctFromPriorCashClose: Measurement
  volume: Measurement
  freshness: FreshnessAssessment
  evidenceRefs: EvidenceRef[]
}
```

Contract rules:

1. `snapshotId`, `timestamp`, `sessionIdentity`, and `instrument` are mandatory.
2. Measurement units and currency/point semantics must be explicit and
   compatible with the declared instrument.
3. Missing measurements remain explicit `Measurement.value=null` with a valid
   missing reason; they are not converted to zero.
4. `changePctFromPriorCashClose` must be based on the explicit normalized
   `priorCashClose`, not a provider-specific implicit reference.
5. `freshness` and `evidenceRefs` are mandatory. Evidence must identify every
   normalized source used for the snapshot.
6. Provider payloads and vendor-specific objects are forbidden.
7. ES, NQ, and RTY remain separate evidence items. Contract consumers must not
   hide disagreement through an unlabeled average.

## 7. PremarketStockSnapshot

Required additive normalized contract:

```text
PremarketStockSnapshot {
  schemaVersion: string
  snapshotId: string
  timestamp: UTC timestamp
  sessionIdentity: SessionIdentity
  symbol: string
  priorClose: Measurement
  premarketPrice: Measurement
  gapPct: Measurement
  premarketVolume: Measurement
  relativePremarketVolume: Measurement
  dollarVolume: Measurement
  sectorId: string | null
  catalystEventIds: string[]
  liquidityQuality: HIGH | MEDIUM | LOW | INSUFFICIENT
  freshness: FreshnessAssessment
  evidenceRefs: EvidenceRef[]
}
```

Contract rules:

1. `sessionIdentity.sessionPhase` must be `premarket` and must match the supplied
   `MarketSessionBoundary`.
2. `snapshotId`, `timestamp`, `symbol`, `liquidityQuality`, `freshness`, and
   `evidenceRefs` are mandatory.
3. `sectorId=null` is explicit missing sector context; it is not sector
   neutrality.
4. `catalystEventIds` is canonically ordered and contains only normalized event
   IDs known to the supplied evaluation. An empty array does not prove that no
   catalyst exists in reality.
5. Missing relative volume, premarket volume, price, or prior close is not zero.
6. `LOW` liquidity reduces confidence. `INSUFFICIENT` liquidity cannot support
   a high-confidence directional state.
7. A gap or price move alone is not confirmed demand, selling pressure, or
   measured money flow.
8. `dollarVolume` is an activity measurement, not evidence of cash entering or
   leaving the market.
9. Provider payloads, UI-created analytics, and AI-created numeric market values
   are forbidden.

## 8. PremarketWindowAssessment

Required additive normalized output contract:

```text
PremarketWindowAssessment {
  schemaVersion: string
  assessmentId: string
  timestamp: UTC timestamp
  window: AFTERHOURS | OVERNIGHT | PREMARKET
  state: GREEN | ORANGE | RED | GREY
  direction: IMPROVING | STABLE | DETERIORATING | UNKNOWN
  confidence: Confidence
  freshness: FreshnessAssessment
  supportingEvidence: EvidenceRef[]
  opposingEvidence: EvidenceRef[]
  sourceSnapshotIds: string[]
  engineMeta: EngineMeta
}
```

Required rules:

1. `assessmentId` is a deterministic identity derived from the declared engine
   version, rule profile, evaluation timestamp, session date/calendar, and
   window. No random or process-local ID is permitted.
2. `timestamp` and `engineMeta.evaluatedAt` equal the explicit evaluation time
   for the assessment.
3. `engineMeta.lifecycle` must be `SHADOW` and
   `engineMeta.deterministic=true`.
4. Each assessment contains evidence from exactly one window. Cross-window
   evidence can be compared only after each independent assessment is retained.
5. `supportingEvidence` and `opposingEvidence` preserve valid agreement and
   disagreement. Neither may be discarded to manufacture consensus.
6. Missing, stale, incompatible, or insufficient required evidence produces
   `GREY`, `UNKNOWN`, and degraded/null confidence as required by the existing
   confidence contract. Missing is not zero or neutral evidence.
7. `sourceSnapshotIds` contains every normalized snapshot used and is
   canonically ordered.
8. State and direction are session-context classifications, not BUY/SELL or
   opening-probability forecasts.

## 9. Additive PremarketSnapshot Extension

The existing `PremarketSnapshot` remains authoritative and all existing fields
remain unchanged. Package 004 adds only:

```text
PremarketSnapshot additions {
  sessionIdentity: SessionIdentity
  windowAssessments: PremarketWindowAssessment[]
  supportingEvidence: EvidenceRef[]
  opposingEvidence: EvidenceRef[]
  sourceSnapshotIds: string[]
  regularOpenTimestamp: UTC timestamp
  freezeStatus: LIVE | FROZEN
  frozenAt: UTC timestamp | null
  engineMeta: EngineMeta
}
```

Extension rules:

1. Existing `PremarketSnapshot` fields are preserved without redefinition.
2. `sessionIdentity` must match the supplied `MarketSessionBoundary` by
   `sessionDate` and `sessionCalendarId`.
3. `windowAssessments` is ordered `AFTERHOURS`, `OVERNIGHT`, `PREMARKET` and
   retains each window independently. Three windows must not be collapsed into
   one unlabeled raw period.
4. `supportingEvidence`, `opposingEvidence`, and `sourceSnapshotIds` preserve the
   provenance of every composite interpretation.
5. `regularOpenTimestamp` must equal the supplied
   `MarketSessionBoundary.regularOpenTimestamp`.
6. When `freezeStatus=LIVE`, `frozenAt` must be `null`.
7. When `freezeStatus=FROZEN`, `frozenAt` must equal
   `regularOpenTimestamp` exactly.
8. At or after explicit regular open, no post-open observation may change the
   frozen record. Regular-session market data, later catalyst events, later
   anomaly results, or process time cannot rewrite it.
9. A correction requires a new separately versioned record with a new identity
   and explicit provenance. The original frozen record remains immutable.
10. `engineMeta.lifecycle` must be `SHADOW` throughout Package 004.
11. The extension contains no opening-scenario probability, PredictionRecord,
    stock decision, trade zone, portfolio action, or broker instruction.

## 10. Additive CatalystEvent Extension

The existing `CatalystEvent` may add one optional field:

```text
impactTier?: LOW | MEDIUM | HIGH | CRITICAL
```

This field does not redefine event timestamp, confidence, event type, or
provenance semantics.

Rules:

1. A scheduled event with a future release time is known future risk, not an
   occurred event.
2. A pending `HIGH` or `CRITICAL` event may degrade confidence according to the
   experimental rule profile.
3. It must not be used as released-event evidence until an eligible normalized
   event observation proves occurrence at or before evaluation time.
4. Unknown impact or missing catalyst is not equivalent to no catalyst.

## 11. Time and Source Integrity

For evaluation at `T`, every consumed observation must satisfy:

```text
input.timestamp <= T
EvidenceRef.sourceMeta.observedAt <= T
EvidenceRef.sourceMeta.receivedAt <= T
historicalOrReference.timestamp <= targetTimestamp <= T
```

Additional invariants:

- no future snapshot, source observation, source receipt, or occurred-event fact;
- no interpolation or forward tolerance;
- no post-open evidence in a premarket calculation;
- future scheduled events may appear only as explicitly pending risk;
- historical references remain past-only and session-compatible;
- stale and missing data remain explicit and fail closed under the approved
  freshness matrix.

## 12. Direct and Proxy Evidence Integrity

Package 004 may derive `ParticipationProxyState` from normalized participation
evidence. It must not:

- create `directFlowValue` from price, volume, breadth, futures, gap, sector, or
  anomaly evidence;
- state that a measured amount entered or left an asset class without compatible
  DIRECT measured-flow evidence;
- merge proxy evidence into a DIRECT measured-flow channel;
- treat missing DIRECT evidence as zero.

DIRECT and PROXY evidence remain separately labeled, provenance-preserving
channels under the existing Package 002 authority.

## 13. Global Rotation Horizon Semantics

`GlobalRotationAssessment` may provide contextual evidence only:

- `overnight` and `1d` are eligible short-horizon context when fresh and
  comparable;
- `5d`, `1m`, and structural horizons remain labeled with their real horizon;
- monthly or structural context must not be represented as overnight flow;
- disagreement between United States context and global context remains visible
  in supporting/opposing evidence.

## 14. Canonical Ordering and Serialization

Package 004 canonical processing and serialization require:

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

supportingEvidence / opposingEvidence / evidenceRefs:
  evidenceId

sourceSnapshotIds / catalystEventIds:
  lexical
```

Identical normalized inputs, `evaluatedAt`, session boundary, rule profile, and
engine version must serialize to byte-for-byte identical canonical output.
Randomness, process-local IDs, unordered-set leakage, locale-dependent sorting,
and implicit system time are forbidden.

## 15. My Focus and AI Discovered Separation

`DiscoveryCandidate` identifies the AI Discovered stream. User-selected My
Focus remains independently owned. Package 004 may reference both inputs for
context but must not mutate My Focus, promote a candidate automatically, create
a Stock Decision State, create Trade Decision Zones, or create portfolio
actions.

## 16. Validation Requirements

Later implementation must add runtime validation and canonical serialization
for every contract in this amendment and verify:

- required fields and enums;
- measurement missingness and units;
- timestamp ordering and time integrity;
- explicit session identity and boundary compatibility;
- window isolation;
- freshness and evidence provenance;
- freeze-state invariants and immutability;
- deterministic identity and ordering;
- SHADOW lifecycle;
- absence of execution or trade-command semantics.

Invalid normalized records must be rejected or fail closed; they must not be
silently repaired by analytical code.

## 17. Explicit Non-Semantics

Nothing in this amendment authorizes or defines:

- live market providers, adapters, vendor payloads, or scraping;
- opening-probability or Base/Bull/Bear forecasts;
- PredictionRecord issuance or Model Test integration;
- Stock Decision Engine or Trade Decision Zones;
- Portfolio Context Engine or automated My Focus promotion;
- broker connectivity, order semantics, or real-money execution;
- ML, neural networks, LLM analysis, or AI-generated market narrative;
- production weights, UI implementation, deployment, or production activation.
