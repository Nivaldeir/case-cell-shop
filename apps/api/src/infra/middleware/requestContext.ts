import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(
	req: Request & { requestId?: string },
	_res: Response,
	next: NextFunction,
): void {
	req.requestId = randomUUID();
	next();
}
