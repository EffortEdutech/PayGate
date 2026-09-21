import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";

export type OnboardingArtifact = {
  status?: string;
  non_mutating?: boolean;
  package_path?: string;
  app?: {
    app_id?: string;
    name?: string;
    owner?: string;
    support_owner?: string;
    provider_id?: string;
    provider_account?: string;
    auth_model?: string;
  };
  origins?: { test?: string; live?: string };
  return_contexts?: string[];
  auth_boundary?: { model?: string; jwks_url?: string; issuer?: string; audience?: string };
  plans?: Array<{
    plan_key?: string;
    name?: string;
    mode?: string;
    amount_minor?: number;
    currency?: string;
    interval?: string;
    provider_lookup_key?: string;
    entitlements?: string[];
  }>;
  items?: Array<{
    item_ref?: string;
    name?: string;
    status?: string;
    amount_minor?: number;
    currency?: string;
    provider_lookup_key?: string;
    entitlement_key?: string;
    entitlement_scope?: Record<string, unknown>;
  }>;
  environment_variable_names?: Record<string, string[]>;
  registry_proposal?: Record<string, unknown>;
};

export type ProposedRegistryFile = {
  relativePath: string;
  content: string;
};

export type RegistryProposal = {
  appId: string;
  status: "dry_run_only";
  targetDirectory: string;
  files: ProposedRegistryFile[];
  warnings: string[];
  blockedReasons: string[];
};

export type ApplyRegistryProposalOptions = {
  rootDir: string;
  approvalPhrase: string;
  allowExisting?: boolean;
};

export type ApplyRegistryProposalResult = {
  appId: string;
  status: "applied_to_working_tree";
  targetDirectory: string;
  filesWritten: string[];
  requiredValidationCommands: string[];
};

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{2,63}$/;
const LOOKUP_KEY = /^[a-z][a-z0-9_]{2,199}$/;
const SECRET_PATTERN = /(sk_live_|sk_test_|whsec_|rk_live_|rk_test_)/;

function yaml(value: unknown): string {
  return stringify(value, { lineWidth: 120 }).trimEnd() + "\n";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function requireString(value: unknown, label: string, blocked: string[]): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  blocked.push(`${label} is required`);
  return "";
}

function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function registryPlanType(mode: string | undefined): "one_time" | "subscription" {
  return mode === "subscription" ? "subscription" : "one_time";
}

function returnContextPaths(context: string): { success_path: string; cancel_path: string; portal_path: string } {
  if (context === "billing") return { success_path: "/billing?billing=success", cancel_path: "/billing?billing=cancelled", portal_path: "/billing?billing=portal_return" };
  return { success_path: `/${context}?billing=success`, cancel_path: `/${context}?billing=cancelled`, portal_path: `/${context}?billing=portal_return` };
}

function itemType(itemRef: string): "single_cast" | "cast_bundle" {
  return itemRef.startsWith("bundle:") ? "cast_bundle" : "single_cast";
}

function itemScope(itemRef: string, artifactScope: Record<string, unknown> | undefined): Record<string, unknown> {
  if (artifactScope && Object.keys(artifactScope).length > 0) {
    if (typeof artifactScope.book_id === "string" || typeof artifactScope.bundle_id === "string" || Array.isArray(artifactScope.book_ids)) return artifactScope;
    if (typeof artifactScope.item_ref === "string") return itemScope(String(artifactScope.item_ref), undefined);
  }
  if (itemRef.startsWith("book:")) return { book_id: itemRef.slice("book:".length) };
  if (itemRef.startsWith("bundle:")) return { bundle_id: itemRef.slice("bundle:".length) };
  return {};
}

function assertNoSecretContent(artifact: OnboardingArtifact, blocked: string[]): void {
  if (SECRET_PATTERN.test(JSON.stringify(artifact))) blocked.push("Artifact contains secret-looking values; dry-run proposal refused.");
}

