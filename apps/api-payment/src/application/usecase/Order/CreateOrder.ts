import { SagaOrchestrator } from "@ledger/shared";
import type { IOrderRepository, IPaymentRepository, IProductRepository } from "@ledger/shared";
import { ReserveStockStep } from "./saga/ReserveStockStep";
import { CreateOrderStep } from "./saga/CreateOrderStep";
import { ProcessPaymentStep } from "./saga/ProcessPaymentStep";
import type { CreateOrderContext } from "./saga/CreateOrderContext";

type OrderItem = {
	productId: string;
	quantity: number;
};

type Input = {
	items: OrderItem[];
};

type Output = {
	orderId: string;
	paymentId: string | null;
	paymentStatus: "paid" | "failed";
};

export class CreateOrder {
	constructor(
		private readonly orderRepository: IOrderRepository,
		private readonly productRepository: IProductRepository,
		private readonly paymentRepository: IPaymentRepository,
	) {}

	async execute(props: Input): Promise<Output> {
		const ctx: CreateOrderContext = { items: props.items };

		try {
			await new SagaOrchestrator<CreateOrderContext>()
				.add(new ReserveStockStep(this.productRepository))
				.add(new CreateOrderStep(this.orderRepository))
				.add(new ProcessPaymentStep(this.paymentRepository, this.orderRepository))
				.run(ctx);
		} catch (err) {
			if (ctx.order && ctx.payment) {
				return {
					orderId: ctx.order.get("id"),
					paymentId: ctx.payment.get("id"),
					paymentStatus: "failed",
				};
			}
			throw err;
		}

		return {
			orderId: ctx.order!.get("id"),
			paymentId: ctx.payment!.get("id"),
			paymentStatus: "paid",
		};
	}
}
