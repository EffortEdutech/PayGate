import { readFile } from "node:fs/promises";
import { Pool } from "pg";

export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function runSqlMigration(connectionString: string, migrationPath: string): Promise<void> {
  const pool = createPgPool(connectionString);
  try {
    const sql = await readFile(migrationPath, "utf8");
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}
