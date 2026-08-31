# EXECUTION_PACKAGE_001 — Foundation & Normalized State Layer

Status: READY FOR WORK EXECUTION
Repository: bheshmatioei-ctrl/-market-workspace
Branch: decision-cockpit-v1

## Authority
Read and follow these documents before changing code:
1. docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md
2. docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md
3. docs/MASTER_DATA_CONTRACTS_v1.md
4. docs/SOURCE_FRESHNESS_MATRIX_v1.md
5. docs/ENGINE_DEPENDENCY_GRAPH_v1.md
6. docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md
7. docs/GLOBAL_CAPITAL_ROTATION_SPEC_v1.md

If implementation choices conflict with those documents, STOP and report the conflict. Do not invent a competing architecture.

## Mission
Implement ONLY the foundation and normalized state layer for the new Market Decision Intelligence System.

Do not modify the current V5 production UX on main.
Do not merge to main.
Do not implement live market-data providers yet.
Do not implement AI-generated market narratives yet.
Do not implement real-money trading or broker integration.

## Required Outcome
Create a clean, testable internal foundation that allows future data providers, engines, and UI panels to be added without cross-module coupling.

## Step 1 — Inspect Existing Project
- Inspect repository structure, framework, package manager, build scripts, and test setup.
- Preserve existing V5 behavior.
- Reuse existing conventions where they do not conflict with the new architecture.
- Report detected stack and relevant constraints before major restructuring.

## Step 2 — Create New Isolated Module Boundary
Create an isolated Decision Cockpit source area using project-appropriate conventions.

Recommended logical structure; adapt path names to existing stack but preserve boundaries:

src/decision-cockpit/
  domain/
  contracts/
  adapters/
  engines/
  state/
  validation/
  ui/
  mocks/
  tests/

Do not move legacy V5 code into this module.

## Step 3 — Implement Versioned Contracts
Implement typed/runtime-validatable models corresponding to MASTER_DATA_CONTRACTS_v1:
- SourceMeta
- EvidenceRef
- Confidence
- MarketSnapshot
- BreadthSnapshot
- SectorSnapshot
- StockSnapshot
- AssetFlowSnapshot
- CountryFlowSnapshot
- PremarketSnapshot
- CatalystEvent
- Alert
- DecisionState
- TradeDecisionZone
- PredictionRecord
- PredictionOutcome

Requirements:
- explicit schemaVersion at persistence/serialization boundary
- deterministic serialization
- UTC timestamps internally
- explicit units
- DIRECT/PROXY/DERIVED evidence classification
- no provider-specific fields inside normalized contracts
- missing values represented explicitly, never as directional defaults

Use the most appropriate validation mechanism already compatible with the repository stack. Do not add a heavyweight dependency unless justified.

## Step 4 — Freshness Engine
Implement a small deterministic freshness utility that maps SourceMeta into:
- LIVE
- DELAYED
- DEGRADED
- STALE
- UNAVAILABLE

Requirements:
- thresholds configurable by data domain
- pure/testable functions
- stale observations cannot be considered decision-grade
- return reason for degraded/stale status

Do not connect to external APIs.

## Step 5 — Evidence & Confidence Utilities
Implement deterministic utilities for:
- aggregating evidence references without losing provenance
- reducing confidence when inputs are missing, stale, conflicting, or low-quality
- preserving supporting and opposing evidence separately

Do NOT implement machine-learning scoring.
Do NOT invent final production weights.

## Step 6 — Mock Snapshot Fixtures
Create realistic but clearly labeled MOCK fixtures for:
- one constructive market state
- one risk-off market state
- one conflicted market state
- one premarket state
- one US asset-flow state containing both DIRECT and PROXY data
- one global capital-rotation state with mixed data quality
- 5 mock focus stocks
- 5 mock AI-discovered stocks

All mock values must be explicitly marked as mock/test data and must never look like live data in production mode.

## Step 7 — Static Cockpit Shell
Build only a static shell capable of rendering normalized mock states.

Required top navigation:
- LIVE MARKET
- PREMARKET
- GLOBAL FLOW
- MODEL TEST

