# Global Capital Rotation — Specification v1

Status: DRAFT BASELINE
Branch: decision-cockpit-v1
Purpose: Add a one-click global capital-flow view to the Market Decision Intelligence System without conflating direct flow data with inferred market rotation.

## 1. User Goal

Provide a fast visual answer to:
- Which countries/regions appear to be receiving capital?
- Which countries/regions appear to be losing capital?
- Is the evidence direct flow data or only a market-based proxy?
- How confident is the system?

The feature is informational and validation-oriented. It is not a deterministic trading signal.

## 2. One-Click UX

Persistent action:
GLOBAL CAPITAL ROTATION

On click, open a dedicated list/map view with one row per country/region.

Recommended columns:
- Country / Region
- Equity Flow State
- Bond Flow State
- FX Pressure
- Risk Asset State
- Direct Flow Data
- Proxy Flow State
- Confidence
- Last Update
- Data Quality

## 3. Traffic-Light States

GREEN:
Evidence supports net inflow / improving demand / constructive rotation.

ORANGE:
Mixed evidence, transition, weak signal, or disagreement between direct and proxy data.

RED:
Evidence supports net outflow / deteriorating demand / defensive rotation away from the country/region.

GREY:
Insufficient, stale, unavailable, or non-comparable data.

Color is always accompanied by text and evidence.

## 4. Critical Distinction — Direct vs Inferred

The system must never present inferred rotation as if it were measured cash flow.

### 4.1 DIRECT FLOW
Use where available from recognized sources such as:
- official cross-border flow releases;
- fund/ETF flow datasets;
- exchange-reported foreign investor flows;
- central-bank or government flow statistics;
- BIS/IMF/Treasury structural flow datasets, with explicit frequency labels.

Display example:
DIRECT FLOW: +$X bn
Frequency: daily / weekly / monthly / quarterly
Source: [source]
As of: [timestamp/reporting period]

### 4.2 INFERRED FLOW / ROTATION PROXY
Derived from market behavior such as:
- country equity index performance;
- country ETF price + volume;
- relative strength versus global benchmark;
- local sovereign yields;
- FX move;
- futures;
- breadth;
- volatility;
- commodity sensitivity;
- regional session behavior.

Display example:
PROXY ROTATION: GREEN
Interpretation: improving relative demand
Confidence: 0.74

Never convert proxy evidence into a fake dollar inflow number.

## 5. Regional Coverage

Initial universe:
- United States
- Canada
- United Kingdom
- Euro Area
- Germany
- France
- Switzerland
- Japan
- China
- Hong Kong
- South Korea
- Taiwan
- India
- Australia
- Brazil
- Mexico
- Selected emerging markets aggregate

Architecture must allow later expansion.

## 6. Multi-Asset Evidence Model

For each country/region calculate separate evidence buckets:

### Equities
- index direction
- breadth when available
- country ETF relative volume
- relative strength

### Bonds
- sovereign yield direction
- price/yield demand proxy
- foreign participation if direct data is available

### FX
- currency strength/weakness
- direction versus USD and relevant crosses

### Risk
- volatility
- credit spread proxy when available
- local/global risk regime

### Direct Fund Flow
- ETF/mutual-fund/cross-border measured flow where licensed/available

## 7. Country Rotation Score

The score must be decomposable. Example candidate structure:

CountryRotationScore =
0.25 EquityEvidence +
0.20 BondEvidence +
0.20 FXEvidence +
0.15 RelativeStrength +
0.10 RiskEvidence +
0.10 DirectFlowEvidence

Important:
- weights are provisional;
- direct flow evidence receives additional confidence weight when fresh and methodologically comparable;
- missing inputs reduce confidence rather than being assumed neutral/positive;
- weights must later be empirically validated.

## 8. Display Example

GLOBAL CAPITAL ROTATION

United States   ORANGE  Mixed / selective inflow   Confidence 72%
Japan           GREEN   Improving demand           Confidence 81%
Euro Area       GREEN   Moderate positive rotation Confidence 68%
China/HK        RED     Relative outflow pressure  Confidence 76%
Brazil          GREY    Insufficient fresh data    Confidence 31%

Expanded row:
Japan
- Equity proxy: GREEN
- Bond proxy: ORANGE
- FX: GREEN
- Direct flow: +X [if available]
- Relative strength vs MSCI World: positive
- Last update: [timestamp]
- Evidence type: MIXED DIRECT + INFERRED

## 9. Time Horizons

Keep horizons separate:
- Overnight
- 1 trading day
- 5 trading days
- 1 month
- Structural flow trend

Do not combine quarterly BIS data with intraday market proxies into one undifferentiated signal.

## 10. Premarket Integration

The Premarket Intelligence Brief should consume a compact summary from this engine:

GLOBAL ROTATION SUMMARY
- Risk-On / Risk-Off global state
- strongest positive country/region rotations
- strongest negative rotations
- major FX/bond confirmation
- direct-flow updates since prior US close
- confidence

This summary must be frozen at the US open for later validation.

## 11. Model Test Integration

Store each premarket/global-rotation call with:
- timestamp
- country/region
- direction
- confidence
- direct/proxy evidence split
- horizon
- subsequent index/ETF performance

Evaluate:
- directional accuracy
- calibration
- performance by country
- performance by regime
- value added versus simple relative-strength baseline

## 12. Data Quality Rules

1. Every flow number must include source, period and timestamp.
2. Direct flow and proxy flow must have different labels and UI styling.
3. Stale direct data may inform structural context but cannot be treated as current intraday flow.
4. Cross-country comparisons must account for different reporting frequencies.
5. If data is not comparable, state NON-COMPARABLE.
6. No invented flow numbers.
7. No green/red state when evidence quality is below minimum threshold; use GREY.

## 13. Relationship to Existing Engines

Global Capital Rotation is an independent engine feeding:
- Premarket Intelligence Brief
- Market Regime Engine
- Money Flow Engine
- Event & Catalyst Engine
- Model Test Lab

It must not overwrite those engines. If it disagrees with US market internals, surface the disagreement explicitly.

## 14. Initial Deliverable

First implementation should use mocked country snapshots and verify:
- list rendering;
- traffic-light logic;
- direct vs proxy labeling;
- timestamp/freshness handling;
- conflict state;
- confidence degradation when data is missing.

Live country-flow adapters are added only after the normalized schema is stable.
