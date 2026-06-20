import type { Order } from "@ledger/shared";
import type { IOrderRepository } from "@ledger/shared";

type Input = {
	page: number;
	limit: number;
};

type Output = {
	items: Order[];
	pagination: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
};

export class FindManyOrder {
	constructor(private readonly orderRepository: IOrderRepository) {}

	async execute(props: Input): Promise<Output> {
		const { page, limit } = props;
		const { items, totalItems } = await this.orderRepository.findMany(
			page,
			limit,
		);

		const totalPages = Math.max(1, Math.ceil(totalItems / limit));

		return {
			items,
			pagination: {
				page,
				limit,
				totalItems,
				totalPages,
				hasNextPage: page < totalPages,
				hasPreviousPage: page > 1,
			},
		};
	}
}
