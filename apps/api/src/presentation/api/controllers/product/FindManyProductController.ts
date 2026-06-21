import { ProductRepository } from "@casecellshop/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import {
	BaseController,
	Method,
} from "@/application/interfaces/controllers/IBaseController";
import { FindManyProductUsecase } from "../../../../application/usecase/product/FindManyProductUsecase";

const querySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
});

export class FindManyProductController extends BaseController<
	Request,
	Response
> {
	path = "/product";
	method = Method.GET;

	constructor(private readonly usecase: FindManyProductUsecase) {
		super();
	}

	inputSchema?: z.ZodType | undefined;

	async handle(req: Request, res: Response) {
		const body = querySchema.parse(req.query ?? {});

		const output = await this.usecase.execute(body);

		return res.status(202).json({
			message: "Product search successful",
			error: false,
			data: output.items,
			pagination: output.pagination,
		});
	}
}

export default new FindManyProductController(
	new FindManyProductUsecase(new ProductRepository()),
);