function validateArtifactShape(artifact: OnboardingArtifact, blocked: string[], warnings: string[]): void {
  if (artifact.status !== "draft_preview_only") blocked.push("Artifact status must be draft_preview_only.");
  if (artifact.non_mutating !== true) blocked.push("Artifact must declare non_mutating: true.");
  const appId = artifact.app?.app_id ?? "";
  if (!SAFE_IDENTIFIER.test(appId)) blocked.push("app.app_id must be a safe registry identifier.");
  if (artifact.app?.provider_id && artifact.app.provider_id !== "stripe") warnings.push("Only Stripe provider proposals are currently productized.");
  if (!artifact.app?.provider_account || !/^[a-z][a-z0-9_-]{1,31}$/.test(artifact.app.provider_account)) blocked.push("app.provider_account must be a safe provider alias.");
  if (!artifact.origins?.test || !isHttpsUrl(artifact.origins.test)) blocked.push("origins.test must be a valid https URL.");
  if (!artifact.origins?.live || !isHttpsUrl(artifact.origins.live)) blocked.push("origins.live must be a valid https URL.");
  if (!Array.isArray(artifact.plans) || artifact.plans.length === 0) blocked.push("At least one plan is required.");
  for (const plan of artifact.plans ?? []) {
    if (!plan.plan_key || !/^[a-z][a-z0-9_]{1,63}$/.test(plan.plan_key)) blocked.push("Each plan requires a safe plan_key.");
    if (!Number.isInteger(plan.amount_minor) || Number(plan.amount_minor) <= 0) blocked.push(`Plan ${plan.plan_key ?? "<unknown>"} requires a positive integer amount_minor.`);
    if (!plan.currency || !/^[A-Z]{3}$/.test(plan.currency)) blocked.push(`Plan ${plan.plan_key ?? "<unknown>"} requires uppercase ISO currency.`);
    if (!plan.provider_lookup_key || !LOOKUP_KEY.test(plan.provider_lookup_key)) blocked.push(`Plan ${plan.plan_key ?? "<unknown>"} requires a Stripe lookup key, not a price ID.`);
    if (String(plan.provider_lookup_key ?? "").startsWith("price_")) blocked.push(`Plan ${plan.plan_key ?? "<unknown>"} uses a provider price ID; use lookup_key.`);
    if (!Array.isArray(plan.entitlements) || plan.entitlements.length === 0) blocked.push(`Plan ${plan.plan_key ?? "<unknown>"} requires at least one entitlement.`);
  }
}

