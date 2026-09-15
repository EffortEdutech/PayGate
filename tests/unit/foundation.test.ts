import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { CheckoutResult, PaymentProviderAdapter, PortalResult, ProviderCapabilities, ProviderSubscriptionSnapshot, ResolvedCheckoutCommand, ResolvedPortalCommand, ResolvedReconciliationCommand, VerifiedProviderEvent } from "@payment-hub/contracts";
import { Registry, RegistryError, StripeAdapterSkeleton, StripeSandboxAdapter, StaticTokenAppAuthenticator, assertAppAuthority, createPaymentHubHttpServer, hashIdempotentRequest, InMemoryPaymentRepository, PaymentHubService, providerLookupKeyFor, loadHubConfig, normalizeStripeEvent } from "../../payment-hub/src/index.js";

const app = {
  appId: "app_test",
  name: "Test",
  providerId: "stripe",
  providerAccount: "primary",
  origins: { test: new URL("https://test.example.com"), live: new URL("https://example.com") },
  returnContexts: { billing: { successPath: "/processing", cancelPath: "/pricing", portalPath: "/billing" } },
  plans: new Map([["growth_monthly", { planKey: "growth_monthly", name: "Growth", mode: "subscription" as const, amountMinor: 4900, currency: "USD" as const, interval: "month" as const, providerLookupKeys: { stripe: "app_test_growth_monthly" }, providerLiveLookupKeys: { stripe: "app_test_growth_monthly_live" }, entitlements: ["analytics.export"], status: "active" as const }]]),
  items: new Map([
    ["book:demo", { itemKey: "book:demo", name: "Demo Book", type: "single_cast" as const, amountMinor: 999, currency: "USD" as const, providerLookupKeys: { stripe: "app_test_book_demo" }, providerLiveLookupKeys: { stripe: "app_test_book_demo_live" }, entitlement: { key: "analytics.single_item", scope: { bookId: "demo" } }, status: "active" as const }],
    ["book:draft", { itemKey: "book:draft", name: "Draft Book", type: "single_cast" as const, amountMinor: 799, currency: "USD" as const, providerLookupKeys: { stripe: "app_test_book_draft" }, entitlement: { key: "analytics.single_item", scope: { bookId: "draft" } }, status: "draft" as const }],
  ]),
};

class FakeProvider implements PaymentProviderAdapter {
  readonly providerId = "stripe";
  lastCheckout?: ResolvedCheckoutCommand;
  capabilities(): ProviderCapabilities { return new StripeAdapterSkeleton().capabilities(); }
  async createCheckout(command: ResolvedCheckoutCommand): Promise<CheckoutResult> {
    this.lastCheckout = command;
    return { checkoutSessionId: "cs_test_123", redirectUrl: new URL("https://checkout.stripe.com/c/test"), status: "open", expiresAt: new Date("2026-08-26T12:00:00.000Z") };
  }
  async createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult> {
    return { portalSessionId: `bps_${command.providerCustomerRef}`, redirectUrl: new URL("https://billing.stripe.com/p/session") };
  }
  async verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: "test" | "live" }): Promise<VerifiedProviderEvent> {
    if (input.signature !== "valid") throw new Error("Invalid signature");
    return { providerId: "stripe", providerAccount: input.account, environment: input.environment, providerEventId: "evt_test_123", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_test_123" } } };
  }
  async reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> {
    return { providerId: "stripe", providerAccount: command.providerAccount, environment: command.environment, providerCustomerRef: command.providerCustomerRef, providerSubscriptionRef: "sub_test_123", observedAt: new Date("2026-08-26T12:00:00.000Z"), state: "active", planKey: "growth_monthly", currentPeriodEnd: new Date("2026-09-26T12:00:00.000Z"), evidence: { subscription_id: "sub_test_123", status: "active" } };
  }
}

test("Stripe adapter declares capabilities without performing live operations", () => {
  const adapter = new StripeAdapterSkeleton();
  assert.equal(adapter.providerId, "stripe");
  assert.equal(adapter.capabilities().hostedCheckout.supported, true);
});

test("registry resolves only approved return contexts", () => {
  const registry = new Registry([app]);
  assert.equal(registry.returnUrls("app_test", "test", "billing").success.href, "https://test.example.com/processing");
  assert.throws(() => registry.returnUrls("app_test", "test", "evil"), RegistryError);
});

