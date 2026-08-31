# Master Data Contracts v1

Status: BASELINE DRAFT
Branch: decision-cockpit-v1

## Purpose
Define stable normalized schemas between data adapters, analytical engines, UI, and model validation. Provider-specific payloads must never flow directly into analytical engines or UI.

## Common Types

### SourceMeta
- sourceId: string
- sourceName: string
- sourceType: official|exchange|regulator|vendor|aggregator|derived
- observedAt: timestamp
- receivedAt: timestamp
- reportingPeriodStart?: timestamp/date
- reportingPeriodEnd?: timestamp/date
- latencyClass: realtime|delayed|daily|weekly|monthly|quarterly
- freshnessSeconds?: number
- isStale: boolean
- qualityScore: 0..1

### EvidenceRef
- evidenceId: string
- sourceMeta: SourceMeta
- field: string
- value: number|string|boolean
- unit?: string
- evidenceType: DIRECT|PROXY|DERIVED

### Confidence
- score: 0..1
- reasons: string[]
- degradedBy: string[]

### TrafficLight
GREEN|ORANGE|RED|GREY

### DirectionState
IMPROVING|STABLE|DETERIORATING|UNKNOWN

## MarketSnapshot
- snapshotId
- timestamp
- sessionDate
- sessionPhase: premarket|regular|afterhours|overnight
- spy
- qqq
- iwm
- dia
- vix
- ust2y
- ust10y
- dxy
- gold
- oil
- bitcoinOptional
- freshness
- evidenceRefs[]

## BreadthSnapshot
- snapshotId
- timestamp
- venue: NYSE|NASDAQ|US_COMPOSITE
- advancers
- decliners
- unchanged
- advancingVolume
- decliningVolume
- newHighs
- newLows
- pctAbove50DMA?
- pctAbove200DMA?
- evidenceRefs[]

## SectorSnapshot
- snapshotId
- timestamp
- sectorId
- benchmarkSymbol
- priceChangePct
- relativeStrengthVsSPY
- relativeVolume
- breadthPctPositive?
- upDownVolumeRatio?
- state: GREEN|ORANGE|RED|GREY
- confidence
- evidenceRefs[]

## StockSnapshot
- snapshotId
- timestamp
- symbol
- price
- priorClose
- changePct
- volume
- avgVolume?
- relativeVolume?
- dollarVolume?
- vwap?
- distanceFromVWAPPct?
- dayHigh?
- dayLow?
- relativeStrengthVsBenchmark?
- sectorId?
- newsEventIds[]
- freshness
- evidenceRefs[]

## AssetFlowSnapshot
Used for US asset-allocation views.
- snapshotId
- timestamp
- assetClass: US_EQUITY|US_BOND|MONEY_MARKET|GOLD|COMMODITY|HIGH_YIELD|TECH_ETF|OTHER
- flowValue?: number
- currency?: string
- flowPeriod: intraday|daily|weekly|monthly
- flowType: DIRECT|PROXY
- proxyState?: GREEN|ORANGE|RED|GREY
- methodologyId
- confidence
- sourceMeta
- evidenceRefs[]

Rule: if flowType=PROXY, flowValue must be null unless the value itself is an explicitly defined proxy metric rather than claimed net cash flow.

## CountryFlowSnapshot
- snapshotId
- timestamp
- countryOrRegion
- horizon: overnight|1d|5d|1m|structural
- equityFlowValue?
- bondFlowValue?
- directFlowAvailable: boolean
- proxyRotationState
- fxState
- sovereignBondState
- relativeStrengthState
- compositeState
- confidence
- evidenceRefs[]

## PremarketSnapshot
- snapshotId
- timestamp
- sessionDate
- futuresState
- macroRiskState
- globalMarketState
- participationState
- sectorStates[]
- focusStocks[]
- discoveredStocks[]
- scheduledEventIds[]
- newsEventIds[]
- compositeState
- directionState
- confidence
- freshness

## CatalystEvent
- eventId
- timestamp
- eventType: macro|fed|earnings|guidance|sec|mna|analyst|legal|regulatory|geopolitical|commodity|other
- scheduled: boolean
- scheduledAt?
- sourceMeta
- headline
- summary
- affectedSymbols[]
- affectedSectors[]
- factualImpact
- marketReaction?
- interpretation?
- confidence

## Alert
- alertId
- createdAt
- type
- severity: info|watch|warning|critical
- symbol?
- sector?
- marketWide: boolean
- rawEvidence[]
- interpretation
- trafficLight
- confidence
- expiresAt?
- modelVersion

## DecisionState
- decisionId
- timestamp
- scope: MARKET|SECTOR|STOCK|PREMARKET|GLOBAL_ROTATION
- scopeId
- state: ACCUMULATION|BUY_PRESSURE|NEUTRAL|CONFLICTED|DISTRIBUTION|SELL_PRESSURE|WAIT_EVENT_RISK|RISK_ON|RISK_OFF|UNKNOWN
- trafficLight
- score
- confidence
- supportingEvidence[]
- opposingEvidence[]
- freshness
- engineVersion

## TradeDecisionZone
- zoneId
- createdAt
- symbol
- zoneType: OPPORTUNITY|CONDITIONAL|PARTIAL_PROFIT|EXIT_RISK|HOLD|INVALIDATION
- lowPrice?
- highPrice?
- validFrom
- validUntil?
- conditions[]
- invalidationConditions[]
- confidence
- engineVersion

## PredictionRecord
Immutable after creation.
- predictionId
- issuedAt
- scope
- symbolOrScopeId
- modelVersion
- horizon
- referencePrice?
- predictedDirection
- expectedMoveLowPct?
- expectedMoveHighPct?
- confidence
- marketRegimeAtIssue
- evidenceSnapshotHash
- evidenceRefs[]

## PredictionOutcome
- predictionId
- evaluatedAt
- actualMovePct
- actualDirection
- maxFavorableExcursionPct?
- maxAdverseExcursionPct?
- magnitudeError?
- pass: boolean
- evaluationRuleVersion

## Versioning Rules
1. Every schema carries an explicit schemaVersion at persistence boundary.
2. Additive optional fields are backward-compatible minor changes.
3. Renames/removals/semantic changes require new major schema version.
4. Engines declare accepted input schema versions and emitted output versions.
5. UI consumes normalized contracts only.
6. Provider adapters own provider-specific mapping.
7. Missing data reduces confidence; it is never silently coerced into a directional value.
