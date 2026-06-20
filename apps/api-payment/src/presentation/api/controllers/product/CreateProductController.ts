import type { Request, Response } from "express";
import { z } from "zod";
import { withSpan } from "../../../../infra/tracing";
import { CreateProduct } from "../../../../application/usecase/Product/CreateProduct";
import { ProductRepository } from "../../../../infra/repository/ProductRepository";
import { db } from "../../../../infra/db/client";
import { logger } from "../../../../infra/logger";

const bodySchema = z.object({
	name: z.string().min(5),
	price: z.number().positive(),
	stock: z.number().int().nonnegative(),
	description: z.string().optional(),
});

export async function createProductController(
	req: Request,
	res: Response,
): Promise<void> {
	await withSpan("product.create", async () => {
		logger.info("product.create.started");

		const body = bodySchema.parse(req.body);

		const productRepository = new ProductRepository(db);
		const useCase = new CreateProduct(productRepository);

		const result = await useCase.execute(body);

		logger.info("product.create.completed", { productId: result.productId });

		res.status(201).json(result);
	});
}
