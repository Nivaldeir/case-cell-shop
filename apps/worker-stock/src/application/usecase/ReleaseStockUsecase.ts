import {
	AppError,
	type IProductRepository,
	type ISagaRepository,
	type JobData,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

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

		for (const item of items) {
			await this.incrementStockWithRetry(item.productId, item.quantity, sagaId);
		}

		await this.sagaRepository.update(sagaId, {
			status: SagaStatus.FAILED,
			currentStep: SagaStepName.RELEASE_STOCK,
		});
		console.log(
			`[worker-stock] Estoque liberado (compensação) — sagaId=${sagaId} orderId=${orderId}`,
		);
		return {
			success: true,
		};
	}

	private async incrementStockWithRetry(
		productId: string,
		quantity: number,
		sagaId: string,
		attempt = 1,
	): Promise<void> {
		const results = await this.productRepository.findByIds([productId]);
		const product = results?.[0];

		if (!product) {
			console.warn(
				`[worker-stock] Produto ${productId} não encontrado ao liberar estoque — sagaId=${sagaId}`,
			);
			return;
		}

		product.incrementStock(quantity);

		try {
			await this.productRepository.updateStock(product);
		} catch (err) {
			if (
				err instanceof AppError &&
				err.statusCode === 409 &&
				attempt < MAX_RETRIES
			) {
				await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
				return this.incrementStockWithRetry(
					productId,
					quantity,
					sagaId,
					attempt + 1,
				);
			}
			throw err;
		}
	}
}
