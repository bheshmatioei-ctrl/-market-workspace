# Execution Package 006 Remediation Authority

Status:

- PACKAGE 006 REMEDIATION AUTHORITY
- IMPLEMENTATION REQUIRES SEPARATE AUTHORIZATION
- PACKAGE 006 REMAINS UNAPPROVED
- PACKAGE 007 UNAUTHORIZED

Branch: `decision-cockpit-v1`

Authority starting HEAD: `4d8da459728c7a943c6e0ad9db62fef55496efd6`

## 0. Documentation-Only Authority Boundary

This document is additive remediation authority for four defects identified by
the independent Package 006 review. It does not authorize implementation.

This authority permits no source-code, test, configuration, mock, UI, provider,
adapter, deployment, main, or frozen V5 change in the documentation-only task
that creates it. It does not authorize Package 007 and must not auto-continue.

Package 006 remains unapproved until a separately authorized remediation is
implemented, validated, reported, and independently reviewed.

## 1. Binding Authority Relationship

The binding interpretation for later remediation is:

```text
Existing Package 006 architecture authority
+
Data Contracts Amendment 006
+
EXECUTION_PACKAGE_006_REMEDIATION
```

The first two authorities remain in force and are not replaced, rewritten, or
semantically redefined by this document:

1. `docs/EXECUTION_PACKAGE_006_DETERMINISTIC_STOCK_DECISION_INTELLIGENCE.md`
2. `docs/DATA_CONTRACTS_AMENDMENT_006_STOCK_DECISION_INTELLIGENCE.md`
3. this remediation authority.

This document resolves only F001 through F004 below. No architecture expansion,
new evidence family, new analytical input, new lifecycle, or production
calibration is authorized.

If remediation requires any implementation file outside the exact allow-list
in Section 7, execution must stop and request explicit architecture review.

## 2. F001 — CONTEXT_OPPOSING_EVIDENCE_LOSS

Severity: HIGH

### 2.1 Problem

Package 006 must preserve both supporting and opposing evidence from every
approved contextual input. The implementation must not retain only the evidence
that agrees with the contextual state while discarding the context's explicit
opposition.

### 2.2 Required Context Mapping

```text
MARKET RISK_ON / GREEN:
  supportingEvidence -> positive context
  opposingEvidence   -> negative context

MARKET RISK_OFF / RED:
  supportingEvidence -> negative context
  opposingEvidence   -> positive context

DIRECTION IMPROVING:
  supportingEvidence -> positive context
  opposingEvidence   -> negative context

DIRECTION DETERIORATING:
  supportingEvidence -> negative context
  opposingEvidence   -> positive context

FLOW DEMAND:
  directEvidence + proxyEvidence -> positive context
  opposingEvidence               -> negative context

FLOW SELLING_PRESSURE:
  directEvidence + proxyEvidence -> negative context
  opposingEvidence               -> positive context

FLOW MIXED:
  must remain explicit conflict context
  must not silently become zero or neutral
```

### 2.3 Required Invariants

- supporting and opposing evidence remain distinct;
- opposing evidence may not be discarded to manufacture certainty;
- DIRECT and PROXY provenance remain separate;
- DIRECT and PROXY may share a directional context without losing their
  original evidence types or identities;
- equal numeric values do not imply evidence identity;
- de-duplication remains provenance/identity based;
- no new evidence family is authorized;
- no new production-calibrated weight is authorized;
- no hidden averaging of conflicting context is permitted;
- MIXED flow must remain auditable as conflict even if its numeric score is
  zero or null;
- missing context is not zero and is not neutral evidence.

## 3. F002 — MISSING_STOCK_SNAPSHOT_UNKNOWN_PATH_BROKEN

Severity: HIGH

### 3.1 Problem

A valid selected `StockAnalysisSubject` with zero `StockSnapshot` inputs must
produce a valid fail-closed `UNKNOWN` decision. Runtime validation must not
turn that required result into an exception merely because no source snapshot
ID exists.

### 3.2 Required Output

For a valid explicitly selected subject with no `StockSnapshot`:

```text
state = UNKNOWN
trafficLight = GREY
score = null
sourceSnapshotIds = []
sectorId = null
```

### 3.3 Source Snapshot ID Rule

```text
sourceSnapshotIds:
  array required: yes
  canonical ordering: yes
  unique: yes
  non-empty: no
```

An empty array is the correct provenance inventory when the fail-closed reason
is that no stock snapshot was supplied.

### 3.4 Required Invariants

- the engine must not throw merely because no `StockSnapshot` exists;
- the selected subject and approved MARKET decision remain auditable through
  their own IDs;
- missing stock evidence must never become `NEUTRAL`;
- no synthetic snapshot ID may be created;
- no missing value may be converted to zero;
- confidence must disclose missing critical stock evidence;
- this is an implementation correction to existing fail-closed semantics;
- this does not create a new data-contract semantic.

