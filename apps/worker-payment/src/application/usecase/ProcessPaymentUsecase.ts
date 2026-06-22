import {
	AppError,
	type IOrderRepository,
	type IPaymentRepository,
	type ISagaRepository,
	Payment,
	type QueueAdapter,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";

type Input = {
	sagaId: string;
	orderId: string;
	items: Array<{ productId: string; quantity: number }>;
};

export type ProcessPaymentOutput = {
	approved: boolean;
	error?: string;
};

export class ProcessPaymentUsecase {
	constructor(
		private readonly orderRepository: IOrderRepository,
		private readonly paymentRepository: IPaymentRepository,
		private readonly sagaRepository: ISagaRepository,
		private readonly queue: QueueAdapter,
		private readonly resolvePayment: () => boolean = () => Math.random() >= 0.5,
	) {}

	async execute(input: Input): Promise<ProcessPaymentOutput> {
		const { sagaId, orderId, items } = input;
		try {
			await this.sagaRepository.update(sagaId, { status: SagaStatus.RUNNING });

			const order = await this.orderRepository.findById(orderId);
			if (!order) throw new AppError(`Pedido ${orderId} não encontrado`);

			const payment = Payment.create({
				orderId,
				type: "pix",
				amount: order.get("amount"),
			});

			await this.paymentRepository.create(payment);

			if (!this.resolvePayment()) {
				payment.markAsFailed();
				await this.paymentRepository.updateStatus(payment);
				throw new AppError("Pagamento recusado");
			}

			payment.markAsPaid();
			await this.paymentRepository.updateStatus(payment);

			order.markAsPaid();
			await this.orderRepository.updateStatus(order);

			await this.sagaRepository.update(sagaId, {
				status: SagaStatus.COMPLETED,
			});

			console.log(
				`[worker-payment] Pagamento processado — sagaId=${sagaId} orderId=${orderId}`,
			);

			return { approved: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			console.error(
				`[worker-payment] Falha no pagamento — sagaId=${sagaId}:`,
				errorMessage,
			);

			await this.sagaRepository.update(sagaId, {
				status: SagaStatus.COMPENSATED,
				error: errorMessage,
			});

			await this.queue.publish(SagaStepName.RELEASE_STOCK, {
				sagaId,
				orderId,
				items,
			});

			const order = await this.orderRepository.findById(orderId);
			if (order) {
				order.cancel();
				await this.orderRepository.updateStatus(order);
			}

			return { approved: false, error: errorMessage };
		}
	}
}