Required shell panels:
- Market State
- Market Direction: 30m / 60m / 2h / Session
- US Asset Flow
- Global Capital Rotation summary
- Money Flow placeholder
- Live Alerts placeholder
- My Focus
- AI Discovered
- Market Internals placeholder
- Macro/Risk placeholder
- Decision Timeline placeholder

Visual-state support:
- GREEN
- ORANGE
- RED
- GREY

Important:
- colors must be accompanied by text/status labels
- raw values must be visible or inspectable beside derived status
- no fake live badges
- visibly label mock mode

Do not attempt final visual polish. This is an architecture-validation shell.

## Step 8 — Model Test Foundation
Implement storage model/interfaces only for immutable PredictionRecord and PredictionOutcome.

Requirements:
- PredictionRecord cannot be edited after issuance through normal domain API
- failed predictions cannot be removed from aggregate metrics by normal workflow
- every record stores modelVersion and evidenceSnapshotHash
- no predictive algorithm yet

A local/mock persistence implementation is sufficient for this package.

## Step 9 — Feature Flags
Implement feature lifecycle support:
- OFF
- SHADOW
- BETA
- ACTIVE

At minimum create flags for:
- globalCapitalRotation
- usAssetFlowMonitor
- premarketIntelligence
- anomalyRadar
- stockDecisionEngine
- tradeDecisionZones
- modelTestLab

Default unfinished analytical engines to SHADOW or OFF. They must not affect composite market state yet.

## Step 10 — Tests
Add tests appropriate to the existing stack covering at minimum:
1. serialization round-trip for normalized contracts
2. schema version presence
3. freshness classification boundaries
4. stale input confidence degradation
5. missing input => GREY/unknown behavior where applicable
6. DIRECT and PROXY flow cannot be silently conflated
7. PredictionRecord immutability
8. feature flag state handling
9. mock shell renders without using external network data
10. legacy V5 smoke test/build remains successful

## Step 11 — Architecture Guard
Add a simple enforceable guard where practical:
- decision engines must not import provider-specific adapters directly
- UI must not import provider raw payload types
- legacy V5 must not depend on decision-cockpit internals

If automated import-boundary enforcement is impractical in the current stack, document the limitation and add the closest test/lint guard available.

## Step 12 — Documentation
Create:
- docs/EXECUTION_001_REPORT.md

Report must include:
- files added/changed
- detected technology stack
- architectural decisions made
- deviations from requested structure and why
- tests executed and results
- build result
- known limitations
- exact next recommended task
- commit SHA(s)

## Hard Invariants
1. Do not modify main.
2. Do not destroy or replace V5.
3. Do not connect live providers in this package.
4. Do not scrape realtime websites.
5. Do not fabricate market data.
6. Do not add broker execution.
7. Do not implement black-box BUY/SELL signals.
8. Keep DIRECT flow distinct from PROXY/DERIVED flow.
9. Keep premarket distinct from regular session.
10. Keep market state distinct from stock state.
11. Keep My Focus distinct from AI Discovered.
12. Keep 30m/60m/2h/session horizons distinct.
13. Preserve provenance and timestamps.
14. Missing/stale evidence reduces confidence; it never becomes a directional default.
15. Do not add unrelated widgets or features.

## Completion Gate
Do not declare this package complete unless:
- repository builds
- tests pass or every failure is explicitly documented
- V5 remains functional
- normalized contracts are implemented
- mock cockpit shell renders
- no external live data dependency was introduced
- EXECUTION_001_REPORT.md exists

## Stop Conditions
STOP and ask for architectural review if any of these occur:
- existing stack makes contract isolation materially incompatible
- implementation would require changing V5 behavior
- a requested contract is ambiguous enough to change semantics
- a live-data dependency is required to proceed
- a major dependency addition would lock the project to one data vendor

On completion, return only a concise execution handoff containing:
- STATUS: PASS / PARTIAL / BLOCKED
- branch
- commit SHA
- test/build summary
- changed files summary
- unresolved issues
- next recommended action

Do not start EXECUTION_PACKAGE_002 automatically.