# Stripe Adapter V1 Specification

The Stripe adapter translates stable Hub commands into Stripe operations and Stripe events into normalized Hub events.

## V1 mappings

| Hub concept | Stripe concept |
|---|---|
| logical plan | Price resolved by registry `lookup_key` |
| hosted checkout | Checkout Session |
| billing management | Customer Portal Session |
| provider customer | Customer |
| recurring billing | Subscription and Invoice |

The adapter:

- uses an explicitly pinned Stripe API version;
- creates a new Checkout Session per payment attempt;
- passes deterministic idempotency keys for mutations;
- reads raw webhook bodies and verifies `Stripe-Signature`;
- stores minimal non-sensitive correlation metadata;
- retrieves current Stripe state when reconciliation is required;
- records safe reconciliation evidence from Checkout Sessions, Customers, Subscriptions, Invoices, PaymentIntents, Price lookup keys, and whitelisted `cph_*` metadata;
- classifies reconciliation mismatches without exposing raw Stripe SDK objects;
- never returns Stripe SDK objects to the core or applications.

Price IDs are runtime cache/mapping values. Registry configuration uses stable Stripe lookup keys.

No live Stripe operation is part of Phase 1. Live payment and refund testing requires the Phase 4 live-mode gate and explicit operator approval.
