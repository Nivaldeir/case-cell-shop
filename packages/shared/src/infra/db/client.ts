import "dotenv/config";
import { isAbsolute, join } from "node:path";
import * as schema from "@casecellshop/db";
import { createClient } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";

export type AnyDbClient = LibSQLDatabase<any>;

function resolveDbUrl(raw: string): string {
	if (!raw.startsWith("file:")) return raw;
	const filePath = raw.slice("file:".length);
	if (isAbsolute(filePath)) return raw;
	return `file:${join(process.cwd(), filePath)}`;
}

const libsqlClient = createClient({
	url: resolveDbUrl(process.env.DATABASE_URL ?? "file:apps/api/local.db"),
	authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(libsqlClient, { schema });

let initDbPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
	if (!initDbPromise) {
		initDbPromise = (async () => {
			await libsqlClient.execute("PRAGMA journal_mode=WAL");
			await libsqlClient.execute("PRAGMA busy_timeout=5000");
		})();
	}
	return initDbPromise;
}

export function runInTransaction<T>(
	dbClient: AnyDbClient,
	fn: (tx: AnyDbClient) => Promise<T>,
): Promise<T> {
	return (dbClient as any).transaction(fn as any) as Promise<T>;
}
