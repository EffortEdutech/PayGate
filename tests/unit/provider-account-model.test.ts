import assert from "node:assert/strict";
import { test } from "node:test";
import type { CheckoutResult, PaymentProviderAdapter, PortalResult, ProviderCapabilities, ProviderSubscriptionSnapshot, ResolvedCheckoutCommand, ResolvedPortalCommand, ResolvedReconciliationCommand, VerifiedProviderEvent } from "@payment-hub/contracts";
import { envNameForProviderAccount, loadHubConfig } from "../../payment-hub/src/config.js";
import { InMemoryPaymentRepository, PaymentHubService, Registry } from "../../payment-hub/src/index.js";
import { ProviderAccountNotConfiguredError, ProviderAccountRouter } from "../../payment-hub/src/providers/provider-account-router.js";
import { StripeAdapterSkeleton, StripeLiveAdapterNotImplemented, StripeSandboxAdapter } from "../../payment-hub/src/providers/stripe/stripe-adapter.js";


const accountAApp = {
  appId: "account_a_app",
  name: "Account A App",
  providerId: "stripe",
  providerAccount: "nhl_global_solution",
  origins: { test: new URL("https://account-a.example.test"), live: new URL("https://account-a.example.com") },
  returnContexts: { billing: { successPath: "/success", cancelPath: "/cancel", portalPath: "/billing" } },
  plans: new Map([["pass", { planKey: "pass", name: "Pass", mode: "payment" as const, amountMinor: 3900, currency: "MYR" as const, providerLookupKeys: { stripe: "account_a_pass" }, entitlements: ["account_a.access"], status: "active" as const }]]),
};

const accountBApp = {
  ...accountAApp,
  appId: "account_b_app",
  name: "Account B App",
  providerAccount: "bina_jaya",
  origins: { test: new URL("https://account-b.example.test"), live: new URL("https://account-b.example.com") },
  plans: new Map([["pass", { planKey: "pass", name: "Pass", mode: "payment" as const, amountMinor: 5900, currency: "MYR" as const, providerLookupKeys: { stripe: "account_b_pass" }, entitlements: ["account_b.access"], status: "active" as const }]]),
};

class RecordingAccountAdapter implements PaymentProviderAdapter {
  readonly providerId = "stripe";
  readonly calls: Array<{ readonly operation: string; readonly account: string; readonly appId?: string; readonly userRef?: string }> = [];

  constructor(private readonly account: string) {}

  capabilities(): ProviderCapabilities { return new StripeAdapterSkeleton().capabilities(); }

  async createCheckout(command: ResolvedCheckoutCommand): Promise<CheckoutResult> {
    this.calls.push({ operation: "checkout", account: this.account, appId: command.appId, userRef: command.userRef });
    return { checkoutSessionId: `cs_${this.account}`, redirectUrl: new URL(`https://checkout.example.test/${this.account}`), status: "open", expiresAt: new Date("2026-09-06T12:00:00.000Z"), providerCustomerRef: `cus_${this.account}` };
  }

  async createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult> {
    this.calls.push({ operation: "portal", account: this.account, appId: command.appId, userRef: command.userRef });
    return { portalSessionId: `bps_${this.account}`, redirectUrl: new URL(`https://billing.example.test/${this.account}`) };
  }

  async verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: "test" | "live" }): Promise<VerifiedProviderEvent> {
    this.calls.push({ operation: "webhook", account: this.account });
    return { providerId: "stripe", providerAccount: input.account, environment: input.environment, providerEventId: `evt_${this.account}`, providerCreatedAt: new Date("2026-09-06T12:00:00.000Z"), eventType: "checkout.completed", payload: { appId: this.account === "nhl_global_solution" ? "account_a_app" : "account_b_app", userRef: "user_1", planKey: "pass", providerCustomerRef: `cus_${this.account}`, subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: `cs_${this.account}` } } };
  }

  async reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> {
    this.calls.push({ operation: "reconciliation", account: this.account, appId: command.appId, userRef: command.userRef });
    return { providerId: "stripe", providerAccount: command.providerAccount, environment: command.environment, providerCustomerRef: command.providerCustomerRef, providerSubscriptionRef: `sub_${this.account}`, observedAt: new Date("2026-09-06T12:00:00.000Z"), state: "active", planKey: "pass", evidence: { account: this.account } };
  }
}

test("provider account env names are deterministic and company scoped", () => {
  assert.equal(envNameForProviderAccount("nhl_global_solution", "SECRET_KEY"), "STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY");
  assert.equal(envNameForProviderAccount("bina-jaya", "WEBHOOK_SECRET"), "STRIPE_ACCOUNT_BINA_JAYA_WEBHOOK_SECRET");
});

test("legacy stripe credentials create primary and nhl_global_solution sandbox aliases", () => {
  const config = loadHubConfig({
    NODE_ENV: "development",
    PORT: "3017",
    DATABASE_URL: "postgresql://example",
    APP_AUTH_ISSUER: "issuer",
    APP_AUTH_AUDIENCE: "audience",
    APP_AUTH_TOKENS: "aintern:token",
    STRIPE_SECRET_KEY: "sk_test_legacy",
    STRIPE_WEBHOOK_SECRET: "whsec_legacy",
  });
  assert.deepEqual(config.stripeAccounts.map((account) => account.account), ["nhl_global_solution", "primary"]);
});

