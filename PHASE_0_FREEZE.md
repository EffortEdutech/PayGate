# Phase 0 — Foundation Freeze

**Status:** FROZEN  
**Frozen on:** 2026-08-26  
**Primary provider:** Stripe  
**Scope:** architecture and executable contracts

Phase 0 is accepted when `npm run phase0:verify` passes. The frozen baseline comprises:

- ADRs 0001–0004;
- security, API, provider-capability, webhook, database, and Stripe adapter contracts;
- the seven-file application registry contract and strict schemas;
- semantic registry validation and its tests;
- the engineering constitution in `AGENTS.md`.

Changes to a frozen contract require a new ADR. Backward-incompatible API, registry, or persisted-event changes require a new version rather than silent mutation.

## Invariants

1. Applications do not integrate secret provider APIs directly.
2. The Hub resolves commercial authority from the registry.
3. Provider financial events are normalized before reaching applications.
4. Entitlements are separate from provider billing status.
5. Stripe is the first adapter, not the Hub domain model.
6. Multi-provider routing, marketplace/Connect, usage billing, tax engines, payouts, and ledger accounting remain outside V1.

