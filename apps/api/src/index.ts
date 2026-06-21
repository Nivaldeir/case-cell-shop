import { ExpressAdapter } from "./infra/server/adapter/expressAdapter";
import { loadControllers } from "./presentation/api/controllers/routes";

async function main() {
	const controllers = await loadControllers();
	const server = new ExpressAdapter();
	server.addRoutes(controllers);
	server.listen(3000);
}
main();