export function generateRegistryProposal(artifact: OnboardingArtifact): RegistryProposal {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  assertNoSecretContent(artifact, blockedReasons);
  validateArtifactShape(artifact, blockedReasons, warnings);

  const appId = requireString(artifact.app?.app_id, "app.app_id", blockedReasons);
  const appName = requireString(artifact.app?.name, "app.name", blockedReasons);
  const providerAccount = requireString(artifact.app?.provider_account, "app.provider_account", blockedReasons);
  const testOrigin = requireString(artifact.origins?.test, "origins.test", blockedReasons);
  const liveOrigin = requireString(artifact.origins?.live, "origins.live", blockedReasons);
  const targetDirectory = `registry/apps/${appId}`;

  const plans = (artifact.plans ?? []).map((plan) => {
    const type = registryPlanType(plan.mode);
    const pricing: Record<string, unknown> = { currency: plan.currency, unit_amount_minor: plan.amount_minor };
    if (type === "subscription") pricing.interval = plan.interval ?? "month";
    return {
      plan_key: plan.plan_key,
      name: plan.name,
      type,
      pricing,
      provider: { stripe: { lookup_key: plan.provider_lookup_key } },
      entitlement_bundle: plan.entitlements ?? [],
      status: "draft",
    };
  });

  const itemInputs = (artifact.items ?? []).filter((item) => item.item_ref && item.provider_lookup_key);
  const items = itemInputs.map((item) => ({
    item_key: item.item_ref,
    name: item.name,
    type: itemType(String(item.item_ref)),
    pricing: { currency: item.currency ?? artifact.plans?.[0]?.currency ?? "MYR", unit_amount_minor: item.amount_minor },
    provider: { stripe: { lookup_key: item.provider_lookup_key } },
    entitlement: { key: item.entitlement_key, scope: itemScope(String(item.item_ref), item.entitlement_scope) },
    status: "draft",
  }));

  const entitlementKeys = unique([
    ...plans.flatMap((plan) => plan.entitlement_bundle as string[]),
    ...items.map((item) => item.entitlement.key as string),
  ]);

  const returnContexts = Object.fromEntries((artifact.return_contexts?.length ? artifact.return_contexts : ["billing"]).map((context) => [context, returnContextPaths(context)]));

  const envNames = artifact.environment_variable_names ?? {};
  const envLines = [
    `# ${appName} -> PayGate registry proposal dry-run`,
    "# Names only. Do not paste real secrets into this file.",
    "PAYMENT_HUB_BASE_URL=https://pay-gate-beta.vercel.app",
    `PAYMENT_HUB_APP_ID=${appId}`,
    "PAYMENT_HUB_ENVIRONMENT=test",
    "",
    "# Configure these server-side in PayGate/Vercel only:",
    ...unique(Object.values(envNames).flat()).map((name) => `# ${name}=<server-side-only>`),
    "",
  ];

  const files: ProposedRegistryFile[] = [
    { relativePath: `${targetDirectory}/app.yaml`, content: yaml({ schema_version: "1.0", app_id: appId, name: appName, status: "draft", provider: { type: "stripe", account: providerAccount }, billing: { enabled: true }, application_urls: { test: testOrigin, live: liveOrigin }, identity: { user_reference: "supabase_user_id" } }) },
    { relativePath: `${targetDirectory}/plans.yaml`, content: yaml({ schema_version: "1.0", plans }) },
    { relativePath: `${targetDirectory}/entitlements.yaml`, content: yaml({ schema_version: "1.0", entitlements: entitlementKeys.map((key) => ({ key, description: `Draft entitlement for ${key}. Operator must review before activation.` })) }) },
    { relativePath: `${targetDirectory}/integration.yaml`, content: yaml({ schema_version: "1.0", authentication: "jwt", features: { checkout: true, subscriptions: plans.some((plan) => plan.type === "subscription"), customer_portal: true, entitlements: true }, return_contexts: returnContexts }) },
    { relativePath: `${targetDirectory}/files.manifest.yaml`, content: yaml({ schema_version: "1.0", app_id: appId, repository: { path: "<APP_REPOSITORY_PATH>" }, integration_files: { create: [], modify: [], verify: [] } }) },
    { relativePath: `${targetDirectory}/env.example`, content: envLines.join("\n") },
    { relativePath: `${targetDirectory}/integration-status.md`, content: `# ${appName} PayGate integration status\n\nStatus: draft proposal generated from onboarding artifact.\n\nNo Stripe, Vercel, live-mode, refund, deployment, or entitlement mutation was performed by this dry run.\n` },
  ];
  if (items.length > 0) files.splice(3, 0, { relativePath: `${targetDirectory}/items.yaml`, content: yaml({ schema_version: "1.0", items }) });

  return { appId, status: "dry_run_only", targetDirectory, files, warnings, blockedReasons };
}

export async function loadOnboardingArtifact(filePath: string): Promise<OnboardingArtifact> {
  return JSON.parse(await readFile(filePath, "utf8")) as OnboardingArtifact;
}

export function registryApplyApprovalPhrase(appId: string): string {
  return `APPLY REGISTRY PROPOSAL ${appId}`;
}

function assertProposalIsApplyable(proposal: RegistryProposal): void {
  if (proposal.blockedReasons.length > 0) throw new Error(`Proposal is blocked: ${proposal.blockedReasons.join("; ")}`);
}

