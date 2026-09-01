# Data Contracts Amendment 002 — Historical Session Identity

Status: APPROVED ADDITIVE CONTRACT AMENDMENT
Applies to: Market Decision Intelligence System
Branch: `decision-cockpit-v1`
Compatibility: additive to Master Data Contracts v1 and Data Contracts
Amendment 001; no existing field is removed or renamed.

## Purpose

Provide a shared runtime-validatable identity for same-session historical
comparisons. This amendment closes the structural mismatch between
`MarketSnapshot`, `BreadthSnapshot`, and `SectorSnapshot` without assigning
exchange-calendar logic to `HistoricalSnapshotWindow`.

## SessionIdentity Contract

Required fields:

- `sessionDate`: non-empty string in `YYYY-MM-DD` form;
- `sessionPhase`: `premarket|regular|afterhours|overnight`;
- `sessionCalendarId`: non-empty, versioned string identifying the normalized
  calendar authority, for example a stable mock/test calendar identifier.

No additional meaning may be inferred from `sessionCalendarId` by Package 002
engines. Equality is exact string equality.

## Additive Snapshot Fields

The following normalized contracts gain an additive field:

```text
MarketSnapshot.sessionIdentity: SessionIdentity
BreadthSnapshot.sessionIdentity: SessionIdentity
SectorSnapshot.sessionIdentity: SessionIdentity
```

The field is mandatory for any instance admitted to
`HistoricalSnapshotWindow` for same-session comparison.

Legacy serialized snapshots that do not contain this additive field remain
readable, but are not comparison-grade. Missing `sessionIdentity` must produce
explicit insufficiency rather than inferred compatibility.

## MarketSnapshot Consistency

The existing fields remain required:

- `MarketSnapshot.sessionDate`
- `MarketSnapshot.sessionPhase`

When `sessionIdentity` is present, runtime validation must reject:

```text
MarketSnapshot.sessionDate != sessionIdentity.sessionDate
MarketSnapshot.sessionPhase != sessionIdentity.sessionPhase
```

## HistoricalSnapshotWindow Admission and Comparison

For the three supported historical contract types, append/admission for
same-session comparison requires a complete, runtime-valid `SessionIdentity`.
Implementations may retain legacy snapshots as non-comparison-grade records,
but must never select them as a same-session comparison.

Candidate equivalence requires exact equality of the complete tuple:

```text
(
  sessionDate,
  sessionPhase,
  sessionCalendarId
)
```

Missing, partial, invalid, or mismatched identity returns `MISSING` or
`INSUFFICIENT`. It never returns a comparison snapshot.

## Target-Time Contract

Session equivalence does not override target-time eligibility. A comparison
candidate must independently satisfy:

```text
candidate.timestamp <= targetTimestamp <= current.timestamp
```

Backward tolerance is calculated only after this constraint. Forward tolerance
and interpolation remain prohibited.

## Versioning and Serialization

`SessionIdentity` must be included in deterministic canonical serialization
when present. Runtime validators must validate the complete nested object and
the MarketSnapshot consistency rules above.

This is an additive migration boundary. No current major contract is removed or
redefined, and no provider-specific calendar payload may leak into normalized
state.

## Acceptance Invariants

1. New Package 002 historical fixtures carry explicit `SessionIdentity`.
2. Market, breadth, and sector histories use the same normalized structure.
3. Missing identity fails closed.
4. Cross-date, cross-phase, and cross-calendar comparisons fail closed.
5. Legacy MarketSnapshot fields cannot contradict nested identity.
6. Canonical serialization remains deterministic.
7. Package 001 regression compatibility is preserved.
