import {
	AppError,
	type IProductRepository,
	type ISagaRepository,
	type JobData,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";
import { compensate } from "../../shared/compensate";

type Output = {
	success: boolean;
};
export class ReleaseStockUsecase {
	constructor(
		private readonly productRepository: IProductRepository,
		private readonly sagaRepository: ISagaRepository,
	) {}

	async execute(input: JobData): Promise<Output> {
		const { items, orderId, sagaId } = input;
		const compensated = [];

		const products = await this.productRepository.findByIds(
			items.map((i) => i.productId),
		);

		if (!products) throw new AppError("Produtos não encontrado");

		const productMap = new Map(products.map((p) => [p.get("id")!, p]));

		for (const item of items) {
			const product = productMap.get(item.productId)!;

			product.decrementStock(item.quantity);

			await this.productRepository.updateStock(product);

			compensated.push({ productId: item.productId, quantity: item.quantity });
		}

		await compensate(this.productRepository, compensated);

		await this.sagaRepository.update(sagaId, {
			status: SagaStatus.FAILED,
			currentStep: SagaStepName.RELEASE_STOCK,
		});
		console.log(
			`[worker-stock] Estoque reservado — sagaId=${sagaId} orderId=${orderId}`,
		);
		return {
			success: true,
		};
	}
}
