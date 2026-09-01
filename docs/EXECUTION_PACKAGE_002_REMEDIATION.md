# Execution Package 002 Remediation — Deterministic Integrity Corrections

Status: READY FOR EXECUTION
Repository: `bheshmatioei-ctrl/-market-workspace`
Branch: `decision-cockpit-v1`
Package 002 approval status: PARTIAL / NOT APPROVED
Execution boundary: remediate F001–F004 only.

## 0. Authority Order

Before implementation, read and treat the following documents as architecture
authority in this order:

1. `docs/MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md`
2. `docs/ARCHITECTURE_AMENDMENT_001_FEATURE_LIFECYCLE.md`
3. `docs/ARCHITECTURE_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
4. `docs/MARKET_DECISION_INTELLIGENCE_SPEC_v1.md`
5. `docs/MASTER_DATA_CONTRACTS_v1.md`
6. `docs/DATA_CONTRACTS_AMENDMENT_001_ENGINE_OUTPUTS.md`
7. `docs/DATA_CONTRACTS_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`
8. `docs/SOURCE_FRESHNESS_MATRIX_v1.md`
9. `docs/ENGINE_DEPENDENCY_GRAPH_v1.md`
10. `docs/PREMARKET_INTELLIGENCE_BRIEF_SPEC_v1.md`
11. `docs/GLOBAL_CAPITAL_ROTATION_SPEC_v1.md`
12. `docs/EXECUTION_PACKAGE_002_DETERMINISTIC_MARKET_CONTEXT.md`
13. `docs/EXECUTION_002_REPORT.md`
14. `docs/EXECUTION_PACKAGE_002_REMEDIATION.md`

If implementation conflicts with these authorities, stop and report BLOCKED.

## 1. Strict Scope

Implement only:

- F001 `HORIZON_LOOKAHEAD`;
- F002 `SESSION_IDENTITY_NOT_STRUCTURAL`;
- F003 `MARKET_REGIME_DIRECT_PROXY_CONFLATION`;
- F004 `INCOMPATIBLE_DIRECT_FLOW_AGGREGATION`;
- the regression tests required by this document;
- the remediation report required by this document.

Do not redesign unrelated engines, UI, V5, feature lifecycle, schemas, or rule
profiles. Do not begin Package 003.

## 2. Starting Conditions

Before changing implementation code:

1. Confirm branch `decision-cockpit-v1`.
2. Record and verify the current remote branch HEAD containing this authority.
3. Confirm `main` remains at its independently supplied expected SHA.
4. Run `npm_config_offline=true npm run check` as the pre-remediation baseline.
5. Stop as BLOCKED if baseline tests, build, architecture guard, or V5 integrity
   fail.
6. Confirm all Package 002 analytical feature flags remain `SHADOW` and only
   `ACTIVE` can influence production composite state.

## 3. F001 — HORIZON_LOOKAHEAD

### Required eligibility order

Historical comparison candidate eligibility must first require:

```text
candidate.timestamp <= targetTimestamp
```

Only eligible at-or-before-target candidates may enter tolerance calculation
and nearest-candidate selection. The selected result must satisfy:

```text
selected.timestamp <= targetTimestamp <= current.timestamp
```

Backward distance is:

```text
targetTimestamp - candidate.timestamp
```

It must be non-negative and no greater than the configured tolerance. Select
the smallest backward distance; use deterministic snapshot identity ordering
only for an exact timestamp tie.

No candidate after the target is eligible, even when closer than an older
candidate. Example: current `20:00`, target `19:30`, candidates `19:24` and
`19:35`; `19:35` is categorically ineligible. `19:24` is eligible only when the
backward tolerance is at least six minutes.

If no at-or-before-target candidate is inside tolerance, return explicit
`MISSING` or `INSUFFICIENT`. No forward tolerance and no interpolation are
authorized.

## 4. F002 — SESSION_IDENTITY_NOT_STRUCTURAL

Implement the approved additive contracts in:

- `ARCHITECTURE_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`;
- `DATA_CONTRACTS_AMENDMENT_002_HISTORICAL_SESSION_IDENTITY.md`.

Shared normalized `SessionIdentity` contains:

```text
sessionDate: string
sessionPhase: premarket | regular | afterhours | overnight
sessionCalendarId: string
```

For `MarketSnapshot`, `BreadthSnapshot`, and `SectorSnapshot`, same-session
historical equivalence requires exact equality of all three fields. Missing or
mismatched identity fails closed. Do not infer identity from timestamps,
`scopeId`, venue, series position, or implicit calendar behavior.

Existing `MarketSnapshot.sessionDate` and `sessionPhase` remain. When nested
identity is present, contradictory values are contract-invalid.

Package 001 legacy objects without identity remain readable but cannot be used
as same-session comparison candidates. Update Package 002 comparison fixtures
to carry explicit identity.

## 5. F003 — MARKET_REGIME_DIRECT_PROXY_CONFLATION

Market Regime must preserve two independent analytical families:

- `capital_flow_direct`;
- `capital_flow_proxy`.

They must not be averaged into one undifferentiated `capital_flow` value.

### Direct channel

- consumes DIRECT evidence only;
- retains measured-flow provenance;
- never contains proxy scores or proxy evidence;
- treats missing DIRECT as missing, not zero.

### Proxy channel

- consumes PROXY evidence and permitted DERIVED proxy evidence only;
- never represents proxy inference as measured cash flow;
- never creates `directFlowValue`;
- treats missing PROXY as missing, not zero.

For a MIXED `FlowAssessment`, direct and proxy components remain separately
identifiable. Positive DIRECT plus negative PROXY remains explicit opposition
or conflict; it must not be averaged into artificial neutrality.

### Provenance de-duplication

DIRECT evidence must contribute at most once. Before using a raw DIRECT
`AssetFlowSnapshot`, compare its DIRECT `evidenceId` set with the DIRECT
evidence already represented by input `FlowAssessment` records. If that raw
record is represented by overlapping approved provenance, it cannot contribute
a second analytical signal.

De-duplication uses `evidenceId` and approved explicit snapshot provenance. It
must never use numeric equality. An implementation must retain traceable
supporting/opposing evidence for both channels.

## 6. F004 — INCOMPATIBLE_DIRECT_FLOW_AGGREGATION

Multiple DIRECT `AssetFlowSnapshot` records may contribute to one measured
`directFlowValue` only if they share the complete compatibility tuple:

```text
(
  assetClass,
  currency,
  flowPeriod,
  sourceMeta.latencyClass,
  sourceMeta.reportingPeriodStart,
  sourceMeta.reportingPeriodEnd,
  flowValue.unit
)
```

All tuple fields must be explicitly present where required and exactly equal.
Normalized measurement/unit semantics must be compatible. PROXY evidence never
contributes to `directFlowValue`.

Never aggregate:

- USD with EUR;
- daily with weekly or monthly;
- different latency classes;
- different reporting-period starts;
- different reporting-period ends;
- different or incompatible measurement units.

Do not take currency or reporting metadata from the first record to describe a
heterogeneous collection.

If all DIRECT records for an asset class are compatible, their deterministic
aggregation may produce one measured value, with metadata taken from the common
tuple and all DIRECT evidence retained.

If incompatible DIRECT groups cannot be represented separately under the
existing approved output contract, the asset-class assessment must fail closed:

- `state=INSUFFICIENT`;
- `trafficLight=GREY`;
- `score=null`;
- `directFlowValue=null`;
- `currency=null`;
- `reportingPeriod=null`;
- confidence reduced with explicit incompatibility dimensions in
  `degradedBy`;
- distinct DIRECT and PROXY evidence retained in their approved arrays.

Stale or non-decision-grade DIRECT evidence cannot contribute a measured value.

## 7. Required Regression Tests

Add deterministic automated regressions for at least:

1. exact at-target historical candidate;
2. closer post-target candidate rejection;
3. post-target-only history fails closed;
4. backward tolerance only;
5. MarketSnapshot cross-session rejection;
6. BreadthSnapshot cross-session rejection;
7. SectorSnapshot cross-session rejection;
8. missing SessionIdentity fails closed;
9. sessionPhase mismatch rejection;
10. sessionCalendarId mismatch rejection;
11. DIRECT/PROXY MarketRegime separation;
12. DIRECT double-count prevention by provenance;
13. DIRECT-only behavior;
14. PROXY-only behavior;
15. PROXY cannot create measured `directFlowValue`;
16. incompatible currency aggregation rejection;
17. incompatible `reportingPeriodStart` rejection;
18. incompatible `reportingPeriodEnd` rejection;
19. incompatible `flowPeriod` rejection;
20. incompatible `latencyClass` rejection;
21. fully compatible DIRECT records deterministic handling;
22. stale DIRECT evidence fails closed;
23. missing evidence fails closed;
24. invalid historical comparison returns `UNKNOWN/GREY/score=null`;
25. canonical determinism regression;
26. monotonicity regression;
27. conflict-preservation regression;
28. lifecycle regression;
29. all Package 001 regressions;
30. V5 integrity regression.

No required regression may be skipped. Test fixtures remain clearly labelled
MOCK / NOT LIVE.

## 8. Required Validation

Run:

```text
npm_config_offline=true npm run check
```

Required result:

- every Package 001, Package 002, and remediation test passes;
- zero failed and zero skipped tests;
- build PASS;
- architecture guard PASS;
- V5 integrity PASS;
- `main` unchanged;
- deterministic output preserved.

## 9. Global Constraints

The authoritative lifecycle remains `OFF|SHADOW|BETA|ACTIVE`. Only `ACTIVE`
may influence production composite state. Every Package 002 analytical engine
remains `SHADOW`; no Package 002 feature becomes `ACTIVE`.

Do not add or perform:

- live providers or scraping;
- production API keys;
- broker integration or real-money execution;
- black-box BUY/SELL signals;
- machine learning;
- AI-generated market narratives;
- production analytical weights;
- deployment;
- V5 modification;
- `main` modification or merge;
- Package 003 work.

## 10. Commit and Report Policy

The later remediation implementation must produce exactly two ordered commits:

1. one remediation implementation commit containing F001–F004 code, contract,
   fixture, and regression-test changes;
2. after successful validation, one separate report commit adding
   `docs/EXECUTION_002_REMEDIATION_REPORT.md`.

The report records starting HEAD, implementation SHA, exact files, F001–F004
resolutions, test counts, build, architecture guard, V5/main integrity, SHADOW
isolation, forbidden-scope verification, and unresolved issues.

After the report commit, stop. Package 002 remains NOT APPROVED until an
independent review approves the remediation. Package 003 remains unauthorized.

## 11. Acceptance Criteria

Remediation may report PASS only when:

1. all F001–F004 invariants are implemented exactly;
2. all required regressions pass with zero skips;
3. DIRECT/PROXY evidence and measured values remain distinct;
4. incompatible DIRECT records never create a combined measured value;
5. missing/stale/session-unsafe/history-unsafe inputs fail closed;
6. every analytical engine remains SHADOW;
7. build, architecture guard, Package 001 regression, and V5 integrity pass;
8. `main` is unchanged;
9. no forbidden or Package 003 scope exists;
10. implementation and report are separate commits.

PARTIAL applies when useful bounded remediation exists but a non-critical
criterion remains incomplete. BLOCKED applies when time integrity, session
identity, direct/proxy integrity, baseline integrity, or V5 isolation cannot be
preserved.
