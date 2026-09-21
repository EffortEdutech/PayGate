import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { applyRegistryProposal, generateRegistryProposal, registryApplyApprovalPhrase, writeDryRunProposal, type OnboardingArtifact } from "../../scripts/onboarding-registry-proposal.js";

function artifact(overrides: Partial<OnboardingArtifact> = {}): OnboardingArtifact {
  return {
    status: "draft_preview_only",
    non_mutating: true,
    package_path: "registry/apps/story_app",
    app: {
      app_id: "story_app",
      name: "Story App",
      owner: "Story Operator",
      support_owner: "Story Support",
      provider_id: "stripe",
      provider_account: "nhl_global_solution",
      auth_model: "supabase_jwt",
    },
    origins: { test: "https://story-app-test.vercel.app", live: "https://story-app.example.com" },
    return_contexts: ["billing", "cast"],
    auth_boundary: {
      model: "supabase_jwt",
      jwks_url: "https://story.supabase.co/auth/v1/.well-known/jwks.json",
      issuer: "https://story.supabase.co/auth/v1",
      audience: "authenticated",
    },
    plans: [{
      plan_key: "cast_pass_monthly",
      name: "Cast Pass Monthly",
      mode: "subscription",
      amount_minor: 1900,
      currency: "USD",
      interval: "month",
      provider_lookup_key: "story_app_cast_pass_monthly",
      entitlements: ["story_app.cast_pass", "story_app.premium_casts"],
    }],
    items: [{
      item_ref: "book:a2020000-0000-4000-8000-000000000001",
      name: "Single Cast Unlock",
      amount_minor: 999,
      currency: "USD",
      provider_lookup_key: "story_app_book_a2020000_single_unlock",
      entitlement_key: "story_app.single_cast_unlock",
      entitlement_scope: { book_id: "a2020000-0000-4000-8000-000000000001" },
    }],
    environment_variable_names: {
      sandbox_provider: ["STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY", "STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET"],
      app_auth: ["SUPABASE_JWT_STORY_APP_JWKS_URL", "SUPABASE_JWT_STORY_APP_ISSUER", "SUPABASE_JWT_STORY_APP_AUDIENCE"],
    },
    ...overrides,
  };
}

test("onboarding registry proposal dry-run maps artifact into reviewable registry files", () => {
  const proposal = generateRegistryProposal(artifact());

  assert.equal(proposal.status, "dry_run_only");
  assert.equal(proposal.targetDirectory, "registry/apps/story_app");
  assert.deepEqual(proposal.blockedReasons, []);
  assert.deepEqual(proposal.files.map((file) => file.relativePath), [
    "registry/apps/story_app/app.yaml",
    "registry/apps/story_app/plans.yaml",
    "registry/apps/story_app/entitlements.yaml",
    "registry/apps/story_app/items.yaml",
    "registry/apps/story_app/integration.yaml",
    "registry/apps/story_app/files.manifest.yaml",
    "registry/apps/story_app/env.example",
    "registry/apps/story_app/integration-status.md",
  ]);

  const appYaml = parse(proposal.files.find((file) => file.relativePath.endsWith("app.yaml"))?.content ?? "") as { app_id: string; status: string; provider: { account: string } };
  assert.equal(appYaml.app_id, "story_app");
  assert.equal(appYaml.status, "draft");
  assert.equal(appYaml.provider.account, "nhl_global_solution");

  const plansYaml = parse(proposal.files.find((file) => file.relativePath.endsWith("plans.yaml"))?.content ?? "") as { plans: Array<{ type: string; pricing: { interval: string }; provider: { stripe: { lookup_key: string } } }> };
  assert.equal(plansYaml.plans[0]?.type, "subscription");
  assert.equal(plansYaml.plans[0]?.pricing.interval, "month");
  assert.equal(plansYaml.plans[0]?.provider.stripe.lookup_key, "story_app_cast_pass_monthly");

  const envExample = proposal.files.find((file) => file.relativePath.endsWith("env.example"))?.content ?? "";
  assert.match(envExample, /STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY=<server-side-only>/);
  assert.doesNotMatch(envExample, /sk_test_|sk_live_|whsec_/);
});

test("onboarding registry proposal refuses secret-looking artifact values", () => {
  const proposal = generateRegistryProposal(artifact({ environment_variable_names: { bad: ["sk_test_should_not_be_here"] } }));
  assert.match(proposal.blockedReasons.join("\n"), /secret-looking/);
});

test("onboarding registry proposal dry-run does not write registry by default and can write separate review output", async () => {
  const before = existsSync(path.join("registry", "apps", "story_app"));
  assert.equal(before, false);

  const proposal = generateRegistryProposal(artifact());
  assert.equal(existsSync(path.join("registry", "apps", "story_app")), false);

  const outDir = await mkdtemp(path.join(tmpdir(), "paygate-proposal-"));
  try {
    await writeDryRunProposal(proposal, outDir);
    const generated = await readFile(path.join(outDir, "registry", "apps", "story_app", "app.yaml"), "utf8");
    assert.match(generated, /app_id: story_app/);
    assert.equal(existsSync(path.join("registry", "apps", "story_app")), false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("onboarding registry proposal refuses dry-run output inside registry", async () => {
  const proposal = generateRegistryProposal(artifact());
  await assert.rejects(() => writeDryRunProposal(proposal, path.join("registry", "proposal-review")), /Refusing to write dry-run proposal inside registry/);
});

test("onboarding registry proposal apply requires exact operator approval phrase", async () => {
  const proposal = generateRegistryProposal(artifact());
  const tempRoot = await mkdtemp(path.join(tmpdir(), "paygate-apply-gate-"));
  try {
    await assert.rejects(
      () => applyRegistryProposal(proposal, { rootDir: tempRoot, approvalPhrase: "yes please" }),
      /Approval phrase mismatch/,
    );
    assert.equal(existsSync(path.join(tempRoot, "registry", "apps", "story_app")), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("onboarding registry proposal apply writes only after approval and reports required checks", async () => {
  const proposal = generateRegistryProposal(artifact());
  const tempRoot = await mkdtemp(path.join(tmpdir(), "paygate-apply-approved-"));
  try {
    const result = await applyRegistryProposal(proposal, {
      rootDir: tempRoot,
      approvalPhrase: registryApplyApprovalPhrase("story_app"),
    });

    assert.equal(result.status, "applied_to_working_tree");
    assert.equal(result.targetDirectory, "registry/apps/story_app");
    assert.deepEqual(result.requiredValidationCommands, ["npm run validate:registry", "npm run check"]);
    assert.ok(result.filesWritten.includes("registry/apps/story_app/app.yaml"));
    assert.match(await readFile(path.join(tempRoot, "registry", "apps", "story_app", "app.yaml"), "utf8"), /app_id: story_app/);

    await assert.rejects(
      () => applyRegistryProposal(proposal, { rootDir: tempRoot, approvalPhrase: registryApplyApprovalPhrase("story_app") }),
      /already exists/,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});