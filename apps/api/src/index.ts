import { initDb, Observability } from "@casecellshop/shared";
import { ExpressAdapter } from "./infra/server/adapter/expressAdapter";
import { ContextSettings } from "./infra/server/settings/ContextSettings";
import { loadControllers } from "./presentation/api/controllers/routes";

Observability.start();

async function main() {
	await initDb();
	const controllers = await loadControllers();
	const server = new ExpressAdapter();
	server.settings([new ContextSettings()]);
	server.addRoutes(controllers);
	server.listen(3000);
}

main();
