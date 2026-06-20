import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestContextMiddleware(
	req: Request & { requestId?: string },
	_res: Response,
	next: NextFunction,
): void {
	req.requestId = randomUUID();
	next();
}
