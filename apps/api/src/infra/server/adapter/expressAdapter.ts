//@ts-nocheck

import { context, SpanStatusCode, trace } from "@opentelemetry/api";
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
				const span = trace
					.getTracer("payments-api")
					.startSpan(`${req.method} ${fullPath}`, {
						attributes: {
							"http.method": req.method,
							"http.route": fullPath,
							"http.url": req.url,
						},
					});

				return context.with(trace.setSpan(context.active(), span), async () => {
					if (req.body && Object.keys(req.body).length > 0) {
						span.setAttribute("http.request.body", JSON.stringify(req.body));
					}

					const originalJson = res.json.bind(res);
					res.json = (body: any): Response => {
						span.setAttribute("http.status_code", res.statusCode);
						span.setAttribute("http.response.body", JSON.stringify(body));
						return originalJson(body);
					};

					try {
						const result = await controller.handle(req, res);
						span.setStatus({ code: SpanStatusCode.OK });
						return result;
					} catch (err) {
						span.setStatus({ code: SpanStatusCode.ERROR });
						span.recordException(err as Error);
						throw err;
					} finally {
						span.end();
					}
				});
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
				const requestId = (req as any).requestId;
				const correlationId = (req as any).correlationId;
				const output = await callback(req, res, next);

				res.json({
					...output,
					request: {
						requestId,
						correlationId,
					},
				});
			},
		);
	}

	listen(port: number, host?: string): void {
		this.app.listen(port, host);
	}
}
