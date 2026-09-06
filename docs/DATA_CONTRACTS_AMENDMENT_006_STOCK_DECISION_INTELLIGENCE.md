# Data Contracts Amendment 006 — Stock Decision Intelligence

Status: APPROVED ADDITIVE CONTRACT AUTHORITY

Applies to: Market Decision Intelligence System

Branch: `decision-cockpit-v1`

Compatibility: additive to Master Data Contracts v1 and all approved data
contract amendments. No existing contract or field may be removed, renamed,
or semantically redefined.

## 1. Purpose

Define normalized contracts for deterministic SHADOW stock analysis of an
explicitly selected subject. Package 006 reuses the existing `DecisionState`
with `scope=STOCK`; it does not define a trade command, recommendation, Trade
Decision Zone, portfolio action, prediction, or execution instruction.

The authorized data flow is:

```text
Explicit StockAnalysisSubject
        +
Approved normalized evidence
        ↓
Stock Decision Engine
        ↓
DecisionState(scope=STOCK)
+ StockDecisionContext
```

## 2. Reused Approved Types

This amendment reuses without redefining:

- `SessionIdentity`;
- `Measurement`;
- `SourceMeta`;
- `EvidenceRef`;
- `Confidence`;
- `FreshnessAssessment`;
- `EngineMeta`;
- `TrafficLight`;
- `DecisionState`;
- `DirectionAssessment`;
- `FlowAssessment`;
- `SectorSnapshot`;
- `StockSnapshot`;
- `CatalystEvent`;
- `DiscoveryCandidate`.

The authoritative lifecycle is `OFF | SHADOW | BETA | ACTIVE`. Every Package
006 output requires `EngineMeta.lifecycle=SHADOW`. Only `ACTIVE` may influence
production composite state.

## 3. Stock Analysis Origin

```text
StockAnalysisOrigin = MY_FOCUS | AI_DISCOVERED_SELECTED
```

`MY_FOCUS` means the user explicitly selected the symbol as a Focus subject.

`AI_DISCOVERED_SELECTED` means the user explicitly selected an existing,
approved `DiscoveryCandidate` for deep analysis. The existence of a candidate
alone is not selection and does not authorize analysis.

## 4. StockAnalysisSubject

Required additive normalized contract:

```text
StockAnalysisSubject {
  schemaVersion: string
  subjectId: string
  symbol: string
  origin: MY_FOCUS | AI_DISCOVERED_SELECTED
  selectedAt: UTC timestamp
  discoveryCandidateId: string | null
}
```

Contract rules:

1. All fields are mandatory; `discoveryCandidateId` is explicitly nullable.
2. `subjectId`, `symbol`, and `selectedAt` must be non-empty and runtime-valid.
3. For `origin=MY_FOCUS`, `discoveryCandidateId` must be `null`.
4. For `origin=AI_DISCOVERED_SELECTED`, `discoveryCandidateId` must be a
   non-empty ID of a supplied, approved `DiscoveryCandidate` whose symbol
   equals `StockAnalysisSubject.symbol` exactly.
5. `selectedAt` must be at or before the engine's explicit `evaluatedAt`.
6. A `DiscoveryCandidate` without a matching explicit subject is ineligible.
7. Selection cannot be inferred from array membership, UI display, provider
   payload, symbol equality, alert presence, or prior processing.
8. No provider may create or promote a `StockAnalysisSubject` implicitly.
9. Subject identity is deterministic and must not use a random UUID,
   process-local counter, or array position.
10. Same `subjectId` plus byte-identical canonical content may de-duplicate;
    same `subjectId` plus different canonical content is invalid and fails
    closed.

## 5. Stock Decision Output

Package 006 reuses the existing `DecisionState` and requires:

```text
DecisionState.scope = STOCK
DecisionState.scopeId = StockAnalysisSubject.symbol
DecisionState.timestamp = evaluatedAt
DecisionState.engineVersion = 0.6-shadow
```

The only authorized Package 006 state values are:

```text
ACCUMULATION
BUY_PRESSURE
NEUTRAL
CONFLICTED
DISTRIBUTION
SELL_PRESSURE
WAIT_EVENT_RISK
UNKNOWN
```

These are analytical classifications only:

```text
BUY_PRESSURE != BUY ORDER
SELL_PRESSURE != SELL ORDER
ACCUMULATION != BUY
DISTRIBUTION != SELL
```

Package 006 does not redefine any existing `DecisionState` field or state
semantics.

## 6. Additive StockDecisionContext

Required additive context for every Package 006 stock decision:

```text
StockDecisionContext {
  subjectId: string
  symbol: string
  origin: MY_FOCUS | AI_DISCOVERED_SELECTED
  marketDecisionId: string
  directionAssessmentIds: string[]
  sectorId: string | null
  catalystEventIds: string[]
  sourceSnapshotIds: string[]
  engineMeta: EngineMeta
}
```

