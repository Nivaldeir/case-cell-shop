//@ts-nocheck
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import type { BaseController } from "@/application/interfaces/controllers/IBaseController";
import type IServer from "./IServer";
import type { IHttpServerSetting, InputHttp } from "./IServer";

const API_PREFIX = "/api/v1";

export class ExpressAdapter implements IServer {
	private app: any;

	constructor() {
		this.app = express();

		this.app.use(
			express.json({
				limit: "10mb",
				strict: true,
			}),
		);

		this.app.use(
			(error: any, _req: Request, res: Response, next: NextFunction) => {
				if (error instanceof SyntaxError && "body" in error) {
					return res.status(400).json({
						error: true,
						message: "Invalid JSON format in request body",
						details: error.message,
					});
				}

				return next(error);
			},
		);
	}

	settings(settings: IHttpServerSetting[]): void {
		settings.forEach((setting) => {
			this.app.use(setting.setConfig());
		});
	}

	addRoute(controller: BaseController): void {
		const fullPath = `${API_PREFIX}${controller.path}`;

		console.log(fullPath);

		this.app[controller.method](
			fullPath,
			async (req: Request, res: Response, _next: NextFunction) => {
				return controller.handle(req, res);
			},
		);
	}

	addRoutes(controllers: BaseController[]): void {
		controllers?.forEach((controller) => {
			this.addRoute(controller);
		});
	}

	on(params: InputHttp): void {
		const { method, url, callback } = params;

		const fullPath = `${API_PREFIX}${url}`;

		this.app[method](
			fullPath,
			async (req: Request, res: Response, next: NextFunction) => {
				const output = await callback(req, res, next);
				res.json(output);
			},
		);
	}

	listen(port: number, host?: string): void {
		this.app.listen(port, host);
	}
}