function assertInsideDirectory(target: string, directory: string): void {
  const relative = path.relative(directory, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Refusing to write outside approved directory: ${target}`);
}

export async function writeDryRunProposal(proposal: RegistryProposal, outDir: string): Promise<void> {
  if (path.normalize(outDir).split(path.sep).includes("registry")) {
    throw new Error("Refusing to write dry-run proposal inside registry/. Choose a separate review output directory.");
  }
  for (const file of proposal.files) {
    const target = path.join(outDir, file.relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

export async function applyRegistryProposal(proposal: RegistryProposal, options: ApplyRegistryProposalOptions): Promise<ApplyRegistryProposalResult> {
  assertProposalIsApplyable(proposal);
  const expectedApproval = registryApplyApprovalPhrase(proposal.appId);
  if (options.approvalPhrase !== expectedApproval) {
    throw new Error(`Approval phrase mismatch. Required exact phrase: ${expectedApproval}`);
  }

  const rootDir = path.resolve(options.rootDir);
  const appsRoot = path.join(rootDir, "registry", "apps");
  const targetDirectory = path.join(appsRoot, proposal.appId);
  assertInsideDirectory(targetDirectory, appsRoot);

  if (existsSync(targetDirectory) && options.allowExisting !== true) {
    throw new Error(`Registry app package already exists: ${proposal.appId}. Re-run with explicit update mode only after operator approval.`);
  }

  const filesWritten: string[] = [];
  for (const file of proposal.files) {
    const target = path.resolve(rootDir, file.relativePath);
    assertInsideDirectory(target, targetDirectory);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
    filesWritten.push(path.relative(rootDir, target).replace(/\\/g, "/"));
  }

  return {
    appId: proposal.appId,
    status: "applied_to_working_tree",
    targetDirectory: path.relative(rootDir, targetDirectory).replace(/\\/g, "/"),
    filesWritten,
    requiredValidationCommands: ["npm run validate:registry", "npm run check"],
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const artifactIndex = args.indexOf("--artifact");
  const outIndex = args.indexOf("--out-dir");
  const rootIndex = args.indexOf("--root");
  const approvalIndex = args.indexOf("--approval");
  const shouldApply = args.includes("--apply");
  const allowExisting = args.includes("--allow-existing");
  const positionalArtifact = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--artifact" && args[index - 1] !== "--out-dir" && args[index - 1] !== "--root" && args[index - 1] !== "--approval");
  const artifactPath = artifactIndex >= 0 ? args[artifactIndex + 1] : positionalArtifact;
  if (!artifactPath) {
    throw new Error("Usage: tsx scripts/onboarding-registry-proposal.ts --artifact <artifact.json> [--out-dir <review-dir>] [--apply --approval <exact phrase> --root <repo>] or tsx scripts/onboarding-registry-proposal.ts <artifact.json>");
  }
  const artifact = await loadOnboardingArtifact(artifactPath);
  const proposal = generateRegistryProposal(artifact);
  if (proposal.blockedReasons.length > 0) {
    console.error(JSON.stringify({ status: proposal.status, blockedReasons: proposal.blockedReasons, warnings: proposal.warnings }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (shouldApply) {
    const result = await applyRegistryProposal(proposal, { rootDir: rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : process.cwd(), approvalPhrase: approvalIndex >= 0 ? args[approvalIndex + 1] ?? "" : "", allowExisting });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (outIndex >= 0 && args[outIndex + 1]) await writeDryRunProposal(proposal, args[outIndex + 1]);
  console.log(JSON.stringify({ status: proposal.status, appId: proposal.appId, targetDirectory: proposal.targetDirectory, files: proposal.files.map((file) => file.relativePath), warnings: proposal.warnings, approvalPhraseRequiredForApply: registryApplyApprovalPhrase(proposal.appId), wroteDryRunTo: outIndex >= 0 ? args[outIndex + 1] : null }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("onboarding-registry-proposal.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