## 4. F003 — EMITTED_DECISION_CANONICAL_ORDER_MISMATCH

Severity: MEDIUM

### 4.1 Required Final Output Ordering

The final emitted Package 006 `DecisionState[]` must be explicitly sorted by:

1. `symbol` / `scopeId`;
2. `stockDecisionContext.subjectId`;
3. `decisionId`.

The final output sort must occur after decision construction.

### 4.2 Forbidden Ordering Leakage

Internal `StockAnalysisSubject` processing order may remain:

```text
symbol -> origin -> subjectId
```

but that order must not determine final decision-array ordering.

In particular, origin ordering must not precede subject ID in the emitted
decision order.

### 4.3 Required Determinism Case

The regression must contain:

- the same symbol;
- multiple explicit subjects;
- different subject IDs;
- different origins;
- reversed or reshuffled input order.

Required invariant:

```text
same semantic normalized inputs
+ same evaluatedAt
+ same rule profile
+ same engine version
= byte-for-byte identical canonical output
```

No locale-dependent ordering, unordered-set leakage, random ID, process-local
counter, or implicit clock value is permitted.

## 5. F004 — FORBIDDEN_SEMANTICS_VALIDATION_INCOMPLETE

Severity: MEDIUM

### 5.1 Validation Strategy

Package 006-specific runtime validation must use strict field allow-lists.
Unknown or additional fields must fail validation even if their names are not
present in a finite deny-list.

Strict allow-list validation applies only to Package 006 records. Legacy and
other authorized non-Package-006 `DecisionState` records must remain
compatible.

### 5.2 StockAnalysisSubject Allow-List

Allowed fields only:

```text
schemaVersion
subjectId
symbol
origin
selectedAt
discoveryCandidateId
```

Any additional field fails runtime validation.

### 5.3 StockDecisionContext Allow-List

Allowed fields only:

```text
subjectId
symbol
origin
marketDecisionId
directionAssessmentIds
sectorId
catalystEventIds
sourceSnapshotIds
engineMeta
```

Any additional field fails runtime validation.

### 5.4 Package 006 DecisionState Allow-List

Allowed fields only:

```text
schemaVersion
decisionId
timestamp
scope
scopeId
state
trafficLight
score
confidence
supportingEvidence
opposingEvidence
freshness
engineVersion
engineMeta
stockDecisionContext
```

This allow-list applies when the record is identified as Package 006 by its
Package 006 engine metadata/context. It must not tighten unrelated legacy or
other approved `DecisionState` records.

### 5.5 Explicitly Forbidden Semantics

Strict allow-list validation must reject additional fields including, but not
limited to:

```text
BUY
SELL
entryPrice
exitPrice
stopLoss
targetPrice
positionSize
orderType
brokerAction
tradeDecisionZone
opportunityZone
conditionalZone
partialProfitZone
exitRiskZone
holdCondition
invalidationLevel
predictionRecord
portfolioAction
executionInstruction
```

Field-name case or nesting must not provide a route around the Package 006
allow-lists. No trade command, recommendation, price zone, position sizing,
portfolio action, prediction issuance, broker action, or execution instruction
is authorized.

## 6. Required Remediation Tests

The existing Package 006 mock scenario authority remains exactly 24/24.

- Do not add scenario 25.
- Do not remove or rename any existing Package 006 scenario.
- Remediation cases must be direct fixtures/test cases in the existing Package
  006 test suite.

A later separately authorized remediation must add at least these 13 tests:

1. `R006-F001-01` — market opposing evidence preserved;
2. `R006-F001-02` — direction opposing evidence preserved;
3. `R006-F001-03` — DEMAND flow opposing evidence preserved;
4. `R006-F001-04` — SELLING_PRESSURE flow opposing evidence preserved;
5. `R006-F001-05` — MIXED flow remains explicit conflict;
6. `R006-F002-01` — selected subject plus zero `StockSnapshot` produces
   `UNKNOWN/GREY/null`;
7. `R006-F002-02` — empty `sourceSnapshotIds` validates for the
   `UNKNOWN` path;
8. `R006-F003-01` — same-symbol, multi-subject canonical decision ordering;
9. `R006-F003-02` — reordered semantic inputs produce byte-identical output;
10. `R006-F004-01` — unauthorized Package 006 `DecisionState` field
    rejected;
11. `R006-F004-02` — unauthorized `StockDecisionContext` field rejected;
12. `R006-F004-03` — unauthorized `StockAnalysisSubject` field rejected;
13. `R006-F004-04` — non-Package-006 legacy `DecisionState` remains
    compatible.

Each test must assert the required semantic result, not merely exercise a code
path. No test may be skipped.

## 7. Future Implementation Scope

