import type { Product } from "@ledger/shared";
import type { IProductRepository } from "@ledger/shared";

type Input = {
	page: number;
	limit: number;
};

type Output = {
	items: Product[];
	pagination: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
};

export class FindManyProduct {
	constructor(private readonly productRepository: IProductRepository) {}

	async execute(props: Input): Promise<Output> {
		const { page, limit } = props;
		const { items, totalItems } = await this.productRepository.findMany(
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
