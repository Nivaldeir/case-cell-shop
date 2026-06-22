import { initDb, Observability } from "@casecellshop/shared";
import swaggerUi from "swagger-ui-express";
import { ExpressAdapter } from "./infra/server/adapter/expressAdapter";
import { ContextSettings } from "./infra/server/settings/ContextSettings";
import { swaggerSpec } from "./infra/swagger/spec";
import { loadControllers } from "./presentation/api/controllers/routes";

Observability.start();

async function main() {
	await initDb();
	const controllers = await loadControllers();
	const server = new ExpressAdapter();
	server.settings([new ContextSettings()]);
	server.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
	server.addRoutes(controllers);
	server.listen(3000);
}

main();
