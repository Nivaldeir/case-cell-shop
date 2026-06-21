import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BaseController } from "@/application/interfaces/controllers/IBaseController";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadControllers(
	dir: string = __dirname,
): Promise<BaseController<any, any>[]> {
	const controllers: BaseController<any, any>[] = [];
	const files = readdirSync(dir);

	for (const file of files) {
		if (file === "routes.ts" || file === "routes.js") {
			continue;
		}

		const filePath = join(dir, file);
		const stat = statSync(filePath);

		if (stat.isDirectory()) {
			if (file === "response" || file === "request") {
				continue;
			}
			const subControllers = await loadControllers(filePath);
			controllers.push(...subControllers);
		} else if (
			stat.isFile() &&
			file.includes("Controller") &&
			(file.endsWith(".js") ||
				(file.endsWith(".ts") && !file.endsWith(".d.ts")))
		) {
			try {
				const mod = await import(pathToFileURL(filePath).href);

				if (mod.default && typeof mod.default.handle === "function") {
					controllers.push(mod.default);
				}
			} catch (error) {
				console.error(`Erro ao carregar controller ${filePath}:`, error);
			}
		}
	}

	return controllers;
}