test("authenticated application cannot claim another app_id", () => {
  assert.throws(() => assertAppAuthority({ appId: "app_a", subject: "svc", tokenId: "jti", expiresAt: new Date(Date.now() + 60_000) }, "app_b"));
});

test("idempotency request hash is deterministic", () => {
  assert.equal(hashIdempotentRequest({ a: 1 }), hashIdempotentRequest({ a: 1 }));
});

test("static token authenticator accepts only registered app tokens", async () => {
  const authenticator = new StaticTokenAppAuthenticator({ app_test: "secret" });
  assert.equal((await authenticator.authenticate("secret")).appId, "app_test");
  await assert.rejects(() => authenticator.authenticate("bad"));
});

test("checkout endpoint authenticates app and resolves registry-owned checkout fields", async () => {
  const provider = new FakeProvider();
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "idem_1" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", plan_key: "growth_monthly", return_context: "billing", provider_price_id: "price_attacker", provider_account: "attacker", amount_minor: 1, currency: "XXX" }),
    });
    assert.equal(response.status, 200);
    assert.equal(provider.lastCheckout?.providerLookupKey, "app_test_growth_monthly");
    assert.equal(provider.lastCheckout?.successUrl.href, "https://test.example.com/processing");
  } finally {
    server.close();
  }
});
test("item provider lookup resolution uses registry-owned test and live lookup keys", () => {
  const item = app.items.get("book:demo");
  assert.ok(item);
  assert.equal(providerLookupKeyFor(item, "stripe", "test"), "app_test_book_demo");
  assert.equal(providerLookupKeyFor(item, "stripe", "live"), "app_test_book_demo_live");
});

test("checkout endpoint recognizes active item_ref but blocks item checkout behind disabled gate", async () => {
  const provider = new FakeProvider();
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "idem_item_disabled" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", item_ref: "book:demo", return_context: "billing" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "ITEM_CHECKOUT_DISABLED");
    assert.equal(provider.lastCheckout, undefined);
  } finally {
    server.close();
  }
});
test("checkout endpoint creates sandbox item checkout only when allowlisted", async () => {
  const provider = new FakeProvider();
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider, { itemCheckoutTestAllowlist: ["app_test|book:demo"] }), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "idem_item_allowed" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", item_ref: "book:demo", return_context: "billing", amount_minor: 1, currency: "XXX", provider_price_id: "price_attacker" }),
    });
    assert.equal(response.status, 200);
    assert.equal(provider.lastCheckout?.itemRef, "book:demo");
    assert.equal(provider.lastCheckout?.itemEntitlementKey, "analytics.single_item");
    assert.deepEqual(provider.lastCheckout?.itemEntitlementScope, { bookId: "demo" });
    assert.equal(provider.lastCheckout?.providerLookupKey, "app_test_book_demo");
    assert.deepEqual(provider.lastCheckout?.money, { amountMinor: 999, currency: "USD" });
    assert.equal(provider.lastCheckout?.mode, "payment");
    assert.equal(provider.lastCheckout?.planKey, undefined);
  } finally {
    server.close();
  }
});

test("item checkout allowlist never enables live item checkout", async () => {
  const provider = new FakeProvider();
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider, { itemCheckoutTestAllowlist: ["app_test|book:demo"] }), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "idem_item_live_blocked" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", item_ref: "book:demo", return_context: "billing", environment: "live" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "ITEM_CHECKOUT_DISABLED");
    assert.equal(provider.lastCheckout, undefined);
  } finally {
    server.close();
  }
});
test("checkout endpoint rejects draft item_ref before provider execution", async () => {
  const provider = new FakeProvider();
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "idem_item_draft" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", item_ref: "book:draft", return_context: "billing" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "ITEM_NOT_AVAILABLE");
    assert.equal(provider.lastCheckout, undefined);
  } finally {
    server.close();
  }
});

