import type {
	IOrderRepository,
	IProductRepository,
	ISagaRepository,
	JobData,
	QueueAdapter,
} from "@casecellshop/shared";
import {
	AppError,
	GenerateId,
	OrdemItem,
	Order,
	SagaStepName,
} from "@casecellshop/shared";

type Input = {
	items: {
		productId: string;
		quantity: number;
	}[];
};

export class CreateOrderUsecase {
	constructor(
		private readonly orderRepository: IOrderRepository,
		private readonly productRepository: IProductRepository,
		private readonly sagaRepository: ISagaRepository,
		private readonly queue: QueueAdapter,
	) {}

	async execute(props: Input) {
		const products = await this.productRepository.findByIds(
			props.items.map((i) => i.productId),
		);

		const productMap = new Map(products?.map((p) => [p.get("id")!, p]));

		const orderItems = props.items.map((item) => {
			const product = productMap.get(item.productId);

			if (!product)
				throw new AppError(`Produto ${item.productId} não encontrado`, 404);

			return OrdemItem.create({
				price: product.get("price"),
				productId: product.get("id")!,
				quantity: item.quantity,
			});
		});

		const order = Order.create({ ordemItems: orderItems });

		await this.orderRepository.create(order);

		const sagaId = GenerateId.generate("sga");

		await this.sagaRepository.create({
			id: sagaId,
			orderId: order.get("id")!,
			currentStep: SagaStepName.RESERVE_STOCK,
		});

		await this.queue.publish<JobData>(SagaStepName.RESERVE_STOCK, {
			sagaId,
			orderId: order.get("id")!,
			items: props.items,
		});

		return order.get();
	}
}
