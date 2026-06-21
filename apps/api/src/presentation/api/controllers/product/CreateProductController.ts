import { ProductRepository } from "@casecellshop/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import {
	BaseController,
	Method,
} from "@/application/interfaces/controllers/IBaseController";
import { CreateProductUsecase } from "../../../../application/usecase/product/CreateProductUsecase";

const bodySchema = z.object({
	name: z.string().min(5),
	price: z.number().positive(),
	stock: z.number().int().nonnegative(),
	description: z.string().optional(),
});

export class CreateProductController extends BaseController<Request, Response> {
	constructor(private readonly usecase: CreateProductUsecase) {
		super();
	}
	path = "/product";
	method = Method.POST;

	inputSchema?: z.ZodType = bodySchema;

	async handle(req: Request, res: Response) {
		const body = bodySchema.parse(req.body ?? {});

		const output = await this.usecase.execute(body);

		return res.status(201).json({
			message: "Product created with successfully",
			error: false,
			data: output,
		});
	}
}

export default new CreateProductController(
	new CreateProductUsecase(new ProductRepository()),
);
