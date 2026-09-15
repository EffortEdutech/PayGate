import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "../../scripts/registry-validation.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("canonical registry passes structural and semantic validation", async () => {
  const result = await validateRegistry(rootDir);
  assert.equal(result.appCount, 3);
  assert.deepEqual(result.errors, []);
});


test("registry validation rejects duplicate effective live lookup keys", async () => {
  const tempRoot = path.join(tmpdir(), `paygate-registry-${Date.now()}`);
  const appDir = path.join(tempRoot, "registry", "apps", "app_live_test");
  await mkdir(appDir, { recursive: true });
  await mkdir(path.join(tempRoot, "registry", "schemas"), { recursive: true });

  const schemaDir = path.join(rootDir, "registry", "schemas");
  for (const file of ["app.schema.json", "plans.schema.json", "entitlements.schema.json", "integration.schema.json", "files-manifest.schema.json", "items.schema.json"]) {
    await writeFile(path.join(tempRoot, "registry", "schemas", file), await readFile(path.join(schemaDir, file)));
  }

  await writeFile(path.join(appDir, "app.yaml"), `schema_version: "1.0"
app_id: app_live_test
name: Live Test
provider:
  type: stripe
  account: nhl_global_solution
application_urls:
  test: https://app-live-test.vercel.app/
  live: https://app-live-test.example.com/
`);
  await writeFile(path.join(appDir, "plans.yaml"), `schema_version: "1.0"
plans:
  - plan_key: pass_a
    name: Pass A
    type: one_time
    pricing:
      currency: MYR
      unit_amount_minor: 3900
    provider:
      stripe:
        lookup_key: pass_a_test
        live_lookup_key: shared_live_key
    entitlement_bundle:
      - app_live_test.access
    status: active
  - plan_key: pass_b
    name: Pass B
    type: one_time
    pricing:
      currency: MYR
      unit_amount_minor: 5900
    provider:
      stripe:
        lookup_key: pass_b_test
        live_lookup_key: shared_live_key
    entitlement_bundle:
      - app_live_test.access
    status: active
`);
  await writeFile(path.join(appDir, "entitlements.yaml"), `schema_version: "1.0"
entitlements:
  - key: app_live_test.access
    description: Access
`);
  await writeFile(path.join(appDir, "integration.yaml"), `schema_version: "1.0"
return_contexts:
  billing:
    success_path: /profile?billing=success
    cancel_path: /profile?billing=cancel
    portal_path: /profile?billing=portal_return
`);
  await writeFile(path.join(appDir, "files.manifest.yaml"), `schema_version: "1.0"
app_id: app_live_test
allowed_paths:
  - src/payment/**
`);
  await writeFile(path.join(appDir, "env.example"), "PAYMENT_HUB_URL=https://pay-gate-beta.vercel.app\n");
  await writeFile(path.join(appDir, "integration-status.md"), "# Integration status\n");

  const result = await validateRegistry(tempRoot);
  assert.equal(result.appCount, 1);
  assert.match(result.errors.join("\n"), /stripe:live:shared_live_key/);
});

test("pageCast item registry loads controlled sandbox item definition while checkout remains gated", async () => {
  const runtime = await import("../../payment-hub/src/runtime/runtime.js");
  const hub = await runtime.createInMemoryPaymentHubRuntime({
    APP_AUTH_TOKENS: "pagecast:test-token",
    STRIPE_ACCOUNTS: "nhl_global_solution",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY: "sk_test_placeholder",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET: "whsec_placeholder",
    APP_AUTH_ISSUER: "https://pay-gate-beta.vercel.app",
    APP_AUTH_AUDIENCE: "payment-hub",
    PAYMENT_HUB_CORS_ALLOW_ORIGIN: "https://pagecast-nine.vercel.app",
    DATABASE_URL: "postgresql://payment_hub:change-me@localhost:5438/payment_hub",
  }, rootDir);

  const app = hub.service["registry"].application("pagecast");
  assert.equal(app.items.size, 2);

  const item = hub.service["registry"].item("pagecast", "book:a2020000-0000-4000-8000-000000000001");
  assert.equal(item.status, "active");
  assert.equal(item.amountMinor, 999);
  assert.equal(item.currency, "USD");
  assert.equal(item.entitlement.key, "pagecast.single_cast_unlock");
  assert.equal(item.entitlement.scope.bookId, "a2020000-0000-4000-8000-000000000001");

  assert.equal(hub.service["registry"].activeItem("pagecast", "book:a2020000-0000-4000-8000-000000000001").itemKey, item.itemKey);
});