test("live checkout resolution uses registry live lookup key only", async () => {
  const provider = new FakeProvider();
  const service = new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), provider);
  await service.createCheckout({ requestId: "req_live_lookup", appId: "app_test", userRef: "user_1", planKey: "growth_monthly", returnContext: "billing", environment: "live" });
  assert.equal(provider.lastCheckout?.providerLookupKey, "app_test_growth_monthly_live");
  assert.equal(provider.lastCheckout?.providerAccount, "primary");
  assert.deepEqual(provider.lastCheckout?.money, { amountMinor: 4900, currency: "USD" });
});
test("mutation endpoints require idempotency keys", async () => {
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), new FakeProvider()), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/checkout/sessions`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", plan_key: "growth_monthly", return_context: "billing" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "IDEMPOTENCY_KEY_REQUIRED");
  } finally {
    server.close();
  }
});

test("webhook route accepts raw body only after provider verification", async () => {
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), new InMemoryPaymentRepository(), new FakeProvider()), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/webhooks/stripe/primary/test`, { method: "POST", headers: { "stripe-signature": "valid" }, body: "{\"id\":\"evt_test_123\"}" });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { received: boolean }).received, true);
  } finally {
    server.close();
  }
});

test("Stripe sandbox adapter rejects live secret keys in Phase 2", () => {
  assert.throws(() => new StripeSandboxAdapter({ environment: "test", secretKey: "sk_live_123", webhookSecret: "whsec_123", apiVersion: "2026-02-25.clover" }));
});

test("project localhost port family is locked to 301#", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://payment_hub:change-me@localhost:5432/payment_hub",
    APP_AUTH_ISSUER: "https://payments.example.test",
    APP_AUTH_AUDIENCE: "payment-hub",
  };
  assert.equal(loadHubConfig(baseEnv).port, 3017);
  assert.equal(loadHubConfig({ ...baseEnv, PORT: "3010" }).port, 3010);
  assert.deepEqual(loadHubConfig({ ...baseEnv, PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST: "pagecast|book:a2020000-0000-4000-8000-000000000001" }).itemCheckoutTestAllowlist, ["pagecast|book:a2020000-0000-4000-8000-000000000001"]);
  assert.equal(loadHubConfig({ ...baseEnv, PORT: "3019" }).port, 3019);
  assert.throws(() => loadHubConfig({ ...baseEnv, PORT: "3000" }));
  assert.throws(() => loadHubConfig({ ...baseEnv, PORT: "3020" }));
});

test("reconciliation repairs subscription state using provider evidence", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.saveProviderCustomer({ appId: "app_test", userRef: "user_1", providerId: "stripe", providerAccount: "primary", environment: "test", providerCustomerRef: "cus_test_123" });
  const service = new PaymentHubService(new Registry([app]), repository, new FakeProvider());
  const result = await service.reconcile({ requestId: "req_test", appId: "app_test", userRef: "user_1", environment: "test" });
  assert.equal(result.status, "repaired");
  assert.deepEqual(await repository.currentSubscription("app_test", "user_1"), { appId: "app_test", userRef: "user_1", state: "active", planKey: "growth_monthly", currentPeriodEnd: new Date("2026-09-26T12:00:00.000Z") });
});

