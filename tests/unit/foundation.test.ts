import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { CheckoutResult, PaymentProviderAdapter, PortalResult, ProviderCapabilities, ProviderSubscriptionSnapshot, ResolvedCheckoutCommand, ResolvedPortalCommand, ResolvedReconciliationCommand, VerifiedProviderEvent } from "@payment-hub/contracts";
import { Registry, RegistryError, StripeAdapterSkeleton, StripeSandboxAdapter, StaticTokenAppAuthenticator, assertAppAuthority, createPaymentHubHttpServer, hashIdempotentRequest, InMemoryPaymentRepository, PaymentHubService, loadHubConfig, normalizeStripeEvent } from "../../payment-hub/src/index.js";

const app = {
  appId: "app_test",
  name: "Test",
  providerId: "stripe",
  providerAccount: "primary",
  origins: { test: new URL("https://test.example.com"), live: new URL("https://example.com") },
  returnContexts: { billing: { successPath: "/processing", cancelPath: "/pricing", portalPath: "/billing" } },
  plans: new Map([["growth_monthly", { planKey: "growth_monthly", name: "Growth", mode: "subscription" as const, amountMinor: 4900, currency: "USD" as const, interval: "month" as const, providerLookupKeys: { stripe: "app_test_growth_monthly" }, entitlements: ["analytics.export"], status: "active" as const }]]),
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
      body: JSON.stringify({ app_id: "app_test", user_ref: "user_1", plan_key: "growth_monthly", return_context: "billing" }),
    });
    assert.equal(response.status, 200);
    assert.equal(provider.lastCheckout?.providerLookupKey, "app_test_growth_monthly");
    assert.equal(provider.lastCheckout?.successUrl.href, "https://test.example.com/processing");
  } finally {
    server.close();
  }
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
  assert.throws(() => new StripeSandboxAdapter({ secretKey: "sk_live_123", webhookSecret: "whsec_123", apiVersion: "2026-02-25.clover" }));
});

test("project localhost port family is locked to 301#", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://payment_hub:change-me@localhost:5432/payment_hub",
    APP_AUTH_ISSUER: "https://payments.example.test",
    APP_AUTH_AUDIENCE: "payment-hub",
  };
  assert.equal(loadHubConfig(baseEnv).port, 3017);
  assert.equal(loadHubConfig({ ...baseEnv, PORT: "3010" }).port, 3010);
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

test("verified payment failure revokes projected plan entitlement", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.applyVerifiedEvent({ providerId: "stripe", providerAccount: "primary", environment: "test", providerEventId: "evt_failed", providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"), eventType: "invoice.payment_failed", payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "past_due", rawType: "invoice.payment_failed", evidence: { id: "in_test_123" } } });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "plan:growth_monthly", state: "revoked" }] });
});
