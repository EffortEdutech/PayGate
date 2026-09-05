# Phase 3 AIntern Integration Plan

**Status:** STARTED  
**Selected app:** AIntern  
**AIntern path:** `C:\Users\user\Documents\00 aWL_platform\AIntern`  
**Payment Hub port family:** `301#`, default `3017`  
**AIntern dev port:** `4900`

## Objective

Integrate AIntern as the first real application consumer of the Central Payment Hub.

AIntern must use the Hub for billing authority:

- checkout session creation;
- billing portal session creation;
- entitlement reads;
- subscription state reads;
- reconciliation proof.

AIntern must not own Stripe prices, Stripe customers, Stripe webhook processing, or entitlement mutation.

## Strategic Architecture Rule

The Payment Hub must support multiple company/provider accounts.

Apps must route through the Hub like this:

```text
App -> Payment Hub -> Provider account selected by registry
```

Not like this:

```text
App -> hardcoded Stripe account
```

Each app registry package must declare the provider account it belongs to. Example:

```yaml
provider:
  type: stripe
  account: nhl_global_solution
```

The provider account controls which company's Stripe credentials, webhook secret, portal, reconciliation, and settlement context are used.

This protects company separation and allows future expansion:

- AIntern -> `stripe:nhl_global_solution`
- WorkLedger -> `stripe:bina_jaya`
- Future app -> `stripe:company_x`

`primary` is allowed only as a temporary local sandbox alias until named provider accounts are introduced.

## Operator Benefit

The operator gets one control layer for all apps:

- one console to test payments;
- one place to manage Stripe/provider credentials;
- one registry showing which app bills under which company;
- one webhook/reconciliation path;
- less duplicated payment code in each app;
- safer company revenue separation;
- easier provider replacement later.

## Initial Discovery Notes

- AIntern is a Vite + React application.
- AIntern uses Supabase and already has entitlement-related schema history at `database/migrations/006_entitlements.sql`.
- AIntern is mobile-first and offline-first; local device state is draft authority, while Supabase is approval and audit authority.
- AIntern's strict dev server port is `4900`; this remains separate from the Payment Hub `301#` port family.

## Phase 3 Tracks

### Track 1 - Payment Hub Local Console UI

- Add a small local browser UI served by the Payment Hub or alongside it.
- Keep the UI focused on sandbox operation and proof, not production admin complexity.
- Show Hub health, selected app, plans, latest webhook status, subscription state, entitlement state, portal action, and reconciliation action.
- Allow one-click checkout session creation for the selected app/user/plan.
- Allow opening/copying the Stripe Checkout URL from the browser.
- Reduce required PowerShell use to starting background services only.
- Do not expose provider secrets or app tokens in browser code.

### Track 2 - Discovery and Boundary Mapping

- Read AIntern `docs/AINTERN_PROJECT_PLAN.md`, `docs/PROGRESS.md`, auth context, route structure, and entitlement migration.
- Identify the user identity value AIntern should pass as `user_ref`.
- Identify where billing UI should live.
- Identify which AIntern capabilities should become paid entitlements.

### Track 3 - Hub Registry Package for AIntern

- Create or update Hub registry files for AIntern.
- Define AIntern plans, plan keys, product mapping, and entitlements.
- Keep provider price IDs in the Hub registry only.
- Validate registry semantics with existing Hub tests.
- Record the provider account owner for AIntern.

### Track 4 - Provider Account Model

- Replace temporary `primary` provider account assumptions with named company/provider accounts.
- Add provider account configuration for Stripe sandbox credentials.
- Update app registry packages to point to named provider accounts.
- Keep webhook endpoints account-scoped.
- Validate that one app cannot accidentally use another company's provider account.

### Track 5 - Thin AIntern Payment Client

- Add a small AIntern-side client for Hub calls.
- Use environment variables for Hub base URL and app token.
- Keep the browser free of Hub secrets where possible; if a server or Supabase Edge proxy is required, define it explicitly.
- Do not import Stripe SDK into AIntern.

### Track 6 - Checkout and Portal Flow

- Add billing action for selected AIntern plan.
- Redirect only to Hub-created Stripe Checkout URL.
- Add billing portal action for existing customers or subscriptions.
- Handle return URLs as UX hints only, not entitlement proof.

### Track 7 - Entitlement Guard

- Read entitlement state from the Hub.
- Gate paid AIntern features from Hub entitlement state.
- Keep offline behavior safe: cached entitlement may improve UX, but cannot mint new paid access.

### Track 8 - Sandbox End-to-End Proof

- Run AIntern on port `4900`.
- Run Payment Hub on port `3017`.
- Run Stripe CLI listener to the Hub webhook endpoint.
- Complete checkout in Stripe test mode.
- Verify AIntern sees active entitlement through the Hub.
- Verify portal session creation.
- Verify cancellation/failure/replay behavior as applicable.
- Run reconciliation and confirm Hub state matches Stripe.

### Track 9 - Freeze Readiness

- Update AIntern docs for billing setup and local testing.
- Update Hub docs with AIntern-specific registry and proof notes.
- Run Hub checks.
- Run AIntern relevant checks.
- Record Phase 3 evidence before freezing.

## Non-Negotiable Guardrails

- AIntern must not accept or store provider price IDs as application-owned authority.
- AIntern must not process Stripe webhooks.
- AIntern must not grant entitlements from browser redirect success.
- AIntern must not mutate paid entitlements directly.
- Payment provider replacement must remain possible behind the Hub provider adapter.
- Each app must be mapped to the correct company/provider account in the Hub registry.
- One company's Stripe credentials must never be shared through another app's registry package.
- Live provider credentials must not be used until account isolation is implemented and verified.

## Immediate Checklist

- [x] Add Payment Hub local console UI to avoid PowerShell-only operation.
- [x] Console shows Hub health and active environment.
- [x] Console shows selected app and available plans from the Hub registry.
- [x] Console can create Checkout Session and open/copy Checkout URL.
- [x] Console can show latest webhook/subscription/entitlement proof.
- [x] Console can create Portal Session.
- [x] Console can trigger reconciliation.
- [x] Read AIntern `docs/AINTERN_PROJECT_PLAN.md`.
- [x] Read AIntern `docs/PROGRESS.md`.
- [x] Inspect AIntern auth context and route structure.
- [x] Inspect AIntern entitlement migration and current entitlement usage.
- [x] Decide the first paid AIntern plan and entitlement set.
- [x] Create AIntern Hub registry package.
- [x] Create Stripe sandbox Prices for `aintern_pass_3m` and `aintern_pass_6m`.
- [x] Activate AIntern registry plans after Stripe lookup keys were created.
- [x] Add local AIntern app token mapping to `.env.local`.
- [x] Smoke-test AIntern catalog and checkout through the Hub.
- [x] Add thin AIntern billing integration.
- [x] Define named provider account model for multi-company Stripe accounts.
- [x] Map AIntern to its company Stripe account instead of temporary `primary`.
- [ ] Validate actual AIntern browser checkout, webhook, entitlement, portal, and reconciliation flow.
## Track 4/5 Verification Notes

- Provider account router validates configured provider account before checkout, portal, webhook, or reconciliation.
- AIntern registry now maps to stripe:nhl_global_solution.
- Local .env.local contains named nhl_global_solution Stripe sandbox account variables copied from the existing sandbox credentials.
- AIntern thin client build passed and contains no Stripe SDK dependency.
