import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const paymentDbRoot = join(scriptDir, "..");
const repoRoot = join(paymentDbRoot, "..", "..");
const appPayment = join(repoRoot, "apps", "payment");
const defaultDbUrl = `file:${join(repoRoot, "apps", "api-payment", "local.db")}`;

for (const base of [process.cwd(), appPayment, repoRoot, paymentDbRoot]) {
	dotenv.config({ path: join(base, ".env") });
	dotenv.config({ path: join(base, ".env.local"), override: true });
}
dotenv.config({ path: join(repoRoot, "integration.env") });

function resolveDbUrl(raw: string): string {
	if (!raw.startsWith("file:")) return raw;
	const filePath = raw.slice("file:".length);
	if (filePath.startsWith("/") || /^[A-Za-z]:/.test(filePath)) return raw;
	return `file:${join(repoRoot, filePath)}`;
}

const rawUrl = process.env.DATABASE_URL ?? defaultDbUrl;

const client = createClient({
	url: resolveDbUrl(rawUrl),
	authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

function resolveMigrationsFolder(): string {
	const explicitDir = process.env.DB_MIGRATIONS_DIR;
	const candidates = [
		explicitDir,
		join(process.cwd(), "migrations"),
		join(paymentDbRoot, "migrations"),
		join(repoRoot, "packages", "db", "migrations"),
	].filter((dir): dir is string => Boolean(dir));

	for (const dir of candidates) {
		if (existsSync(join(dir, "meta", "_journal.json"))) {
			return dir;
		}
	}

	throw new Error(
		`Can't find meta/_journal.json file. Checked: ${candidates.join(", ")}`,
	);
}

export async function runMigrate() {
	const migrationsFolder = resolveMigrationsFolder();
	try {
		await migrate(db, { migrationsFolder });
		console.log("Migrations aplicadas com sucesso.");
	} catch (e) {
		console.error("Falha ao aplicar migrations:", e);
		process.exit(1);
	} finally {
		client.close();
	}
}

const isMain = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1] &&
		import.meta.url.includes("run-migrate")
	: false;

if (isMain) {
	void runMigrate();
}
