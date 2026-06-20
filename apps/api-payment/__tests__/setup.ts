/**
 * Global test setup — loaded via `--import` before any test file runs.
 *
 * Starts a PostgreSQL testcontainer, runs all Drizzle migrations, and
 * exposes the connection details through process.env so every test module
 * (including db/client) picks them up at first import.
 *
 * Unit tests: the DB is available but not queried (repositories are mocked).
 * Integration tests: query the real containerised DB directly.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@ledger/db/schema";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Start container ──────────────────────────────────────────────────────────
const container = await new PostgreSqlContainer("postgres:15-alpine").start();

// ── Propagate connection details ─────────────────────────────────────────────
process.env.DATABASE_HOST = container.getHost();
process.env.DATABASE_PORT = String(container.getMappedPort(5432));
process.env.DATABASE_USER = container.getUsername();
process.env.DATABASE_PASSWORD = container.getPassword();
process.env.DATABASE_NAME = container.getDatabase();
process.env.DB_SSL = "false";
process.env.DB_SSL_REJECT_UNAUTHORIZED = "false";

// Required by Crypto helpers used in CreateAccount
process.env.ENCRYPTION_SECRET = "test-secret-key-for-tests-only";
process.env.ENCRYPTION_SALT = "test-salt-for-tests-only";

// ── Apply migrations ─────────────────────────────────────────────────────────
const migrationPool = new Pool({
	host: container.getHost(),
	port: container.getMappedPort(5432),
	user: container.getUsername(),
	password: container.getPassword(),
	database: container.getDatabase(),
});

const db = drizzle(migrationPool, { schema });
const repoRoot = join(__dirname, "..", "..", "..");
const migrationsFolder = join(repoRoot, "packages", "db", "migrations");

await migrate(db, { migrationsFolder });
await migrationPool.end();

// Ryuk (testcontainers resource reaper) stops the container automatically
// when the Node process exits. No explicit cleanup needed here.
