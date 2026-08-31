# Engine Dependency Graph v1

Status: BASELINE DRAFT

## Core Direction

DATA ADAPTERS
  -> NORMALIZED STATE
  -> ANALYTICAL ENGINES
  -> DECISION STATES / ALERTS
  -> UI
  -> MODEL TEST / VALIDATION

No reverse dependency from UI into engine logic.

## Normalized State Layer

Inputs from adapters become:
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot
- StockSnapshot
- AssetFlowSnapshot
- CountryFlowSnapshot
- PremarketSnapshot
- CatalystEvent

## Engine Dependencies

### Market Regime Engine
Reads:
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot
- selected AssetFlowSnapshot
- compact Global Rotation summary
Produces:
- market DecisionState

### Market Direction Engine
Reads:
- time series of MarketSnapshot
- BreadthSnapshot
- SectorSnapshot
Produces:
- 30m/60m/120m/session DirectionState

### Money Flow Engine
Reads:
- SectorSnapshot
- StockSnapshot aggregates
- BreadthSnapshot
- selected AssetFlowSnapshot
Produces:
- sector/segment flow-proxy states

### US Asset Flow Monitor
Reads:
- direct fund/ETF/money-market/bond/gold flow datasets
- intraday proxy inputs from MarketSnapshot/BreadthSnapshot/SectorSnapshot
Produces:
- AssetFlowSnapshot[]
- direct/proxy separation

### Global Capital Rotation Engine
Reads:
- CountryFlowSnapshot
- country indices/ETFs
- FX
- sovereign yields
- direct official/vendor flow data where available
Produces:
- country/region rotation states
- compact global summary

### Premarket Intelligence Engine
Reads:
- overnight MarketSnapshot
- futures/rates/FX/commodities
- Global Capital Rotation summary
- CatalystEvent
- premarket StockSnapshot
- My Focus universe
Produces:
- PremarketSnapshot
- opening scenarios
- premarket alerts

### Anomaly Radar
Reads:
- broad StockSnapshot universe
- SectorSnapshot
- CatalystEvent
Produces:
- Alert[]
- AI Discovered candidates

### Stock Decision Engine
Reads:
- Focus StockSnapshot
- AI Discovered promoted StockSnapshot
- Market Regime DecisionState
- Market Direction states
- SectorSnapshot
- CatalystEvent
- optional options evidence
Produces:
- stock DecisionState

### Trade Decision Zone Engine
Reads:
- stock DecisionState
- StockSnapshot
- Market Regime
- Market Direction
- Catalyst risk
Produces:
- TradeDecisionZone[]

### Event & Catalyst Engine
Reads:
- official macro/event calendar
- SEC filings
- issuer IR/news
- trusted wires
Produces:
- CatalystEvent[]
- risk flags

### Portfolio Context Engine
Reads:
- optional user holdings/exposure
- Stock DecisionState
- SectorSnapshot
Produces:
- exposure/concentration alerts

### Decision Timeline
Reads:
- versioned DecisionState changes
- Alert events
- CatalystEvent
Produces:
- ordered intraday timeline

### Model Test Lab
Reads immutable copies of:
- PredictionRecord
- evidence snapshot hashes
- subsequent normalized market data
Produces:
- PredictionOutcome
- validation metrics

## Isolation Rules
1. Engines do not call external providers directly.
2. Engines consume normalized contracts only.
3. UI does not calculate market logic; it renders engine outputs and raw evidence.
4. Model Test cannot rewrite historical predictions.
5. Global Rotation cannot overwrite US Market Regime; disagreement is surfaced.
6. Premarket snapshot freezes at 09:30 ET and is not mutated by regular-session data.
7. Direct flow and inferred flow remain separate through all layers.
8. New engines integrate through contracts/events, not direct cross-module mutation.

## Extension Rule
A new module must declare:
- consumed contract versions
- emitted contract versions
- dependencies
- data freshness requirements
- confidence degradation rules
- UI consumer(s)
- validation method
- feature flag: OFF|SHADOW|BETA|ACTIVE

## Feature Lifecycle
OFF -> SHADOW -> BETA -> ACTIVE

SHADOW means the module runs and records outputs for validation but does not affect composite traffic lights or user-facing decision scores.

## Composite State Rule
Composite states must consume engine outputs with explicit versioned weighting. No engine may secretly mutate another engine score. When signals disagree, produce a conflict state or reduced confidence.
