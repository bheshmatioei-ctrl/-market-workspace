# Engine boundary

Execution Package 002 adds deterministic, explainable analytical engines that
consume normalized contracts only:

- `MarketRegimeEngine` `0.2-shadow`
- `MarketDirectionEngine` `0.2-shadow`
- `MoneyFlowEngine` `0.2-shadow`
- `USAssetFlowMonitor` `0.2-shadow`
- `GlobalCapitalRotationEngine` `0.2-shadow`
- immutable `MarketContextBundle` assembler

Their versioned rule profiles live in `rules/profiles.js`, are explicitly
`EXPERIMENTAL`, and carry `SHADOW` lifecycle metadata. These outputs are test
artifacts: they cannot render as production signals or influence a production
composite. Direct measured flow and proxy evidence stay separate, stale or
insufficient inputs fail closed, and no engine imports provider adapters or
performs network access.
