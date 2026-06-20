import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const paymentDbRoot = join(scriptDir, "..");
const repoRoot = join(paymentDbRoot, "..", "..");
const appPayment = join(repoRoot, "apps", "payment");

for (const base of [process.cwd(), appPayment, repoRoot, paymentDbRoot]) {
	dotenv.config({ path: join(base, ".env") });
	dotenv.config({ path: join(base, ".env.local"), override: true });
}

export async function runSeed() {
	console.log("Nenhum seed configurado.");
}

const isMain = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1] &&
		import.meta.url.includes("run-seed")
	: false;

if (isMain) {
	void runSeed();
}
