import type { IProductRepository, Product, SagaStep } from "@ledger/shared";
import { AppError } from "@/application/AppError";
import type { CreateOrderContext } from "./CreateOrderContext";

export class ReserveStockStep implements SagaStep<CreateOrderContext> {
	constructor(private readonly productRepository: IProductRepository) {}

	async execute(ctx: CreateOrderContext): Promise<void> {
		const products = await this.productRepository.findByIds(
			ctx.items.map(i => i.productId),
		);

		const productMap = new Map<string, Product>(
			products?.map(p => [p.get("id")!, p]),
		);

		for (const item of ctx.items) {
			const product = productMap.get(item.productId);

			if (!product) {
				throw new AppError(`Produto ${item.productId} não encontrado`, 404);
			}

			if (item.quantity > product.get("stock")) {
				throw new AppError(
					`Produto ${product.get("name")} sem estoque suficiente (disponível: ${product.get("stock")}, solicitado: ${item.quantity})`,
				);
			}

			product.decrementStock(item.quantity);
			await this.productRepository.updateStock(product);
		}

		ctx.products = productMap;
	}

	async compensate(ctx: CreateOrderContext): Promise<void> {
		if (!ctx.products) return;

		for (const [, product] of ctx.products) {
			const item = ctx.items.find(i => i.productId === product.get("id"));
			if (!item) continue;
			product.incrementStock(item.quantity);
			await this.productRepository.updateStock(product);
		}
	}
}
