import { mock } from "node:test";
import type { Request, Response } from "express";

export class MakeSut {
	static Request(
		override: Partial<Request> = {},
		body: Record<string, unknown> = {},
	): Request {
		return {
			body,
			...override,
		} as Request;
	}

	static Response(): Response {
		const res = {} as Response;
		(res as any).status = mock.fn((_: number) => res);
		(res as any).json = mock.fn((_: unknown) => res);
		return res;
	}
}
