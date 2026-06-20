import type { Request, Response } from "express";
import { z } from "zod";
import { withSpan } from "../../../../infra/tracing";
import { FindManyProduct } from "../../../../application/usecase/Product/FindManyProduct";
import { ProductRepository } from "../../../../infra/repository/ProductRepository";
import { db } from "../../../../infra/db/client";
import { logger } from "../../../../infra/logger";

const querySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
});

export async function findManyProductController(
	req: Request,
	res: Response,
): Promise<void> {
	await withSpan("product.findMany", async () => {
		const query = querySchema.parse(req.query);

		logger.info("product.findMany.started", { page: query.page, limit: query.limit });

		const productRepository = new ProductRepository(db);
		const useCase = new FindManyProduct(productRepository);

		const result = await useCase.execute(query);

		logger.info("product.findMany.completed", {
			totalItems: result.pagination.totalItems,
			page: query.page,
		});

		res.status(200).json({
			...result,
			items: result.items.map((p) => p.toJSON()),
		});
	});
}
