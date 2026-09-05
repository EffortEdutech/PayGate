# Central Payment Hub

Provider-neutral payment, subscription, and entitlement infrastructure for all applications, with Stripe as the first provider.

Phase 0 is frozen in [`PHASE_0_FREEZE.md`](PHASE_0_FREEZE.md). Phase 1 provides the executable registry and service foundation; it does not perform live transactions.

## Commands

```bash
npm install
npm run check
npm test
```

## Authority boundaries

- `registry/apps/*` defines what we intend to sell.
- The Hub database owns normalized operational and entitlement state.
- Payment providers own the financial facts that occurred.
- Applications own their users and application data, and consume Hub entitlements.


## Local Port Convention

This project is locked to the localhost `301#` family. The default Hub port is `3017`, and local development ports must stay within `3010-3019` unless a future ADR changes the convention.