Package 006 authorizes the following optional additive field on the existing
contract:

```text
DecisionState.stockDecisionContext?: StockDecisionContext
```

Compatibility rules:

1. Legacy `DecisionState` records remain valid without this field.
2. A Package 006 output with `scope=STOCK` must include the field.
3. A non-Package-006 `DecisionState` is not required to include it.
4. `subjectId`, `symbol`, and `origin` must match the admitted
   `StockAnalysisSubject` exactly.
5. `symbol` must equal `DecisionState.scopeId`.
6. `marketDecisionId` identifies the approved `scope=MARKET` decision consumed;
   it must never identify a stock decision or a locally recalculated regime.
7. `directionAssessmentIds` retains every consumed assessment ID, ordered by
   `30m`, `60m`, `120m`, `SESSION`, then assessment ID.
8. `sectorId=null` represents missing sector context, not a neutral sector.
9. `catalystEventIds` and `sourceSnapshotIds` are unique and lexically ordered
   by Unicode code point.
10. `engineMeta` must identify the exact Package 006 engine, evaluation,
    schema versions, and rule profile. It must be consistent with
    `DecisionState.engineVersion` and timestamp.

## 7. Additive Historical Session Identity for StockSnapshot

To enforce the required no-cross-session rule structurally, this amendment
authorizes reuse of the approved `SessionIdentity` on `StockSnapshot`:

```text
StockSnapshot.sessionIdentity?: SessionIdentity
```

This is additive and preserves legacy readability. It does not change existing
`StockSnapshot` fields.

Rules:

1. A `StockSnapshot` used as a current-only observation may remain readable
   without `sessionIdentity`, subject to all other contract rules.
2. Every `StockSnapshot` admitted to Package 006 historical comparison must
   contain a complete, runtime-valid `SessionIdentity`.
3. Historical same-session equivalence requires exact equality of:

   ```text
   sessionDate
   sessionPhase
   sessionCalendarId
   ```

4. Missing or partial identity is not compatible and makes the historical
   comparison ineligible.
5. Cross-date, cross-phase, or cross-calendar comparison is forbidden and must
   fail closed.
6. Identity must not be inferred from timestamp, symbol, sector, scope, array
   position, or local/exchange calendar assumptions.
7. This amendment does not authorize cross-session historical comparison.

## 8. Historical Stock Selection

When multiple stock snapshots are used, selection must satisfy:

```text
referenceSnapshot.timestamp < currentSnapshot.timestamp <= evaluatedAt
```

and, for same-session comparison, the complete `SessionIdentity` tuple must
match exactly.

Additional rules:

- all reference evidence is past-only;
- future candidates are categorically ineligible;
- no interpolation or forward tolerance;
- no cross-session contamination;
- no silent repair of missing identity;
- same snapshot ID plus byte-identical canonical bytes may de-duplicate;
- same snapshot ID plus different canonical bytes fails closed;
- numeric equality is never identity.

## 9. Evidence Integrity

Every Package 006 decision retains:

```text
supportingEvidence: EvidenceRef[]
opposingEvidence: EvidenceRef[]
```

Each retained evidence item preserves:

- `evidenceId`;
- complete `sourceMeta`;
- `sourceMeta.observedAt`;
- `sourceMeta.receivedAt`;
- `evidenceType`;
- field;
- value;
- unit where applicable.

Rules:

1. Evidence is canonically ordered by `evidenceId`.
2. Opposing evidence cannot be dropped to manufacture certainty.
3. De-duplication uses explicit identity/provenance, never numeric equality.
4. Missing evidence is not zero and is not neutral evidence.
5. Stock volume or dollar volume is activity evidence, not measured net cash
   flow.
6. DIRECT and PROXY evidence remain separate under the approved flow contracts.
7. A stock decision must remain auditable to every normalized input used.

## 10. Freshness and Fail-Closed Semantics

Package 006 reuses approved freshness semantics and does not calculate a new
local freshness taxonomy.

- `STALE` stock evidence cannot drive a directional stock state.
- unavailable critical stock evidence may force `UNKNOWN` / `GREY`.
- stale market, direction, flow, or sector context is excluded or degrades
  confidence exactly as declared by the versioned experimental rule profile.
- missing freshness is not `LIVE`.
- missing critical evidence must not silently become `NEUTRAL`.
- `UNKNOWN` requires `trafficLight=GREY` and `score=null`.

`NEUTRAL` is permitted only when sufficient valid evidence exists but no
directional state has adequate support.

## 11. Time Integrity

For evaluation at `T`:

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

No future fact, snapshot, reference, source observation, or source receipt is
eligible. No interpolation or forward tolerance is authorized.

A known future scheduled event may be retained only as pending risk. It is not
an occurred fact.

## 12. Catalyst Eligibility

