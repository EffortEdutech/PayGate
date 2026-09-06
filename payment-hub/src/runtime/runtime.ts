import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { Currency } from "@payment-hub/types";
import { loadHubConfig, type HubConfig } from "../config.js";
import { createPgPool } from "../persistence/postgres.js";
import { InMemoryPaymentRepository } from "../persistence/in-memory-repository.js";
import { PostgresIdempotencyLedger } from "../persistence/postgres-idempotency-ledger.js";
import { PostgresPaymentRepository } from "../persistence/postgres-repository.js";
import { Registry } from "../registry/registry.js";
import type { RegisteredApplication, RegisteredPlan } from "../registry/types.js";
import { CompositeAppAuthenticator, StaticTokenAppAuthenticator, SupabaseHs256JwtAppAuthenticator, type AppAuthenticator } from "../security/app-authentication.js";
import type { IdempotencyLedger } from "../security/idempotency.js";
import { PaymentHubService } from "../services/payment-hub-service.js";
import type { PaymentProviderAdapter } from "@payment-hub/contracts";
import { ProviderAccountRouter } from "../providers/provider-account-router.js";
import { StripeAdapterSkeleton, StripeLiveWebhookAdapter, StripeSandboxAdapter } from "../providers/stripe/stripe-adapter.js";

export interface PaymentHubRuntime {
  readonly config: HubConfig;
  readonly service: PaymentHubService;
  readonly authenticator: AppAuthenticator;
  readonly idempotencyLedger?: IdempotencyLedger;
}

export async function createInMemoryPaymentHubRuntime(env: NodeJS.ProcessEnv, repoRoot: string): Promise<PaymentHubRuntime> {
  const config = loadHubConfig(env);
  const registry = await loadRegistry(path.join(repoRoot, "registry", "apps"));
  const provider = createProvider(config);
  return {
    config,
    service: new PaymentHubService(registry, new InMemoryPaymentRepository(), provider),
    authenticator: createAuthenticator(config),
  };
}

export async function createPostgresPaymentHubRuntime(env: NodeJS.ProcessEnv, repoRoot: string): Promise<PaymentHubRuntime> {
  const config = loadHubConfig(env);
  const registry = await loadRegistry(path.join(repoRoot, "registry", "apps"));
  const provider = createProvider(config);
  const pool = createPgPool(config.databaseUrl);
  return {
    config,
    service: new PaymentHubService(registry, new PostgresPaymentRepository(pool), provider),
    authenticator: createAuthenticator(config),
    idempotencyLedger: new PostgresIdempotencyLedger(pool),
  };
}

function createAuthenticator(config: HubConfig): AppAuthenticator {
  const authenticators: AppAuthenticator[] = [new StaticTokenAppAuthenticator(config.appAuthTokens)];
  if (config.supabaseJwtAuth) authenticators.push(new SupabaseHs256JwtAppAuthenticator(config.supabaseJwtAuth));
  return new CompositeAppAuthenticator(authenticators);
}

function createProvider(config: HubConfig): PaymentProviderAdapter {
  return config.stripeAccounts.length > 0
    ? new ProviderAccountRouter("stripe", new Map(config.stripeAccounts.map((account) => [account.account, new StripeSandboxAdapter({ environment: "test", secretKey: account.secretKey, webhookSecret: account.webhookSecret, apiVersion: config.stripeApiVersion })])))
    : new StripeAdapterSkeleton();
}

async function loadRegistry(appsDir: string): Promise<Registry> {
  const apps: RegisteredApplication[] = [];
  for (const entry of (await readdir(appsDir)).sort()) {
    const appDir = path.join(appsDir, entry);
    if (!(await stat(appDir)).isDirectory()) continue;
    apps.push(await loadApplication(appDir));
  }
  return new Registry(apps);
}

async function loadApplication(appDir: string): Promise<RegisteredApplication> {
  const appDoc = parse(await readFile(path.join(appDir, "app.yaml"), "utf8")) as Record<string, unknown>;
  const plansDoc = parse(await readFile(path.join(appDir, "plans.yaml"), "utf8")) as { plans: Array<Record<string, unknown>> };
  const integrationDoc = parse(await readFile(path.join(appDir, "integration.yaml"), "utf8")) as Record<string, unknown>;
  const provider = appDoc.provider as { type: string; account: string };
  const applicationUrls = appDoc.application_urls as { test?: string; live?: string };
  const returnContexts = integrationDoc.return_contexts as Record<string, { success_path: string; cancel_path: string; portal_path: string }>;
  if (!applicationUrls.test || !applicationUrls.live) throw new Error("Registry app requires test and live application_urls");
  const plans = new Map<string, RegisteredPlan>();
  for (const rawPlan of plansDoc.plans) {
    const pricing = rawPlan.pricing as { unit_amount_minor: number; currency: string; interval?: "day" | "week" | "month" | "year" };
    const providers = rawPlan.provider as Record<string, { lookup_key: string; live_lookup_key?: string }>;
    const planKey = String(rawPlan.plan_key);
    const providerLiveLookupKeys = Object.fromEntries(Object.entries(providers).filter(([, value]) => value.live_lookup_key).map(([key, value]) => [key, value.live_lookup_key!]));
    plans.set(planKey, {
      planKey,
      name: String(rawPlan.name),
      mode: rawPlan.type === "one_time" ? "payment" : "subscription",
      amountMinor: pricing.unit_amount_minor,
      currency: pricing.currency.toUpperCase() as Currency,
      ...(pricing.interval ? { interval: pricing.interval } : {}),
      providerLookupKeys: Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, value.lookup_key])),
      ...(Object.keys(providerLiveLookupKeys).length > 0 ? { providerLiveLookupKeys } : {}),
      entitlements: rawPlan.entitlement_bundle as string[],
      status: rawPlan.status as "draft" | "active" | "archived",
    });
  }
  return {
    appId: String(appDoc.app_id),
    name: String(appDoc.name),
    providerId: provider.type,
    providerAccount: provider.account,
    origins: { test: new URL(applicationUrls.test), live: new URL(applicationUrls.live) },
    returnContexts: Object.fromEntries(Object.entries(returnContexts).map(([key, value]) => [key, { successPath: value.success_path, cancelPath: value.cancel_path, portalPath: value.portal_path }])),
    plans,
  };
}