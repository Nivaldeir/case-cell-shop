import { trace } from "@opentelemetry/api";
import { randomUUID } from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IHttpServerSetting } from "../adapter/IServer";

export class ContextSettings implements IHttpServerSetting {
	setConfig(): RequestHandler {
		return (req: Request, res: Response, next: NextFunction) => {
			const span = trace.getActiveSpan();
			const spanId = span?.spanContext().spanId;
			const traceId = span?.spanContext().traceId;

			const requestId =
				spanId || (req.headers["x-request-id"] as string) || randomUUID();
			const correlationId = traceId || requestId;

			(req as any).requestId = requestId;
			(req as any).correlationId = correlationId;

			res.setHeader("x-request-id", requestId);
			res.setHeader("x-correlation-id", correlationId);

			next();
		};
	}
}
