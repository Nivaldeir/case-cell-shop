import type { Request, Response } from "express";
import { z } from "zod";
import { withSpan } from "../../../../infra/tracing";
import { GetOrderStatus } from "../../../../application/usecase/Order/GetOrderStatus";
import { OrderRepository } from "../../../../infra/repository/OrderRepository";
import { PaymentRepository } from "../../../../infra/repository/PaymentRepository";
import { db } from "../../../../infra/db/client";
import { logger } from "../../../../infra/logger";
import { AppError } from "@/application/AppError";

const paramsSchema = z.object({
	orderId: z.string().min(1),
});

export async function getOrderStatusController(
	req: Request,
	res: Response,
): Promise<void> {
	await withSpan("order.getStatus", async () => {
		const { orderId } = paramsSchema.parse(req.params);

		logger.info("order.getStatus.started", { orderId });

		const orderRepository = new OrderRepository(db);
		const paymentRepository = new PaymentRepository(db);
		const useCase = new GetOrderStatus(orderRepository, paymentRepository);

		const result = await useCase.execute({ orderId });

		logger.info("order.getStatus.completed", { orderId, status: result.status });

		res.status(200).json(result);
	});
}
