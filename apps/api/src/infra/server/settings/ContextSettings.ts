import { trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IHttpServerSetting } from "../adapter/IServer";

export class ContextSettings implements IHttpServerSetting {
	setConfig(): RequestHandler {
		return (req: Request, res: Response, next: NextFunction) => {
			const requestId = (req.headers["x-request-id"] as string) || randomUUID();

			const span = trace.getActiveSpan();
			const traceId = span?.spanContext().traceId || requestId;

			(req as any).requestId = requestId;
			(req as any).correlationId = traceId;

			res.setHeader("x-request-id", requestId);
			res.setHeader("x-correlation-id", traceId);

			next();
		};
	}
}
