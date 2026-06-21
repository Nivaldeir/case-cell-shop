import {
	AppError,
	type IOrderRepository,
	type IProductRepository,
	type ISagaRepository,
	type JobData,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";
import { compensate } from "../../shared/compensate";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;

type Output = {
	success: boolean;
};
export class ReserveStockUsecase {
	constructor(
		private readonly productRepository: IProductRepository,
		private readonly orderRepository: IOrderRepository,
		private readonly sagaRepository: ISagaRepository,
	) {}

	async execute(input: JobData): Promise<Output> {
		const { items, orderId, sagaId } = input;
		const compensated: Array<{ productId: string; quantity: number }> = [];
		let success = false;
		try {
			await this.sagaRepository.update(sagaId, { status: SagaStatus.RUNNING });

			for (const item of items) {
				await this.decrementStockWithRetry(item.productId, item.quantity);
				compensated.push({
					productId: item.productId,
					quantity: item.quantity,
				});
			}

			await this.sagaRepository.update(sagaId, {
				status: SagaStatus.RUNNING,
				currentStep: SagaStepName.PROCESS_PAYMENT,
			});
			success = true;
			console.log(
				`[worker-stock] Estoque reservado — sagaId=${sagaId} orderId=${orderId}`,
			);
		} catch (error) {
			console.log(error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			console.error(
				`[worker-stock] Falha na reserva — sagaId=${sagaId}:`,
				errorMessage,
			);

			await compensate(this.productRepository, compensated);

			await this.sagaRepository.update(sagaId, {
				status: SagaStatus.FAILED,
				error: errorMessage,
			});

			const order = await this.orderRepository.findById(orderId);
			if (order) {
				order.cancel();
				await this.orderRepository.updateStatus(order);
			}
		}
		return { success };
	}

	private async decrementStockWithRetry(
		productId: string,
		quantity: number,
		attempt = 1,
	): Promise<void> {
		const results = await this.productRepository.findByIds([productId]);
		const product = results?.[0];

		if (!product) throw new Error(`Produto ${productId} não encontrado`);

		if (product.get("stock") < quantity) {
			throw new Error(`Estoque insuficiente para o produto ${productId}`);
		}

		product.decrementStock(quantity);

		try {
			await this.productRepository.updateStock(product);
		} catch (err) {
			if (
				err instanceof AppError &&
				err.statusCode === 409 &&
				attempt < MAX_RETRIES
			) {
				await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
				return this.decrementStockWithRetry(productId, quantity, attempt + 1);
			}
			throw err;
		}
	}
}
