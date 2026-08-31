# Source & Freshness Matrix v1

Status: BASELINE DRAFT

Purpose: define source priority, timing expectations, fallback policy, and staleness behavior before implementation.

| Data Domain | Primary Source Class | Preferred Example | Backup Class | Target Freshness | Stale Rule |
|---|---|---|---|---|---|
| US equity prices | exchange/market-data vendor | SIP/direct licensed feed where available | reputable vendor | realtime to <=15s | >60s intraday => degraded |
| SPY/QQQ/IWM/DIA | market-data vendor | licensed consolidated feed | reputable vendor | realtime to <=15s | >60s => degraded |
| Futures ES/NQ/RTY | exchange/vendor | CME-derived licensed feed | reputable futures vendor | realtime | >60s => degraded |
| VIX | exchange/vendor | Cboe-derived feed | reputable vendor | realtime | >60s => degraded |
| Treasury yields | official/vendor | US Treasury/Fed/vendor market feed | reputable vendor | <=5m intraday | >15m => degraded |
| DXY/FX | market-data vendor | institutional FX vendor | reputable vendor | <=1m | >5m => degraded |
| Gold/Oil | exchange/vendor | CME/ICE-derived feed | reputable vendor | <=1m | >5m => degraded |
| Market breadth | exchange/market-internals vendor | NYSE/Nasdaq/Barchart-style internals | secondary internals provider | <=5m | >15m => stale |
| New highs/lows | exchange/internals vendor | official/aggregated internals | secondary vendor | <=5m | >15m => stale |
| Sector/ETF prices | market-data vendor | licensed feed | reputable vendor | <=1m | >5m => degraded |
| Premarket stock data | market-data vendor | licensed extended-hours feed | reputable vendor | <=1m | >5m => degraded |
| Options activity | exchange/vendor | Cboe/OPRA-derived licensed data | reputable analytics vendor | <=1m where licensed | >5m => degraded |
| SEC filings | regulator | SEC EDGAR | trusted filing mirror | near-real-time | >10m after filing => degraded |
| Macro releases | official | BLS/BEA/Fed/Census/ISM official where applicable | Reuters/Bloomberg-style newswire | release-time | any older value after new release => stale |
| Fed events | official | Federal Reserve | high-quality newswire | event-time | stale after new statement/event |
| Earnings/guidance | company IR/filing | issuer IR + SEC | high-quality wire | near-real-time | >15m => degraded |
| Company news | company/official + trusted wire | IR/press release/Reuters etc. | secondary trusted media | event-time | contextual |
| US fund/ETF flows | official/industry/vendor | ICI / licensed LSEG-Lipper / EPFR | trusted secondary | daily/weekly depending dataset | frequency explicitly displayed |
| Money-market flows | official/industry | ICI or equivalent | trusted secondary | weekly/daily if licensed | frequency displayed |
| Gold/commodity ETF flows | fund issuer/vendor | issuer/industry/vendor | trusted secondary | daily where available | frequency displayed |
| Cross-border structural flows | official/international | BIS/IMF/US Treasury TIC | trusted secondary | monthly/quarterly | structural only; never intraday |
| Country exchange foreign flows | exchange/regulator | local exchange/official stats | trusted vendor | daily where available | frequency displayed |
| Global rotation proxy | derived | normalized multi-asset inputs | none | based on freshest components | confidence degraded by stale components |
| News sentiment/AI synthesis | derived | trusted sourced news set | none | as source permits | cannot exceed source freshness |

## Source Priority
1. Primary official/regulator/exchange.
2. Company filing or investor relations for issuer-specific facts.
3. Licensed market-data provider.
4. High-quality financial newswire.
5. Aggregator.
6. Derived proxy.

## Mandatory Metadata
Every value presented to an engine or UI must expose:
- source
- observedAt
- receivedAt
- reporting period when non-realtime
- latency class
- freshness state
- direct/proxy/derived classification

## Staleness Policy
- LIVE: within target freshness.
- DELAYED: known delayed feed but still within declared delay.
- DEGRADED: older than target but possibly usable with confidence penalty.
- STALE: must not drive directional conclusions.
- UNAVAILABLE: use GREY.

## Conflict Policy
When two sources disagree materially:
1. Prefer fresher source if same authority class.
2. Prefer higher-authority source if freshness remains acceptable.
3. Preserve both observations when discrepancy is analytically relevant.
4. Emit conflict flag; do not silently average incompatible values.

## Licensing Rule
Do not design production dependence on scraped or unlicensed realtime data. Adapters must be replaceable so a prototype source can later be swapped for a licensed production source without changing engines or UI contracts.