test("internal reconciliation endpoint is authenticated and idempotent", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.saveProviderCustomer({ appId: "app_test", userRef: "user_1", providerId: "stripe", providerAccount: "primary", environment: "test", providerCustomerRef: "cus_test_123" });
  const server = createPaymentHubHttpServer({ service: new PaymentHubService(new Registry([app]), repository, new FakeProvider()), authenticator: new StaticTokenAppAuthenticator({ app_test: "secret" }) });
  server.listen(0);
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/internal/reconciliation/run`, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", "idempotency-key": "recon_1" },
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { status: string }).status, "repaired");
  } finally {
    server.close();
  }
});

test("Stripe event normalization maps subscription and invoice events to Hub event types", () => {
  const active = normalizeStripeEvent({
    id: "evt_sub_active",
    created: 1787745600,
    type: "customer.subscription.updated",
    data: { object: { id: "sub_test_123", status: "trialing", customer: "cus_test_123", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_plan_key: "growth_monthly" }, items: { data: [{ current_period_end: 1790337600, price: { lookup_key: "growth_monthly" } }] } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(active.eventType, "subscription.trial");
  assert.equal(active.payload.subscriptionState, "trial");

  const failed = normalizeStripeEvent({
    id: "evt_invoice_failed",
    created: 1787745600,
    type: "invoice.payment_failed",
    data: { object: { id: "in_test_123", customer: "cus_test_123", subscription: "sub_test_123", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_plan_key: "growth_monthly" } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(failed.eventType, "invoice.payment_failed");
  assert.equal(failed.payload.subscriptionState, "past_due");
});


test("Stripe event normalization maps item metadata to item entitlement evidence", () => {
  const itemEvent = normalizeStripeEvent({
    id: "evt_item_paid",
    created: 1787745600,
    type: "checkout.session.completed",
    data: { object: { id: "cs_item_123", customer: "cus_test_123", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_item_ref: "book:demo", cph_item_entitlement_key: "app_test.book.unlock", cph_item_entitlement_scope: JSON.stringify({ bookId: "demo" }) } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(itemEvent.payload.itemRef, "book:demo");
  assert.equal(itemEvent.payload.itemEntitlementKey, "app_test.book.unlock");
  assert.deepEqual(itemEvent.payload.itemEntitlementScope, { bookId: "demo" });
  assert.equal(itemEvent.payload.planKey, undefined);
});

test("verified payment failure revokes projected plan entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_failed", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "invoice.payment_failed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "past_due", rawType: "invoice.payment_failed", evidence: { id: "in_test_123" } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "plan:growth_monthly", state: "revoked" }] });
});

test("Stripe refund and dispute events normalize to safe Hub outcomes", () => {
  const fullRefund = normalizeStripeEvent({
    id: "evt_refund_full",
    created: 1787745600,
    type: "charge.refunded",
    data: { object: { id: "ch_full", amount: 3900, amount_refunded: 3900, refunded: true, customer: "cus_test_123", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_plan_key: "growth_monthly" } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(fullRefund.eventType, "refund.full");
  assert.equal(fullRefund.payload.subscriptionState, "cancelled");

  const partialRefund = normalizeStripeEvent({
    id: "evt_refund_partial",
    created: 1787745600,
    type: "charge.refunded",
    data: { object: { id: "ch_partial", amount: 3900, amount_refunded: 1000, refunded: false, customer: "cus_test_123", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_plan_key: "growth_monthly" } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(partialRefund.eventType, "refund.partial");
  assert.equal(partialRefund.payload.subscriptionState, undefined);

  const dispute = normalizeStripeEvent({
    id: "evt_dispute",
    created: 1787745600,
    type: "charge.dispute.created",
    data: { object: { id: "dp_test", charge: "ch_full", metadata: { cph_app_id: "app_test", cph_user_ref: "user_1", cph_plan_key: "growth_monthly" } } },
  } as never, { providerAccount: "primary", environment: "test" });
  assert.equal(dispute.eventType, "dispute.opened");
  assert.equal(dispute.payload.subscriptionState, "cancelled");
});


test("verified item checkout event projects scoped item entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_item_paid", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", itemRef: "book:demo", itemEntitlementKey: "app_test.book.unlock", itemEntitlementScope: { bookId: "demo" }, providerCustomerRef: "cus_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_item_123" } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "app_test.book.unlock", state: "active", scope: { bookId: "demo" } }] });
});

test("verified full refund revokes scoped item entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_item_paid", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", itemRef: "book:demo", itemEntitlementKey: "app_test.book.unlock", itemEntitlementScope: { bookId: "demo" }, providerCustomerRef: "cus_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_item_123" } } });
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_item_refund", providerCreatedAt: new Date("2026-08-27T12:00:00.000Z"), eventType: "refund.full", payload: { appId: "app_test", userRef: "user_1", itemRef: "book:demo", itemEntitlementKey: "app_test.book.unlock", itemEntitlementScope: { bookId: "demo" }, providerCustomerRef: "cus_test_123", subscriptionState: "cancelled", rawType: "charge.refunded", evidence: { id: "ch_item_123" } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "app_test.book.unlock", state: "revoked", scope: { bookId: "demo" } }] });
});

test("verified partial refund records event without revoking entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_paid", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_test_123" } } });
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_partial_refund", providerCreatedAt: new Date("2026-08-27T12:00:00.000Z"), eventType: "refund.partial", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", rawType: "charge.refunded", evidence: { id: "ch_test_123", amount_refunded: 1000, amount: 3900 } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "plan:growth_monthly", state: "active" }] });
});

test("verified full refund revokes projected plan entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_paid", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_test_123" } } });
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_full_refund", providerCreatedAt: new Date("2026-08-27T12:00:00.000Z"), eventType: "refund.full", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", subscriptionState: "cancelled", rawType: "charge.refunded", evidence: { id: "ch_test_123", amount_refunded: 3900, amount: 3900 } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "plan:growth_monthly", state: "revoked" }] });
});