A catalyst may force `WAIT_EVENT_RISK` only when all of these are true:

- the stock symbol appears in `affectedSymbols`;
- `impactTier` is `HIGH` or `CRITICAL`;
- event timing is within the configured relevant window;
- event provenance and source timestamps are eligible;
- the rule profile authorizes the confidence cap or suspension behavior.

A future scheduled event may contribute pending risk, but it must not
contribute as released-event evidence. An unrelated event is ineligible. A
`LOW`-impact event cannot force `WAIT_EVENT_RISK` by itself.

## 13. Deterministic Decision Identity

`DecisionState.decisionId` for Package 006 is derived from at least:

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

The delimiter/encoding and hash representation may follow existing repository
canonical identity conventions, but semantic identity must include the entire
tuple above.

No random UUID, process-local counter, array position, locale ordering, or
implicit current clock may affect identity.

Required invariant:

```text
same semantic normalized inputs
+ same evaluatedAt
+ same rule profile
+ same engine version
= same decisionId and byte-for-byte identical canonical output
```

## 14. Canonical Ordering

Canonical processing and serialization require:

```text
StockAnalysisSubject:
  symbol, origin enum order, subjectId

StockSnapshot:
  symbol, timestamp, snapshotId

DirectionAssessment:
  30m, 60m, 120m, SESSION; then assessmentId

SectorSnapshot:
  sectorId, timestamp, snapshotId

FlowAssessment:
  scope, scopeId, flowMode, assessmentId

CatalystEvent:
  timestamp, eventId

DiscoveryCandidate:
  symbol, candidateId

supportingEvidence / opposingEvidence / evidenceRefs:
  evidenceId

catalystEventIds / sourceSnapshotIds:
  lexical Unicode code-point order
```

No locale-dependent ordering or unordered-set leakage is permitted.

## 15. Options Evidence

```text
OPTIONS_EVIDENCE:
  status: DEFERRED
  reason: NO_APPROVED_NORMALIZED_OPTIONS_CONTRACT
```

This amendment does not authorize options-chain contracts, implied-volatility
analytics, gamma, open-interest analytics, put/call models, dealer positioning,
or provider-specific options data. A separate architecture and data-contract
authority is required.

## 16. Explicit Forbidden Fields and Semantics

Package 006 contracts and outputs must not add or imply:

```text
BUY command
SELL command
entryPrice
exitPrice
stopLoss
targetPrice
positionSize
orderType
brokerAction
Opportunity Zone
Conditional Zone
Partial Profit Zone
Exit Risk Zone
Hold Condition
Invalidation Level
real-money execution instruction
```

They also must not issue `PredictionRecord`, process `PredictionOutcome`,
perform Model Test work, create portfolio actions, or define options evidence.

## 17. Runtime Validation Requirements

A later implementation must provide runtime validation and deterministic
canonical serialization for:

- `StockAnalysisSubject`;
- `StockDecisionContext`;
- the additive Package 006 `DecisionState.stockDecisionContext` field;
- the additive historical `StockSnapshot.sessionIdentity` field;
- selection/provenance consistency;
- state, traffic-light, score, freshness, time, and evidence invariants;
- duplicate identity handling;
- lifecycle and engine/rule-profile identity;
- absence of trade, prediction, provider, portfolio, and execution semantics.

Invalid normalized records must be rejected or fail closed. Engines must not
silently repair contract violations.

## 18. Compatibility and Non-Semantics

This additive amendment does not authorize or define:

- Trade Decision Zones or any price/action zone;
- broker connectivity, orders, or execution;
- Portfolio Context Engine;
- options analytics or contracts;
- PredictionRecord, PredictionOutcome, or Model Test implementation;
- live providers, Reuters/Bloomberg integration, scraping, or API keys;
- LLM market narrative or AI-generated numeric market data;
- ML, neural networks, production-calibrated weights, or deployment;
- SHADOW-to-BETA or SHADOW-to-ACTIVE promotion;
- full Stock Decision UI integration;
- main or V5 modification, merge, or Package 007 work.

## 19. Acceptance Invariants

1. Analysis requires an explicit, valid `StockAnalysisSubject`.
2. AI Discovered does not become selected automatically.
3. Existing `DecisionState` semantics remain unchanged.
4. Package 006 stock context is additive, normalized, and auditable.
5. Historical stock comparisons are past-only and explicitly same-session.
6. Missing/stale evidence fails closed and is not converted to neutrality.
7. Market, direction, sector, and flow conflicts remain visible.
8. DIRECT and PROXY evidence remain separate.
9. State names never become trade commands.
10. Deterministic identity and canonical bytes are stable under input reorder.
11. Every Package 006 output remains SHADOW.
12. No Package 006 output influences production composite state.
13. Options evidence remains deferred.
14. No Trade Decision Zone, provider, prediction, broker, deployment, or
    Package 007 semantic enters this contract.
