import type { Request, Response } from "express";
import { z } from "zod";
import { withSpan } from "../../../../infra/tracing";
import { CreateOrder } from "../../../../application/usecase/Order/CreateOrder";
import { OrderRepository } from "../../../../infra/repository/OrderRepository";
import { db } from "../../../../infra/db/client";
import { logger } from "../../../../infra/logger";
import { ProductRepository } from "@/infra/repository/ProductRepository";
import { PaymentRepository } from "@/infra/repository/PaymentRepository";

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

export async function createOrderController(
	req: Request,
	res: Response,
): Promise<void> {
	await withSpan("order.create", async () => {
		logger.info("order.create.started");

		const body = bodySchema.parse(req.body);

		const orderRepository = new OrderRepository(db);
		const productRepository = new ProductRepository(db);
		const paymentRepository = new PaymentRepository(db);
		const useCase = new CreateOrder(orderRepository, productRepository, paymentRepository);

		const result = await useCase.execute(body);

		logger.info("order.create.completed", {
			orderId: result.orderId,
			paymentStatus: result.paymentStatus,
			itemCount: body.items.length,
		});

		const httpStatus = result.paymentStatus === "paid" ? 201 : 402;
		res.status(httpStatus).json(result);
	});
}
