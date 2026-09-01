# Architecture Amendment 001 — Feature Lifecycle Normalization

Status: APPROVED ARCHITECTURE AMENDMENT
Applies to: Market Decision Intelligence System
Branch: decision-cockpit-v1

## Purpose

Normalize feature lifecycle terminology before any later execution package relies on lifecycle transitions.

## Authoritative Lifecycle

The authoritative feature lifecycle is:

- OFF
- SHADOW
- BETA
- ACTIVE

These names replace the earlier draft wording OFF / TEST / SHADOW / ON in section 9.5 of `MARKET_DECISION_SYSTEM_MASTER_ARCHITECTURE_v1.md`.

## Semantics

### OFF
The feature does not compute, render, or influence composite state.

### SHADOW
The feature may compute and persist evaluation data for testing, but must not render as an active user-facing production feature and must not influence composite state.

### BETA
The feature may compute and render to the user, but must not influence production composite state unless a later architecture decision explicitly changes this rule.

### ACTIVE
The feature may compute, render, and influence composite state according to its validated engine contract.

## Invariants

1. Only ACTIVE features may influence production composite state.
2. SHADOW is the preferred lifecycle for new analytical engines during validation.
3. BETA permits visible evaluation without production-state authority.
4. Lifecycle transitions must be explicit and version-controlled.
5. Historical predictions retain the engine/model version and lifecycle state that existed at issuance.
6. This amendment overrides conflicting lifecycle terminology in earlier architecture text without changing any other architecture rule.

## Implementation Alignment

Execution Package 001 already implements OFF / SHADOW / BETA / ACTIVE and therefore requires no code change for this normalization.
