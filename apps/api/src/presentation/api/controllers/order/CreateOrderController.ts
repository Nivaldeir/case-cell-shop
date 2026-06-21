import {
	AppError,
	OrderRepository,
	ProductRepository,
	SagaRepository,
	SQSAdapter,
} from "@casecellshop/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import {
	BaseController,
	Method,
} from "@/application/interfaces/controllers/IBaseController";
import { CreateOrderUsecase } from "../../../../application/usecase/order/CreateOrderUsecase";

const bodySchema = z.object({
	items: z
		.array(
			z.object({
				productId: z.string(),
				quantity: z.number().int().positive(),
			}),
		)
		.min(1),
});

export class CreateOrderController extends BaseController<Request, Response> {
	constructor(private readonly usecase: CreateOrderUsecase) {
		super();
	}
	path = "/checkout";
	method = Method.POST;

	inputSchema?: z.ZodType = bodySchema;

	async handle(req: Request, res: Response) {
		const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

		if (!idempotencyKey) {
			throw new AppError("Header Idempotency-Key é obrigatório", 400);
		}

		const body = bodySchema.parse(req.body ?? {});

		const output = await this.usecase.execute({ ...body, idempotencyKey });

		return res.status(202).json({
			message: "Order requested successfully",
			error: false,
			data: output,
		});
	}
}

export default new CreateOrderController(
	new CreateOrderUsecase(
		new OrderRepository(),
		new ProductRepository(),
		new SagaRepository(),
		new SQSAdapter(),
	),
);
