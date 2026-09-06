import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const requiredFiles = [
  "app.yaml",
  "plans.yaml",
  "entitlements.yaml",
  "integration.yaml",
  "files.manifest.yaml",
  "env.example",
  "integration-status.md",
] as const;

const schemaFiles = {
  "app.yaml": "app.schema.json",
  "plans.yaml": "plans.schema.json",
  "entitlements.yaml": "entitlements.schema.json",
  "integration.yaml": "integration.schema.json",
  "files.manifest.yaml": "files-manifest.schema.json",
} as const;

type RegistryDocument = Record<string, unknown>;

export interface ValidationResult {
  readonly errors: readonly string[];
  readonly appCount: number;
}

function formatAjvErrors(appId: string, file: string, errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) =>
    `${appId}/${file}${error.instancePath || "/"}: ${error.message ?? "invalid"}`,
  );
}

async function loadYaml(file: string): Promise<RegistryDocument> {
  const value = parse(await readFile(file, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("document root must be an object");
  }
  return value as RegistryDocument;
}

async function buildValidators(schemaDir: string): Promise<Map<string, ValidateFunction>> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validators = new Map<string, ValidateFunction>();
  for (const [manifestName, schemaName] of Object.entries(schemaFiles)) {
    const schema = JSON.parse(await readFile(path.join(schemaDir, schemaName), "utf8")) as object;
    validators.set(manifestName, ajv.compile(schema));
  }
  return validators;
}

export async function validateRegistry(rootDir: string): Promise<ValidationResult> {
  const registryDir = path.join(rootDir, "registry");
  const appsDir = path.join(registryDir, "apps");
  const validators = await buildValidators(path.join(registryDir, "schemas"));
  const errors: string[] = [];
  const globalLookupKeys = new Map<string, string>();
  const entries = (await readdir(appsDir)).sort();
  let appCount = 0;

  for (const appId of entries) {
    const appDir = path.join(appsDir, appId);
    if (!(await stat(appDir)).isDirectory()) continue;
    appCount += 1;

    const present = new Set(await readdir(appDir));
    for (const requiredFile of requiredFiles) {
      if (!present.has(requiredFile)) errors.push(`${appId}: missing required file ${requiredFile}`);
    }

    const documents = new Map<string, RegistryDocument>();
    for (const file of Object.keys(schemaFiles)) {
      if (!present.has(file)) continue;
      try {
        const document = await loadYaml(path.join(appDir, file));
        documents.set(file, document);
        const validate = validators.get(file)!;
        if (!validate(document)) errors.push(...formatAjvErrors(appId, file, validate.errors));
      } catch (error) {
        errors.push(`${appId}/${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const app = documents.get("app.yaml");
    const plansDoc = documents.get("plans.yaml");
    const entitlementsDoc = documents.get("entitlements.yaml");
    const manifest = documents.get("files.manifest.yaml");

    if (app?.app_id !== appId) errors.push(`${appId}/app.yaml: app_id must match directory name`);
    if (manifest?.app_id !== appId) errors.push(`${appId}/files.manifest.yaml: app_id must match directory name`);

    const entitlementKeys = new Set<string>();
    for (const item of (entitlementsDoc?.entitlements as Array<{ key?: string }> | undefined) ?? []) {
      if (!item.key) continue;
      if (entitlementKeys.has(item.key)) errors.push(`${appId}/entitlements.yaml: duplicate entitlement ${item.key}`);
      entitlementKeys.add(item.key);
      if (!item.key.startsWith(`${appId}.`)) errors.push(`${appId}/entitlements.yaml: ${item.key} must use the app namespace`);
    }

    const planKeys = new Set<string>();
    const plans = (plansDoc?.plans as Array<Record<string, unknown>> | undefined) ?? [];
    for (const plan of plans) {
      const planKey = plan.plan_key as string | undefined;
      if (planKey) {
        if (planKeys.has(planKey)) errors.push(`${appId}/plans.yaml: duplicate plan_key ${planKey}`);
        planKeys.add(planKey);
      }
      const bundle = (plan.entitlement_bundle as string[] | undefined) ?? [];
      for (const key of bundle) {
        if (!entitlementKeys.has(key)) errors.push(`${appId}/plans.yaml: unknown entitlement ${key}`);
      }
      const providers = (plan.provider as Record<string, { lookup_key?: string; live_lookup_key?: string }> | undefined) ?? {};
      for (const [provider, mapping] of Object.entries(providers)) {
        if (!mapping.lookup_key) continue;
        const testIdentity = `${provider}:test:${mapping.lookup_key}`;
        const previousTest = globalLookupKeys.get(testIdentity);
        if (previousTest) errors.push(`${appId}/plans.yaml: lookup key ${testIdentity} already used by ${previousTest}`);
        else globalLookupKeys.set(testIdentity, `${appId}/${planKey ?? "unknown"}`);
        const liveLookupKey = mapping.live_lookup_key ?? mapping.lookup_key;
        const liveIdentity = `${provider}:live:${liveLookupKey}`;
        const previousLive = globalLookupKeys.get(liveIdentity);
        if (previousLive) errors.push(`${appId}/plans.yaml: lookup key ${liveIdentity} already used by ${previousLive}`);
        else globalLookupKeys.set(liveIdentity, `${appId}/${planKey ?? "unknown"}`);
      }
      const pricing = (plan.pricing as { interval?: string } | undefined) ?? {};
      if (plan.type === "subscription" && !pricing.interval) errors.push(`${appId}/plans.yaml: subscription ${planKey} requires interval`);
      if (plan.type === "one_time" && pricing.interval) errors.push(`${appId}/plans.yaml: one-time plan ${planKey} cannot have interval`);
    }
  }

  if (appCount === 0) errors.push("registry/apps must contain at least one application package");
  return { errors, appCount };
}
