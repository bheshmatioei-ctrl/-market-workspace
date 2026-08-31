# Premarket Intelligence Brief — Specification v1

Status: DRAFT BASELINE
Parent system: Market Decision Intelligence System
Branch: decision-cockpit-v1

## 1. Purpose

Create a dedicated premarket intelligence layer covering the period from the prior US regular-session close until the next US regular-session open.

The goal is not to produce a generic news summary. The goal is to answer, before the opening bell:

1. What changed overnight?
2. Where is risk appetite improving or deteriorating?
3. Which sectors and stocks show abnormal premarket participation?
4. Which macro, geopolitical, earnings, SEC, analyst, or company events are likely to matter at the open?
5. What is the likely opening regime: constructive, mixed, risk-off, or uncertain?
6. Which user Focus stocks require immediate attention?

## 2. Time Window

Primary window:
- Start: prior US regular-session close, 16:00 ET.
- End: next US regular-session open, 09:30 ET.

Sub-windows must remain separate:
- Post-market: 16:00–20:00 ET.
- Overnight futures / global session.
- US premarket: 04:00–09:30 ET.

The system must not merge these into one undifferentiated period because liquidity, market structure, and interpretability differ materially.

## 3. Core Output

The brief should appear automatically in the Decision Cockpit before the open and remain accessible through a dedicated PREMARKET button.

Top summary:

PREMARKET STATE
- GREEN / ORANGE / RED / GREY.
- Premarket regime score.
- Confidence.
- Last update time.
- Data freshness state.

Example:

PREMARKET STATE: ORANGE — CAUTION
Overnight direction: deteriorating
Index futures: mixed-negative
Broad premarket participation: weak
Semiconductors: relative strength
Energy: positive
Primary risk: 08:30 ET macro release
Confidence: 7.4/10

## 4. Premarket Market State Engine

Inputs:
- ES / NQ / RTY futures.
- Futures change since prior cash close.
- Futures change during overnight and premarket sub-windows.
- VIX futures / volatility proxies when available.
- US Treasury yields.
- DXY.
- Oil.
- Gold.
- Bitcoin/crypto only as a secondary risk proxy, never as a primary equity signal.
- European equity indices.
- Major Asian equity indices.
- Relevant sector/ETF premarket moves.

Outputs:
- Constructive / Mixed / Risk-Off / Uncertain.
- Improving / Stable / Deteriorating.
- Supporting evidence.
- Opposing evidence.

## 5. Premarket Participation / Flow Proxy

Important limitation:
The system must NOT claim exact net money inflow/outflow for the entire US equity market unless a valid source directly provides that measure.

Instead, use observable participation proxies:
- Premarket dollar volume.
- Advancing vs declining premarket symbols when available.
- Up-volume vs down-volume when available.
- Relative volume vs normal premarket baseline.
- ETF/sector price-volume behavior.
- Futures direction and volume.
- Broad vs concentrated participation.

Allowed labels:
- Broad demand proxy.
- Broad selling-pressure proxy.
- Concentrated demand.
- Concentrated selling.
- Mixed participation.
- Insufficient evidence.

Avoid unsupported wording such as “$X billion entered the market” unless sourced from an actual flow dataset.

## 6. Premarket Movers Engine

Scan for:
- Largest dollar-volume movers.
- Largest percentage gaps, filtered for liquidity.
- Abnormal relative premarket volume.
- Gap with news catalyst.
- Gap without identifiable catalyst.
- Gap continuation vs gap fade.
- Premarket VWAP / anchored reference where valid.
- Sector confirmation or divergence.

Each item includes:
- Symbol.
- Premarket price.
- Gap % vs prior close.
- Premarket volume.
- Relative premarket volume or percentile when available.
- Dollar volume.
- Catalyst.
- Sector context.
- Interpretation.
- Confidence.

## 7. News & Catalyst Digest

Rank overnight information by expected market relevance rather than chronology.

Categories:
- Earnings and guidance.
- SEC filings.
- M&A.
- Analyst actions only when materially market-moving.
- Product / regulatory / legal developments.
- Fed communications.
- Macro releases outside regular hours.
- Geopolitical events.
- Commodity shocks.
- Major global-market developments.

Each item:
- Timestamp.
- Source.
- Affected symbols/sectors.
- Expected direction if inferable.
- Confidence.
- Whether already reflected in premarket price.

The system should distinguish:
FACT -> MARKET REACTION -> INTERPRETATION.

## 8. Scheduled Risk Before Open

Display a countdown list for scheduled events between current time and 09:30 ET.

Examples:
- CPI/PPI/PCE.
- Payrolls / claims.
- Fed speakers.
- Treasury announcements.
- Company earnings before open.
- Other high-impact releases.

If a major release has not yet occurred, the system must reduce confidence in premarket directional conclusions.

Example:

08:12 ET
PREMARKET BIAS: GREEN
CONFIDENCE: reduced to 5.8/10
Reason: CPI at 08:30 ET may invalidate current futures signal.

## 9. My Focus Premarket Section

For each user-selected Focus stock:
- Prior close.
- Current premarket price.
- Gap %.
- Premarket volume.
- Relative premarket volume.
- Relevant overnight news.
- Sector move.
- Index/futures context.
- Current model state.

