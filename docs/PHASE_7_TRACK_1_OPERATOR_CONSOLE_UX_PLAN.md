# Phase 7 Track 1 - Operator Console UX Plan

Status: Track 1A first implementation slice built.
Parent sprint: `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`.
Date: 2026-09-08.

## Purpose

PayGate has proven the core payment path with AIntern. The next product risk is operator complexity: adding future apps should not require repeated PowerShell commands, manual JSON reading, or unsafe edits to payment authority files.

Track 1 defines the operator console experience before app #2 onboarding begins.

## Operator Objective

The operator should be able to answer these questions from the UI:

- Which apps are connected to PayGate?
- Which company or Stripe account handles each app?
- Which plans exist and which Stripe lookup keys are expected?
- Is sandbox ready?
- Is live ready?
- Are webhooks healthy?
- Are entitlements active for a user?
- Can I create checkout or portal proof safely?
- Did reconciliation find a mismatch?
- What is the next safe action?

## UI Principles

- Show status first, raw IDs second.
- Show sandbox and live side by side, never mixed.
- Show provider account alias, not secrets.
- Explain warnings in operator language.
- Make dangerous actions gated and explicit.
- Keep apps as PayGate consumers, not payment authorities.
- Prefer guided setup over free-form configuration.

## Minimum Console Navigation

```text
PayGate Operator Console
├─ Dashboard
├─ Apps
│  ├─ App detail
│  └─ App onboarding wizard
├─ Provider accounts
├─ Plans and prices
├─ Webhooks
├─ Customers and entitlements
├─ Portal and reconciliation
├─ Refunds and disputes
└─ Settings and readiness
```

## Screen Acceptance Checklist

### Dashboard

- [ ] Shows overall status: ok, warning, attention required, or blocked.
- [ ] Shows app count and provider account count.
- [ ] Shows failed webhook count.
- [ ] Shows failed/no-customer/no-subscription reconciliation count.
- [ ] Shows database readiness.
- [ ] Shows live-mode gate status.
- [ ] Links operator to the next unsafe/missing setup item.

### Apps

- [ ] Lists every app from the registry.
- [ ] Shows app ID, display name, provider account, sandbox URL, live URL, and onboarding status.
- [ ] Supports filtering by app ID.
- [ ] Shows whether the app has active plans.
- [ ] Shows whether the app has recent successful webhook evidence.

### App Detail

- [ ] Shows allowed origins and return contexts.
- [ ] Shows plan keys, display names, amounts, currency, mode, and entitlements.
- [ ] Shows provider account mapping.
- [ ] Shows sandbox/live readiness separately.
- [ ] Shows last checkout, webhook, entitlement, portal, and reconciliation evidence.

### App Onboarding Wizard

- [ ] Captures app ID and display name.
- [ ] Captures owner/operator.
- [ ] Captures sandbox and live URLs.
- [ ] Captures auth model.
- [ ] Captures provider account owner.
- [ ] Captures plan model: one-time, subscription, usage credits, or mixed.
- [ ] Captures plan keys, amounts, currency, lookup keys, and entitlements.
- [ ] Generates a reviewable registry change or checklist before activation.
- [ ] Requires registry validation before completion.

### Provider Accounts

- [ ] Lists configured provider aliases.
- [ ] Shows linked apps.
- [ ] Shows sandbox/live credential readiness without showing secret values.
- [ ] Shows webhook readiness.
- [ ] Shows isolation check result.

### Plans and Prices

- [ ] Shows PayGate-authoritative plan data.
- [ ] Shows expected Stripe lookup keys.
- [ ] Does not accept provider price IDs from apps.
- [ ] Flags missing lookup configuration.
- [ ] Flags amount/currency mismatch evidence when available.

### Webhooks

- [ ] Shows endpoint URL per provider account/environment.
- [ ] Shows latest processed event.
- [ ] Shows failed/retry/dead counts.
- [ ] Shows app/user mapping when available.
- [ ] Explains that only signed POST requests are valid.

### Customers and Entitlements

- [ ] Searches by app ID and user ref.
- [ ] Shows provider customer mapping per environment.
- [ ] Shows current PayGate subscription/pass state.
- [ ] Shows entitlement keys and active/revoked state.
- [ ] Shows source evidence for entitlement mutation.