test("named stripe account credentials are parsed without cross-company fallback", () => {
  const config = loadHubConfig({
    NODE_ENV: "development",
    PORT: "3017",
    DATABASE_URL: "postgresql://example",
    APP_AUTH_ISSUER: "issuer",
    APP_AUTH_AUDIENCE: "audience",
    STRIPE_ACCOUNTS: "nhl_global_solution,bina_jaya",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY: "sk_test_nhl",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET: "whsec_nhl",
  });
  assert.deepEqual(config.stripeAccounts.map((account) => account.account), ["nhl_global_solution"]);
});

test("provider account router fails safely for unknown accounts", async () => {
  const router = new ProviderAccountRouter("stripe", new Map([["nhl_global_solution", new StripeAdapterSkeleton()]]));
  assert.throws(
    () => router.createCheckout({} as never),
    (error) => error instanceof ProviderAccountNotConfiguredError && error.providerAccount === undefined,
  );
  assert.throws(() => router.verifyWebhook({ rawBody: new Uint8Array(), signature: "sig", account: "bina_jaya", environment: "test" }), ProviderAccountNotConfiguredError);
});
test("provider account router routes checkout, webhook, portal, and reconciliation to the declared account only", async () => {
  const nhl = new RecordingAccountAdapter("nhl_global_solution");
  const bina = new RecordingAccountAdapter("bina_jaya");
  const router = new ProviderAccountRouter("stripe", new Map([["nhl_global_solution", nhl], ["bina_jaya", bina]]));
  const repository = new InMemoryPaymentRepository();
  const service = new PaymentHubService(new Registry([accountAApp, accountBApp]), repository, router);

  await service.createCheckout({ requestId: "req_a_checkout", appId: "account_a_app", userRef: "user_1", planKey: "pass", returnContext: "billing", environment: "test" });
  await service.createCheckout({ requestId: "req_b_checkout", appId: "account_b_app", userRef: "user_1", planKey: "pass", returnContext: "billing", environment: "test" });
  await service.acceptWebhook({ rawBody: Buffer.from("{}"), signature: "valid", providerAccount: "nhl_global_solution", environment: "test" });
  await service.acceptWebhook({ rawBody: Buffer.from("{}"), signature: "valid", providerAccount: "bina_jaya", environment: "test" });
  await service.createPortal({ requestId: "req_a_portal", appId: "account_a_app", userRef: "user_1", returnContext: "billing", environment: "test" });
  await service.createPortal({ requestId: "req_b_portal", appId: "account_b_app", userRef: "user_1", returnContext: "billing", environment: "test" });
  await service.reconcile({ requestId: "req_a_reconcile", appId: "account_a_app", userRef: "user_1", environment: "test" });
  await service.reconcile({ requestId: "req_b_reconcile", appId: "account_b_app", userRef: "user_1", environment: "test" });

  assert.deepEqual(nhl.calls.map((call) => call.operation), ["checkout", "webhook", "portal", "reconciliation"]);
  assert.deepEqual(bina.calls.map((call) => call.operation), ["checkout", "webhook", "portal", "reconciliation"]);
  assert.ok(nhl.calls.every((call) => call.account === "nhl_global_solution"));
  assert.ok(bina.calls.every((call) => call.account === "bina_jaya"));
});

test("provider customer mappings are isolated by provider account and environment", async () => {
  const repository = new InMemoryPaymentRepository();
  await repository.saveProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "nhl_global_solution", environment: "test", providerCustomerRef: "cus_nhl_test" });
  await repository.saveProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "bina_jaya", environment: "test", providerCustomerRef: "cus_bina_test" });
  await repository.saveProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "nhl_global_solution", environment: "live", providerCustomerRef: "cus_nhl_live" });

  assert.equal(await repository.findProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "nhl_global_solution", environment: "test" }), "cus_nhl_test");
  assert.equal(await repository.findProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "bina_jaya", environment: "test" }), "cus_bina_test");
  assert.equal(await repository.findProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "nhl_global_solution", environment: "live" }), "cus_nhl_live");
  assert.equal(await repository.findProviderCustomer({ appId: "account_a_app", userRef: "user_1", providerId: "stripe", providerAccount: "unknown_company", environment: "test" }), undefined);
});
test("current Stripe adapter blocks live credentials until an explicit live-mode implementation exists", () => {
  assert.throws(
    () => new StripeSandboxAdapter({ environment: "test", secretKey: "sk_live_not_allowed", webhookSecret: "whsec_live_placeholder", apiVersion: "2026-07-29.dahlia" }),
    /sandbox secret key/,
  );
});
test("live Stripe boundary accepts only live keys but exposes no runtime operations yet", async () => {
  const adapter = new StripeLiveAdapterNotImplemented({ environment: "live", secretKey: "sk_live_boundary_only", webhookSecret: "whsec_live_placeholder", apiVersion: "2026-07-29.dahlia" });
  assert.equal(adapter.providerId, "stripe");
  assert.throws(
    () => new StripeLiveAdapterNotImplemented({ environment: "live", secretKey: "sk_test_not_live", webhookSecret: "whsec_test_placeholder", apiVersion: "2026-07-29.dahlia" }),
    /live secret key/,
  );
  await assert.rejects(
    () => adapter.createCheckout({} as never),
    /Stripe runtime operations are not configured/,
  );
});