Possible states:
- GREEN — constructive premarket setup.
- ORANGE — mixed / event-sensitive.
- RED — material deterioration / selling pressure.
- GREY — insufficient liquidity or evidence.

The system must explicitly warn when premarket liquidity is too thin for reliable interpretation.

## 10. AI Discovered Premarket

Separate from My Focus.

Surface names with:
- High dollar volume.
- High relative premarket volume.
- Material news catalyst.
- Strong sector confirmation.
- Unusual gap behavior.

Do not surface illiquid microcaps solely because of large percentage moves.

## 11. Opening Scenario Engine

Generate conditional scenarios rather than a deterministic forecast.

Example:

BASE CASE — 48%
Mixed open; QQQ stronger than broad market.

BULL CASE — 30%
If 10Y yield falls and NQ holds overnight high, risk-on broadens.

BEAR CASE — 22%
If NQ loses premarket low with breadth deterioration, opening sell pressure likely.

Requirements:
- Probabilities are model estimates, not facts.
- Sum to 100% if probabilities are displayed.
- Include invalidation conditions.
- Store the forecast in Model Test Lab if enabled.

## 12. Premarket Traffic-Light Summary

At minimum show:

INDEX FUTURES          GREEN/ORANGE/RED/GREY
GLOBAL RISK            GREEN/ORANGE/RED/GREY
RATES                   GREEN/ORANGE/RED/GREY
VOLATILITY              GREEN/ORANGE/RED/GREY
BROAD PARTICIPATION     GREEN/ORANGE/RED/GREY
SECTOR LEADERSHIP       GREEN/ORANGE/RED/GREY
NEWS/CATALYST RISK      GREEN/ORANGE/RED/GREY
MY FOCUS RISK           GREEN/ORANGE/RED/GREY

Then produce one composite Premarket State with confidence.

## 13. Opening Handoff

At 09:30 ET the Premarket Brief does not disappear.

It freezes a final premarket snapshot and hands state to the intraday engines.

Persist:
- Final premarket regime.
- Futures levels at open.
- Key premarket highs/lows.
- Premarket movers.
- Expected scenarios.
- Important catalysts.
- Predictions issued before open.

Intraday system can later compare:
PREMARKET EXPECTATION vs ACTUAL OPENING BEHAVIOR.

This becomes useful validation data.

## 14. Model Test Integration

Premarket forecasts can optionally create immutable PredictionRecords.

Test examples:
- Direction from 09:30 to 10:00 ET.
- Direction from 09:30 to 11:30 ET.
- Close vs open.
- Whether identified premarket leaders outperform benchmark.
- Whether identified red-risk names underperform benchmark.

Metrics remain separate from intraday model metrics so premarket skill can be evaluated independently.

## 15. Data Contracts Required

Add normalized models:

PremarketSnapshot
- timestamp
- sessionDate
- futuresState
- macroRiskState
- globalMarketState
- participationState
- sectorState
- focusStocks
- discoveredStocks
- scheduledEvents
- newsEvents
- compositeState
- confidence
- freshness

PremarketStockSnapshot
- symbol
- priorClose
- premarketPrice
- gapPct
- premarketVolume
- relativePremarketVolume
- dollarVolume
- catalystIds
- sectorState
- interpretationState
- confidence
- liquidityQuality

PremarketScenario
- issuedAt
- horizon
- scenarioType
- probability
- conditions
- invalidation
- evidenceSnapshotId
- modelVersion

## 16. UI Placement

Decision Cockpit top navigation includes:
- LIVE MARKET
- PREMARKET
- MODEL TEST

PREMARKET page structure:

1. Premarket State + countdown to open.
2. Futures / rates / volatility / global risk strip.
3. Overnight + premarket timeline.
4. Participation / flow-proxy panel.
5. Sector map.
6. My Focus premarket table.
7. AI Discovered premarket movers.
8. Ranked news/catalyst digest.
9. Scheduled risk before open.
10. Opening scenarios.

## 17. Architectural Invariants

1. Premarket and regular-session data are never silently mixed.
2. Post-market, overnight, and premarket sub-windows remain distinguishable.
3. Thin-liquidity observations reduce confidence.
4. Exact capital-flow claims require actual flow data; otherwise label as proxy/inference.
5. News and price reaction are stored separately.
6. Major unreleased scheduled events reduce forecast confidence.
7. Premarket snapshot freezes at the open and becomes historical evidence.
8. Premarket model performance is measured separately from intraday performance.
9. My Focus and AI Discovered remain separate.
10. Raw measurements remain visible beside interpretation and traffic-light state.

## 18. Initial Implementation Order

1. Define PremarketSnapshot contracts.
2. Add futures/rates/global-market adapters.
3. Add premarket stock scanner and liquidity filters.
4. Add ranked catalyst/news ingestion.
5. Add My Focus premarket analysis.
6. Add opening scenarios.
7. Add immutable premarket Model Test records.
8. Add cockpit PREMARKET view.

Do not build the visual dashboard before the contracts and interpretation rules are stable.