### Portal and Reconciliation

- [ ] Creates portal sessions only when provider customer evidence exists.
- [ ] Runs reconciliation with idempotency.
- [ ] Shows provider account and environment before execution.
- [ ] Explains one-time payment plans may return `no_provider_subscription` while PayGate state remains active.
- [ ] Records reconciliation run ID.

### Refunds and Disputes

- [ ] Shows refund candidates safely.
- [ ] Requires operator approval before live refund execution.
- [ ] Shows whether refund is none, partial, or full.
- [ ] Shows entitlement effect before action.
- [ ] Does not execute deferred refunds.

### Settings and Readiness

- [ ] Shows safe runtime diagnostics.
- [ ] Shows deployment URL and expected domain.
- [ ] Shows configured auth issuer/audience presence.
- [ ] Shows JWKS URL host.
- [ ] Shows CORS origin host.
- [ ] Shows provider aliases and live enable flags.
- [ ] Does not reveal secrets.

## Build Recommendation

Start by improving the existing PayGate admin console rather than creating a separate large frontend immediately.

Reason:

- The current admin endpoints already expose safe summaries.
- It keeps the operator workflow close to the gateway.
- It avoids creating another app before the PayGate operator model is settled.
- A richer frontend can come later after the information architecture proves itself.

Recommended next implementation slice:

1. Improve `/admin` into a clearer dashboard.
2. Add app detail sections for AIntern.
3. Add provider account readiness cards.
4. Add guided app onboarding checklist screen.
5. Keep all mutation actions gated or read-only until explicitly planned.

## Track 1 Completion Gate

Track 1 can close when:

- [x] Operator console objective is documented.
- [x] Primary screens are defined.
- [x] Screen-level acceptance checklist is documented.
- [x] Safety boundaries are documented.
- [x] Recommended first implementation slice is documented.
- [x] Product roadmap graph is regenerated.
- [x] Project validation passes.
- [x] Changes are committed and pushed.

## Next Track After Close

Proceed to Phase 7 Track 1A or Track 2 depending on operator choice:

- Track 1A: Build the improved PayGate admin dashboard first.
- Track 2: Start app #2 intake and classification.

Recommended next action: Track 1A, because the operator UI will reduce friction and mistakes before app #2 onboarding.
## Track 1A Implementation Evidence

Date: 2026-09-08.

Implemented first read-only operator dashboard slice in `api/index.ts` for the deployed `/admin` route.

Included UI sections:

- Dashboard summary cards.
- Next Safe Action guidance.
- Apps and plans.
- Provider accounts.
- Customers and entitlements.
- Checkout sessions.
- Webhooks.
- Reconciliation.
- App onboarding checklist.
- Collapsed raw summary for support evidence.

Safety boundaries preserved:

- No Stripe secret, webhook secret, JWT secret, database password, or operator token is embedded in the console source.
- Operator token remains browser-tab memory only.
- Refund execution remains deferred and is not exposed as an action.
- The dashboard is read-only; it calls protected summary and monitoring endpoints only.
- Apps still remain PayGate consumers, not payment authorities.

Track 1A validation:

- [x] Registry validation passed.
- [x] Typecheck passed.
- [x] Unit tests passed.
- [x] Admin console shell test asserts operator UI sections exist.
- [x] Secret scan passed.
## Track 1A UX Correction - Operator Hierarchy

Date: 2026-09-08.

The first dashboard slice was corrected after operator review. The original visual hierarchy still behaved like a developer debug page: the hero consumed space, the connection controls were too prominent in the wrong way, and the dashboard treated every metric as equal.

Correction applied:

- Removed the large marketing-style hero block.
- Replaced it with a compact top bar.
- Kept the connection controls in a single full-width operator control strip.
- Moved operator guidance into one action panel above the metrics.
- Renamed the main metric area to Operational Snapshot.
- Grouped details into Apps/Plans/Provider Accounts, Customer Payment State, Evidence Trail, and App Onboarding Checklist.
- Kept Support JSON collapsed by default.

Design direction locked for the next UI work:

- First answer: is PayGate okay?
- Second answer: what should the operator do next?
- Third answer: what evidence supports that?
- Raw/debug data stays behind disclosure, not in the main path.