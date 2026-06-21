import type { IProductRepository, Product } from "@casecellshop/shared";

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

export class FindManyProductUsecase {
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
