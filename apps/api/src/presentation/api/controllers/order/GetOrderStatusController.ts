import { OrderRepository, PaymentRepository } from "@casecellshop/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import {
	BaseController,
	Method,
} from "@/application/interfaces/controllers/IBaseController";
import { GetOrderStatusUsecase } from "../../../../application/usecase/order/GetOrderStatusUsecase";

const paramsSchema = z.object({
	orderId: z.string().min(1),
});

export class GetOrderStatusController extends BaseController<
	Request,
	Response
> {
	constructor(private readonly usecase: GetOrderStatusUsecase) {
		super();
	}
	path = "/checkout/:orderId/status";
	method = Method.GET;

	inputSchema?: z.ZodType | undefined;

	async handle(req: Request, res: Response) {
		const { orderId } = paramsSchema.parse(req.params ?? {});

		const output = await this.usecase.execute({
			orderId,
		});

		return res.status(202).json({
			message: "successfully",
			error: false,
			data: output,
		});
	}
}

export default new GetOrderStatusController(
	new GetOrderStatusUsecase(new OrderRepository(), new PaymentRepository()),
);
