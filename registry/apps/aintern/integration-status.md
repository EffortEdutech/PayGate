# AIntern Integration Status

**Status:** Registry active and sandbox checkout smoke-tested.  
**Date:** 2026-08-27

## Current Scope

- AIntern registered as Payment Hub app `aintern`.
- Initial one-time pass plans active: `pass_3m`, `pass_6m`.
- Stripe sandbox lookup keys expected:
  - `aintern_pass_3m`
  - `aintern_pass_6m`
- Entitlement bundle maps to AIntern review/report/export/bundled-AI gates.
- Test application URL points to AIntern local dev server: `http://127.0.0.1:4900`.
- Local app token mapping added to `.env.local`.

## Pending Before AIntern App Wiring

- Restart Payment Hub so `.env.local` and active AIntern registry are loaded for user-facing console testing.
- Wire AIntern UI through the Payment Hub; do not add Stripe SDK to AIntern.
## Smoke Test Evidence

- AIntern catalog returned both active plans from temporary Hub port 3018.
- AIntern pass_3m Checkout Session was created successfully through Stripe sandbox lookup key intern_pass_3m.