A later remediation implementation requires separate explicit authorization.

That later implementation may modify only:

1. `src/decision-cockpit/engines/stock-decision-engine.js`
2. `src/decision-cockpit/contracts/validators.js`
3. `src/decision-cockpit/tests/stock-decision-engine.test.js`

No other source, test, mock, configuration, package, UI, provider, adapter, or
authority file is authorized for modification.

If any additional implementation file appears necessary, stop before editing
and request explicit architecture review. Do not silently widen the scope.

## 8. Future Baseline and Regression Gates

Before later remediation implementation, verify the exact separately
authorized starting remote HEAD and run:

```text
npm_config_offline=true npm run check
```

Required pre-remediation baseline:

```text
223 passed
0 failed
0 skipped
```

After remediation, require:

- all remediation tests pass;
- all existing Package 006 tests pass;
- Package 001 regression PASS;
- Package 002 regression PASS;
- Package 003 regression PASS;
- Package 004 regression PASS;
- Package 005 regression PASS;
- V5 integrity PASS;
- build PASS;
- architecture guard PASS;
- deterministic serialization PASS;
- SHADOW isolation PASS;
- main unchanged.

Any failure, skip, SHA mismatch, unexplained worktree change, authority
conflict, or required out-of-scope file is an immediate stop condition.

## 9. Lifecycle and Calibration Preservation

Package 006 remains exactly:

```text
engineId: stock-decision-engine
engineVersion: 0.6-shadow
ruleProfileId: stock-decision.experimental.v0.6
ruleProfileVersion: 0.6.0
lifecycle: SHADOW
```

Mandatory rules:

- do not change rule-profile calibration;
- do not add or remove tuning dimensions;
- do not promote SHADOW to BETA or ACTIVE;
- do not introduce an ACTIVE Package 006 feature;
- Package 006 output must not influence production composite state;
- remediation remains deterministic;
- Package 006 remains pending independent approval after implementation.

## 10. Explicit Forbidden Scope

This remediation authority does not authorize:

- Package 007 work;
- Trade Decision Zones;
- Stock Decision UI;
- live providers;
- Reuters or Bloomberg integration;
- scraping;
- API keys;
- broker connectivity;
- broker execution;
- real-money trading;
- options analytics;
- options contracts;
- PredictionRecord issuance;
- PredictionOutcome processing;
- Model Test implementation;
- Portfolio Engine;
- deployment;
- ML;
- neural networks;
- LLM-generated numeric market data;
- production calibration;
- modification of main;
- modification of frozen V5;
- merge;
- auto-continuation.

## 11. Future Remediation Commit and Report Policy

A separately authorized implementation must:

1. verify its exact authorized starting remote HEAD;
2. verify the 223-test baseline;
3. change only the three files allowed by Section 7;
4. implement only F001 through F004;
5. add at least the 13 required direct remediation tests without altering the
   24-scenario set;
6. run the complete validation gate;
7. create one separate remediation implementation commit;
8. create a separate `docs/EXECUTION_006_REMEDIATION_REPORT.md` only after
   the implementation commit;
9. commit that report separately;
10. push only `decision-cockpit-v1`;
11. stop.

Even if all gates pass, Package 006 remains
`IMPLEMENTED_PENDING_INDEPENDENT_REVIEW` until independently reviewed.
Package 007 remains unauthorized.

## 12. Acceptance Conditions

The remediation is eligible for independent review only when:

1. every approved context preserves both its supporting and opposing evidence;
2. FLOW DEMAND, SELLING_PRESSURE, and MIXED preserve explicit context and
   DIRECT/PROXY provenance;
3. a selected subject with zero stock snapshots returns a valid
   `UNKNOWN/GREY/score=null` decision with `sourceSnapshotIds=[]`;
4. final decisions are explicitly ordered by scopeId, subjectId, decisionId;
5. the same semantic inputs serialize byte-identically after input reorder;
6. all three Package 006-specific contracts enforce their exact field
   allow-lists;
7. unrelated legacy DecisionState compatibility remains intact;
8. all 13 named remediation tests pass;
9. all prior tests and regression gates pass;
10. Package 006 remains SHADOW and non-composite;
11. no forbidden scope or additional file enters the remediation;
12. main and frozen V5 remain unchanged.

## 13. Stop Conditions

Stop without implementation or architecture invention if:

- the required starting SHA differs;
- main differs from its approved SHA;
- the worktree contains unexplained changes;
- an authority file is missing;
- the 223-test baseline fails;
- an additional file is required;
- a new evidence family, weight, contract semantic, or analytical input seems
  necessary;
- legacy compatibility cannot be preserved;
- any test, build, architecture guard, V5, determinism, or SHADOW-isolation gate
  fails;
- remediation would require Package 007 work.

AUTO_CONTINUE: false
