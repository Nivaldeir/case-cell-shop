import type { Request, Response } from "express";
import { z } from "zod";
import { withSpan } from "../../../../infra/tracing";
import { FindManyOrder } from "../../../../application/usecase/Order/FindManyOrder";
import { OrderRepository } from "../../../../infra/repository/OrderRepository";
import { db } from "../../../../infra/db/client";
import { logger } from "../../../../infra/logger";

const querySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(100),
});

export async function findManyOrderController(
	req: Request,
	res: Response,
): Promise<void> {
	await withSpan("order.findMany", async () => {
		const query = querySchema.parse(req.query);

		logger.info("order.findMany.started", { page: query.page, limit: query.limit });

		const orderRepository = new OrderRepository(db);
		const useCase = new FindManyOrder(orderRepository);

		const result = await useCase.execute(query);

		logger.info("order.findMany.completed", {
			totalItems: result.pagination.totalItems,
			page: query.page,
		});

		res.status(200).json({
			...result,
			items: result.items.map((o) => o.toJSON()),
		});
	});
}
