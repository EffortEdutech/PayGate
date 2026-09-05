import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "../../scripts/registry-validation.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("canonical registry passes structural and semantic validation", async () => {
  const result = await validateRegistry(rootDir);
  assert.equal(result.appCount, 2);
  assert.deepEqual(result.errors, []);
});

