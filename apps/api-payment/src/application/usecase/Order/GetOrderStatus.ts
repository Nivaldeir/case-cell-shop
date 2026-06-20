import type { IOrderRepository, IPaymentRepository } from "@ledger/shared";
import { AppError } from "@/application/AppError";

type Input = {
	orderId: string;
};

type Output = {
	orderId: string;
	status: string;
	total: number;
	items: Array<{ productId: string; quantity: number; price: number }>;
	payment: {
		paymentId: string;
		status: string;
		type: string;
		amount: number;
	} | null;
};

export class GetOrderStatus {
	constructor(
		private readonly orderRepository: IOrderRepository,
		private readonly paymentRepository: IPaymentRepository,
	) {}

	async execute(props: Input): Promise<Output> {
		const order = await this.orderRepository.findById(props.orderId);

		if (!order) {
			throw new AppError(`Pedido ${props.orderId} não encontrado`, 404);
		}

		const payment = await this.paymentRepository.findByOrderId(props.orderId);

		return {
			orderId: order.get("id"),
			status: order.get("status"),
			total: order.get("total"),
			items: order.get("ordemItems").map(item => ({
				productId: item.get("productId"),
				quantity: item.get("quantity"),
				price: item.get("price"),
			})),
			payment: payment
				? {
						paymentId: payment.get("id"),
						status: payment.get("status"),
						type: payment.get("type"),
						amount: payment.get("amount"),
					}
				: null,
		};
	}
}
