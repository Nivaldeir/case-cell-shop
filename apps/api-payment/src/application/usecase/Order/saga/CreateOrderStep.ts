import { Order, OrdemItem } from "@ledger/shared";
import type { IOrderRepository, SagaStep } from "@ledger/shared";
import type { CreateOrderContext } from "./CreateOrderContext";

export class CreateOrderStep implements SagaStep<CreateOrderContext> {
	constructor(private readonly orderRepository: IOrderRepository) {}

	async execute(ctx: CreateOrderContext): Promise<void> {
		const orderItems = ctx.items.map(item => {
			const product = ctx.products!.get(item.productId)!;
			return OrdemItem.create({
				price: product.get("price"),
				productId: product.get("id")!,
				quantity: item.quantity,
			});
		});

		const order = Order.create({ status: "pending", ordemItems: orderItems });
		order.recalculateTotal();

		await this.orderRepository.create(order);

		ctx.order = order;
		ctx.orderItems = orderItems;
	}

	async compensate(ctx: CreateOrderContext): Promise<void> {
		if (!ctx.order) return;
		ctx.order.cancel();
		await this.orderRepository.updateStatus(ctx.order);
	}
}
