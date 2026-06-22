import "dotenv/config";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@casecellshop/db";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const repoRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"..",
);

function resolveDbUrl(raw: string): string {
	if (!raw.startsWith("file:")) return raw;
	const filePath = raw.slice("file:".length);
	if (isAbsolute(filePath)) return raw;
	return `file:${join(repoRoot, filePath)}`;
}

const client = createClient({
	url: resolveDbUrl(
		process.env.DATABASE_URL ?? "file:apps/api-payment/local.db",
	),
	authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export type AnyDbClient =
	| typeof db
	| Parameters<Parameters<typeof db.transaction>[0]>[0];

export function runInTransaction<T>(
	fn: (tx: AnyDbClient) => Promise<T>,
): Promise<T> {
	return db.transaction(
		fn as Parameters<typeof db.transaction>[0],
	) as Promise<T>;
}
