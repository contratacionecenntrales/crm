import { execFileSync } from "node:child_process";
import path from "node:path";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/crm_labs_test?schema=public";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Resets the e2e test database back to the fixed seed fixture. */
export function resetDb() {
  execFileSync("npx", ["tsx", "prisma/seed-e2e.ts"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
