import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { ZodError } from "zod";
import type { BaseController } from "@/application/interfaces/controllers/IBaseController";

const API_PREFIX = "/api/v1";

export async function createTestServer(controllers: BaseController[]) {
	const app = express();

	app.use(express.json({ limit: "10mb", strict: true }));

	for (const controller of controllers) {
		const fullPath = `${API_PREFIX}${controller.path}`;
		(app as any)[controller.method](
			fullPath,
			async (req: any, res: any, next: any) => {
				try {
					await controller.handle(req, res);
				} catch (err) {
					next(err);
				}
			},
		);
	}

	app.use((err: any, _req: any, res: any, _next: any) => {
		if (err instanceof ZodError) {
			return res.status(400).json({
				error: true,
				message: "Validation error",
				details: err.issues,
			});
		}
		const status = err?.statusCode ?? 500;
		return res
			.status(status)
			.json({ error: true, message: err?.message ?? "Internal server error" });
	});

	return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
		const server = createServer(app);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as AddressInfo;
			resolve({
				url: `http://127.0.0.1:${port}`,
				close: () => new Promise<void>((res) => server.close(() => res())),
			});
		});
	});
}

export function mockReq(
	opts: { body?: any; params?: any; query?: any; headers?: any } = {},
) {
	return {
		body: opts.body ?? {},
		params: opts.params ?? {},
		query: opts.query ?? {},
		headers: opts.headers ?? {},
	} as any;
}

export function mockRes() {
	let _statusCode = 200;
	let _data: any = null;

	const res: any = {
		get statusCode() {
			return _statusCode;
		},
		get data() {
			return _data;
		},
		status(code: number) {
			_statusCode = code;
			return res;
		},
		json(data: any) {
			_data = data;
			return res;
		},
	};
	return res;
}
