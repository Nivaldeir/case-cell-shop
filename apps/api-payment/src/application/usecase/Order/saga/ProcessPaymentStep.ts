import { Payment } from "@ledger/shared";
import type { IOrderRepository, IPaymentRepository, SagaStep } from "@ledger/shared";
import type { CreateOrderContext } from "./CreateOrderContext";

export class ProcessPaymentStep implements SagaStep<CreateOrderContext> {
	constructor(
		private readonly paymentRepository: IPaymentRepository,
		private readonly orderRepository: IOrderRepository,
	) {}

	async execute(ctx: CreateOrderContext): Promise<void> {
		const order = ctx.order!;

		const payment = Payment.create({
			orderId: order.get("id"),
			type: "pix",
			amount: order.get("total"),
		});

		const approved = Math.random() < 0.5;

		if (approved) {
			payment.markAsPaid();
		} else {
			payment.markAsFailed();
		}

		await this.paymentRepository.create(payment);
		ctx.payment = payment;

		if (!approved) {
			throw new Error(`Pagamento recusado para o pedido ${order.get("id")}`);
		}

		order.markAsPaid();
		await this.orderRepository.updateStatus(order);
	}

	async compensate(ctx: CreateOrderContext): Promise<void> {
		if (!ctx.payment) return;

		ctx.payment.refund();
		await this.paymentRepository.updateStatus(ctx.payment);

		ctx.order!.cancel();
		await this.orderRepository.updateStatus(ctx.order!);
	}
}
