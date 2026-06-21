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
		const compensated = [];
		let success = false;
		try {
			await this.sagaRepository.update(sagaId, { status: SagaStatus.RUNNING });

			const products = await this.productRepository.findByIds(
				items.map((i) => i.productId),
			);

			if (!products) throw new AppError("Produtos não encontrado");

			const productMap = new Map(products.map((p) => [p.get("id")!, p]));

			for (const item of items) {
				const product = productMap.get(item.productId);

				if (!product)
					throw new Error(`Produto ${item.productId} não encontrado`);

				if (product.get("stock") < item.quantity) {
					throw new Error(
						`Estoque insuficiente para o produto ${item.productId}`,
					);
				}
			}

			for (const item of items) {
				const product = productMap.get(item.productId)!;

				product.decrementStock(item.quantity);

				await this.productRepository.updateStock(product);

				compensated.push({
					productId: item.productId,
					quantity: item.quantity,
				});
			}

			await this.sagaRepository.update(sagaId, {
				status: SagaStatus.RUNNING,
				currentStep: SagaStepName.PROCESS_PAYMENT,
			});
			success = false;
			console.log(
				`[worker-stock] Estoque reservado — sagaId=${sagaId} orderId=${orderId}`,
			);
		} catch (error) {
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
			success = false;
		}
		return {
			success,
		};
	}
}
