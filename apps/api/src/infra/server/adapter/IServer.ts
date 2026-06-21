import type { Request, RequestHandler, Response } from "express";
import type {
	BaseController,
	Method,
} from "@/application/interfaces/controllers/IBaseController";

export interface IHttpServerSetting {
	setConfig(): RequestHandler;
}

export default interface IServer {
	on(params: InputHttp): any;
	listen(port: number): void;
	addRoutes(controllers: BaseController[]): void;
	settings(setting: IHttpServerSetting[]): void;
}

export type InputHttp = {
	method: Method;
	url: string;
	callback: (req: Request, res: Response, next: any) => Promise<void>;
};
