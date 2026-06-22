import type { IProductRepository } from "@casecellshop/shared";

export async function compensate(
	productRepository: IProductRepository,
	compensated: Array<{ productId: string; quantity: number }>,
): Promise<void> {
	for (const { productId, quantity } of compensated) {
		try {
			const product = await productRepository.findById(productId);
			if (product) {
				product.incrementStock(quantity);
				await productRepository.updateStock(product);
			}
		} catch (err) {
			console.error(
				`[worker-stock] Falha na compensação do produto ${productId}:`,
				err,
			);
		}
	}
}
