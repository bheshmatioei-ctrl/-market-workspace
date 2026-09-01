# Architecture Amendment 002 — Historical Session Identity

Status: APPROVED ARCHITECTURE AMENDMENT
Applies to: Market Decision Intelligence System
Branch: `decision-cockpit-v1`
Compatibility: narrowly scoped and additive; no existing field is removed.

## Purpose

Establish one explicit, normalized session identity for deterministic historical
comparisons across `MarketSnapshot`, `BreadthSnapshot`, and `SectorSnapshot`.
Timestamp proximity alone cannot prove that two observations belong to the same
market session.

## Shared SessionIdentity

```text
SessionIdentity {
  sessionDate: string
  sessionPhase: premarket | regular | afterhours | overnight
  sessionCalendarId: string
}
```

`sessionDate` identifies the declared market-session date. It is not inferred
from UTC time.

`sessionPhase` identifies the declared phase within that session.

`sessionCalendarId` identifies the calendar authority used by the normalized
producer. Package 002 does not define exchange holidays, early closes, daylight
saving transitions, or venue calendars inside the state layer.

## Historical-Comparison Eligibility

Any `MarketSnapshot`, `BreadthSnapshot`, or `SectorSnapshot` that participates
in a same-session historical comparison must contain an explicit
`sessionIdentity`.

Two snapshots are same-session equivalent only when all three fields match
exactly:

```text
candidate.sessionIdentity.sessionDate == current.sessionIdentity.sessionDate
candidate.sessionIdentity.sessionPhase == current.sessionIdentity.sessionPhase
candidate.sessionIdentity.sessionCalendarId == current.sessionIdentity.sessionCalendarId
```

Missing identity is not compatible. Partial identity is not compatible. A field
mismatch is not compatible. When equivalence cannot be proven, the comparison
must fail closed to explicit `MISSING` or `INSUFFICIENT` metadata. A consuming
direction assessment must therefore become `UNKNOWN`, `GREY`, and `score=null`.

## Prohibited Inference

`HistoricalSnapshotWindow` must not infer session identity from:

- timestamps or time zones;
- `scopeId`, symbol, venue, or sector;
- insertion order or series position;
- a default exchange calendar;
- another snapshot's identity.

Calendar semantics belong to normalized producers/adapters. The state layer
compares declared identities; it does not create them.

## MarketSnapshot Compatibility

Existing top-level `MarketSnapshot.sessionDate` and
`MarketSnapshot.sessionPhase` remain present and are not replaced.

When `MarketSnapshot.sessionIdentity` is provided:

- `sessionDate` must equal `sessionIdentity.sessionDate`;
- `sessionPhase` must equal `sessionIdentity.sessionPhase`.

A contradiction is contract-invalid and cannot enter historical state.

## Additive Migration Boundary

This amendment does not invalidate stored Package 001 snapshots solely because
they predate `SessionIdentity`. Such snapshots remain readable under their
original contract, but they are ineligible for same-session historical
comparison and must fail closed when used for that purpose.

All new Package 002 historical-comparison fixtures and normalized producers must
populate `sessionIdentity` explicitly.

## Protected Invariants

1. Same-session identity is explicit and structurally equivalent across all
   three historical snapshot types.
2. Missing identity never becomes assumed compatibility.
3. Session identity is independent of horizon-target timestamp eligibility.
4. No future or post-target snapshot becomes eligible through session matching.
5. No interpolation is authorized.
6. This amendment changes no V5 behavior and authorizes no production feature.
