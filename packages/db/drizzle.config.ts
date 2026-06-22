import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const pkgDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pkgDir, "..", "..");
const appPayment = join(repoRoot, "apps", "payment");

for (const base of [process.cwd(), appPayment, repoRoot, pkgDir]) {
	dotenv.config({ path: join(base, ".env") });
	dotenv.config({ path: join(base, ".env.local") });
}

const defaultDbUrl = `file:${join(repoRoot, "apps", "api-payment", "local.db")}`;

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? defaultDbUrl,
		authToken: process.env.DATABASE_AUTH_TOKEN,
	},
});
