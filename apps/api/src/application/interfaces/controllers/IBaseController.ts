import type { ZodType } from "zod";

export enum Method {
	GET = "get",
	POST = "post",
	PUT = "put",
	DELETE = "delete",
}

export abstract class BaseController<Req = any, Res = any> {
	abstract path: string;
	abstract method: Method;
	abstract handle(req: Req, res: Res): Promise<Res>;
	abstract inputSchema?: ZodType<any> | ZodType<any>[];
}
