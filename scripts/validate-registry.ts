#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "./registry-validation.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const result = await validateRegistry(rootDir);

if (result.errors.length > 0) {
  console.error(`Registry validation failed with ${result.errors.length} error(s):`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Registry validation passed for ${result.appCount} application package(s).`);
}
