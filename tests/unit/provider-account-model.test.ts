import assert from "node:assert/strict";
import { test } from "node:test";
import { envNameForProviderAccount, loadHubConfig } from "../../payment-hub/src/config.js";
import { ProviderAccountNotConfiguredError, ProviderAccountRouter } from "../../payment-hub/src/providers/provider-account-router.js";
import { StripeAdapterSkeleton } from "../../payment-hub/src/providers/stripe/stripe-adapter.js";

test("provider account env names are deterministic and company scoped", () => {
  assert.equal(envNameForProviderAccount("effort_edutech", "SECRET_KEY"), "STRIPE_ACCOUNT_EFFORT_EDUTECH_SECRET_KEY");
  assert.equal(envNameForProviderAccount("bina-jaya", "WEBHOOK_SECRET"), "STRIPE_ACCOUNT_BINA_JAYA_WEBHOOK_SECRET");
});

test("legacy stripe credentials create primary and effort_edutech sandbox aliases", () => {
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
  assert.deepEqual(config.stripeAccounts.map((account) => account.account), ["effort_edutech", "primary"]);
});

test("named stripe account credentials are parsed without cross-company fallback", () => {
  const config = loadHubConfig({
    NODE_ENV: "development",
    PORT: "3017",
    DATABASE_URL: "postgresql://example",
    APP_AUTH_ISSUER: "issuer",
    APP_AUTH_AUDIENCE: "audience",
    STRIPE_ACCOUNTS: "effort_edutech,bina_jaya",
    STRIPE_ACCOUNT_EFFORT_EDUTECH_SECRET_KEY: "sk_test_effort",
    STRIPE_ACCOUNT_EFFORT_EDUTECH_WEBHOOK_SECRET: "whsec_effort",
  });
  assert.deepEqual(config.stripeAccounts.map((account) => account.account), ["effort_edutech"]);
});

test("provider account router fails safely for unknown accounts", async () => {
  const router = new ProviderAccountRouter("stripe", new Map([["effort_edutech", new StripeAdapterSkeleton()]]));
  assert.throws(
    () => router.createCheckout({} as never),
    (error) => error instanceof ProviderAccountNotConfiguredError && error.providerAccount === undefined,
  );
  assert.throws(() => router.verifyWebhook({ rawBody: new Uint8Array(), signature: "sig", account: "bina_jaya", environment: "test" }), ProviderAccountNotConfiguredError);
});